const { PrismaClient } = require('@prisma/client');
const { chat } = require('./gemini.service');
const { sendText, sendLocationRequest } = require('../whatsapp/whatsapp.api');
const { createPrintJob } = require('../print/print.service');
const { createIncidencia } = require('../incidents/incidents.controller');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// Obtener o iniciar sesión de conversación IA
// ─────────────────────────────────────────────
const getAiSession = async (restaurantId, phoneNumber) => {
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 horas

  let session = await prisma.conversationSession.findUnique({
    where: { restaurantId_phoneNumber: { restaurantId, phoneNumber } },
  });

  if (!session || new Date(session.expiresAt) < new Date()) {
    session = await prisma.conversationSession.upsert({
      where: { restaurantId_phoneNumber: { restaurantId, phoneNumber } },
      create: {
        restaurantId,
        phoneNumber,
        state: 'AI_CHAT',
        cart: [],
        data: { conversationHistory: [], currentOrderId: null },
        expiresAt,
      },
      update: {
        state: 'AI_CHAT',
        cart: [],
        data: { conversationHistory: [], currentOrderId: null },
        expiresAt,
      },
    });
  }

  return session;
};

const updateAiSession = async (restaurantId, phoneNumber, conversationHistory, currentOrderId) => {
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  await prisma.conversationSession.update({
    where: { restaurantId_phoneNumber: { restaurantId, phoneNumber } },
    data: {
      data: { conversationHistory, currentOrderId: currentOrderId || null },
      expiresAt,
    },
  });
};

// ─────────────────────────────────────────────
// Ejecutar acción: crear o modificar orden
// ─────────────────────────────────────────────
const generateOrderNumber = async (restaurantId) => {
  const today = new Date();
  const prefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const start = new Date(today.setHours(0, 0, 0, 0));
  const count = await prisma.order.count({ where: { restaurantId, createdAt: { gte: start } } });
  return `${prefix}-${String(count + 1).padStart(3, '0')}`;
};

const executeAction = async (action, restaurantId, phoneNumber) => {
  if (action.action === 'place_order') {
    const orderNumber = await generateOrderNumber(restaurantId);

    // Resolver IDs de menuItems y validar que pertenecen al restaurante
    const menuItemIds = action.items.map(i => i.menuItemId);
    const validItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, restaurantId, isActive: true },
    });
    const validIds = new Set(validItems.map(i => i.id));
    const dbNames = new Map(validItems.map(i => [i.id, i.name]));

    const filteredItems = action.items.filter(i => validIds.has(i.menuItemId));
    if (filteredItems.length === 0) throw new Error('Ningún item válido en la orden');

    // Consolidar duplicados: si la IA mandó el mismo menuItemId dos veces, sumar quantities
    const consolidated = new Map();
    for (const item of filteredItems) {
      if (consolidated.has(item.menuItemId)) {
        consolidated.get(item.menuItemId).quantity += item.quantity;
      } else {
        consolidated.set(item.menuItemId, { ...item, quantity: Number(item.quantity) || 1 });
      }
    }
    const validOrderItems = Array.from(consolidated.values());

    const subtotal = validOrderItems.reduce((sum, i) => sum + (Number(i.price) * i.quantity), 0);

    // Resolver mesa si aplica
    let tableId = null;
    if (action.serviceType === 'DINE_IN' && action.tableNumber) {
      const table = await prisma.table.findFirst({
        where: { restaurantId, number: String(action.tableNumber) },
      });
      tableId = table?.id || null;
    }

    const order = await prisma.order.create({
      data: {
        restaurantId,
        orderNumber,
        customerPhone: phoneNumber,
        customerName: action.customerName || null,
        serviceType: action.serviceType || 'TAKEAWAY',
        tableId,
        deliveryAddress: action.deliveryAddress || null,
        status: 'CONFIRMED',
        subtotal,
        tax: 0,
        total: subtotal,
        confirmedAt: new Date(),
        items: {
          create: validOrderItems.map(i => ({
            menuItemId: i.menuItemId,
            name: i.name || dbNames.get(i.menuItemId),
            price: i.price,
            quantity: i.quantity,
            notes: i.notes || null,
          })),
        },
      },
      include: { items: true, table: true },
    });

    // Imprimir y emitir al backoffice
    await createPrintJob(restaurantId, order);
    const io = global.io;
    if (io) io.to(`restaurant:${restaurantId}`).emit('order:new', order);

    logger.info(`[AI] Orden #${orderNumber} creada — restaurante ${restaurantId}`);
    return order;
  }

  if (action.action === 'modify_order') {
    const order = await prisma.order.findFirst({
      where: { id: action.orderId, restaurantId },
    });
    if (!order) throw new Error('Orden no encontrada');
    if (['PREPARING', 'READY', 'DELIVERED', 'CANCELLED'].includes(order.status)) {
      throw new Error('La orden ya no puede modificarse');
    }

    // Emitir "modificando" al backoffice
    const io = global.io;
    if (io) io.to(`restaurant:${restaurantId}`).emit('order:modifying', { orderId: order.id });

    // Resolver nombres reales desde la BD para evitar que la IA los abrevie
    const modItemIds = action.items.map(i => i.menuItemId);
    const modDbItems = await prisma.menuItem.findMany({
      where: { id: { in: modItemIds }, restaurantId, isActive: true },
    });
    const modDbNames = new Map(modDbItems.map(i => [i.id, i.name]));

    // Consolidar duplicados en modify también
    const consolidatedMod = new Map();
    for (const item of action.items) {
      if (consolidatedMod.has(item.menuItemId)) {
        consolidatedMod.get(item.menuItemId).quantity += Number(item.quantity) || 1;
      } else {
        consolidatedMod.set(item.menuItemId, { ...item, quantity: Number(item.quantity) || 1 });
      }
    }
    const modItems = Array.from(consolidatedMod.values());

    const subtotal = modItems.reduce((sum, i) => sum + (Number(i.price) * i.quantity), 0);

    // Reemplazar items
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        subtotal,
        total: subtotal,
        deliveryAddress: action.deliveryAddress !== undefined ? action.deliveryAddress : order.deliveryAddress,
        updatedAt: new Date(),
        items: {
          create: modItems.map(i => ({
            menuItemId: i.menuItemId,
            name: i.name || modDbNames.get(i.menuItemId),
            price: i.price,
            quantity: i.quantity,
            notes: i.notes || null,
          })),
        },
      },
      include: { items: true, table: true },
    });

    if (io) io.to(`restaurant:${restaurantId}`).emit('order:updated', updated);
    logger.info(`[AI] Orden #${order.orderNumber} modificada — restaurante ${restaurantId}`);
    return updated;
  }
};

// ─────────────────────────────────────────────
// Handler principal
// ─────────────────────────────────────────────
const handleAiMessage = async (restaurant, config, message) => {
  const { from: phoneNumber, type } = message;

  const send = (text) => sendText(config.phoneNumberId, config.accessToken, phoneNumber, text);

  if (type === 'audio') {
    await send('Lo siento, por el momento solo acepto mensajes de texto. Por favor escribe tu pedido. 😊');
    return;
  }

  // ── Ubicación GPS del cliente (respuesta al location_request_message) ──
  if (type === 'location') {
    const latitude = message.location?.latitude;
    const longitude = message.location?.longitude;
    if (!latitude || !longitude) return;

    try {
      const session = await getAiSession(restaurant.id, phoneNumber);
      const sessionData = session.data || {};
      const pendingOrderId = sessionData.pendingLocationOrderId;

      if (pendingOrderId) {
        // Guardar coordenadas en la orden
        await prisma.order.update({
          where: { id: pendingOrderId },
          data: { deliveryLatitude: latitude, deliveryLongitude: longitude },
        });

        // Limpiar estado pendiente y conservar historial
        await prisma.conversationSession.update({
          where: { restaurantId_phoneNumber: { restaurantId: restaurant.id, phoneNumber } },
          data: {
            data: {
              ...sessionData,
              pendingLocationOrderId: null,
            },
            expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
          },
        });

        await send('✅ ¡Ubicación recibida! Tu pedido está confirmado y nuestro repartidor podrá encontrarte fácilmente. 🗺️');
      }
    } catch (err) {
      logger.error('[AI] Error guardando ubicación:', err.message);
    }
    return;
  }

  let userText = '';
  if (type === 'text') userText = message.text?.body?.trim() || '';
  else if (type === 'interactive') {
    userText = message.interactive?.button_reply?.title ||
               message.interactive?.list_reply?.title || '';
  }
  if (!userText) return;

  try {
    const session = await getAiSession(restaurant.id, phoneNumber);
    const sessionData = session.data || {};
    const conversationHistory = sessionData.conversationHistory || [];
    const currentOrderId = sessionData.currentOrderId || null;

    // Cargar orden activa si existe
    let currentOrder = null;
    if (currentOrderId) {
      currentOrder = await prisma.order.findFirst({
        where: { id: currentOrderId, restaurantId: restaurant.id },
        include: { items: true },
      });
      // Si la orden ya está muy avanzada, no la pasamos como modificable
      if (currentOrder && ['DELIVERED', 'CANCELLED'].includes(currentOrder.status)) {
        currentOrder = null;
      }
    }

    // Llamar a Gemini
    const { message: aiMessage, action } = await chat({
      restaurant,
      whatsappConfig: config,
      conversationHistory,
      newMessage: userText,
      currentOrder,
    });

    // Actualizar historial
    const updatedHistory = [
      ...conversationHistory,
      { role: 'user', content: userText },
      { role: 'assistant', content: aiMessage },
    ].slice(-40); // Mantener últimos 40 mensajes para no explotar el contexto

    // Ejecutar acción si la hay
    let newOrderId = currentOrderId;
    let askForLocation = false; // si debemos pedir ubicación GPS tras confirmar
    let pendingLocationOrderId = sessionData.pendingLocationOrderId || null;

    if (action) {
      try {
        if (action.action === 'escalate_to_human') {
          // Crear incidencia y notificar al backoffice en tiempo real
          await createIncidencia({
            restaurantId: restaurant.id,
            phoneNumber,
            customerName: null,
            aiQuestion: action.question || userText,
          });
          logger.info(`[AI] Escalación creada para ${phoneNumber} — restaurante ${restaurant.id}`);
        } else {
          const result = await executeAction(action, restaurant.id, phoneNumber);
          if (result && action.action === 'place_order') {
            newOrderId = result.id;
            // Si es delivery y el toggle está activo → pedir ubicación GPS
            if (result.serviceType === 'DELIVERY' && restaurant.deliveryLocationEnabled) {
              askForLocation = true;
              pendingLocationOrderId = result.id;
            }
          }
        }
      } catch (err) {
        logger.error('[AI] Error ejecutando acción:', err.message);
        await send(`❌ Hubo un problema al procesar tu solicitud: ${err.message}`);
        return;
      }
    }

    // Guardar historial actualizado (incluir pendingLocationOrderId si aplica)
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await prisma.conversationSession.update({
      where: { restaurantId_phoneNumber: { restaurantId: restaurant.id, phoneNumber } },
      data: {
        data: {
          conversationHistory: updatedHistory,
          currentOrderId: newOrderId || null,
          pendingLocationOrderId: pendingLocationOrderId,
        },
        expiresAt,
      },
    });

    // Enviar respuesta al cliente
    await send(aiMessage);

    // Si corresponde, pedir ubicación GPS después de la confirmación del pedido
    if (askForLocation) {
      await sendLocationRequest(
        config.phoneNumberId, config.accessToken, phoneNumber,
        '📍 Por favor comparte tu ubicación para que el repartidor pueda encontrarte más fácilmente.'
      );
      return; // No enviar nada más
    }

  } catch (err) {
    logger.error('[AI] Error en handleAiMessage:', err.message);
    await send('Lo siento, tuve un problema. Por favor intenta de nuevo en un momento. 🙏');
  }
};

module.exports = { handleAiMessage };
