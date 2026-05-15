const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const { STATES, getSession, updateSession, addToCart, removeFromCart, getCartTotal, formatCartSummary, formatPrice } = require('./session.manager');
const { sendText, sendButtons, sendList, markAsRead, sendLocationRequest } = require('./whatsapp.api');
const { createPrintJob, createCustomerTicketJob } = require('../print/print.service');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// Generador de número de orden por restaurante
// ─────────────────────────────────────────────
const generateOrderNumber = async (restaurantId) => {
  const today = new Date();
  const prefix = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
  const count = await prisma.order.count({
    where: { restaurantId, createdAt: { gte: new Date(today.setHours(0,0,0,0)) } },
  });
  return `${prefix}-${String(count + 1).padStart(3, '0')}`;
};

// ─────────────────────────────────────────────
// Verificar horario de atención
// ─────────────────────────────────────────────
const isRestaurantOpen = async (restaurantId) => {
  // Obtener timezone del restaurante
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { timezone: true },
  });

  const timezone = restaurant?.timezone || 'America/Mexico_City';

  // Obtener hora local del restaurante (no UTC)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const getPart = (type) => parts.find(p => p.type === type)?.value;

  const dayNames = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = dayNames[getPart('weekday')] ?? new Date().getDay();
  const currentTime = `${getPart('hour').padStart(2,'0')}:${getPart('minute').padStart(2,'0')}`;

  logger.info(`[Horario] Restaurante ${restaurantId} | TZ: ${timezone} | Día: ${dayOfWeek} | Hora: ${currentTime}`);

  const schedule = await prisma.restaurantSchedule.findFirst({
    where: { restaurantId, dayOfWeek },
  });

  // Si no hay horarios configurados, asumir abierto
  if (!schedule) {
    logger.warn(`[Horario] Sin horarios configurados para restaurante ${restaurantId}, asumiendo abierto`);
    return true;
  }

  if (!schedule.isOpen) return false;

  return currentTime >= schedule.openTime && currentTime <= schedule.closeTime;
};

// ─────────────────────────────────────────────
// Handler principal de mensajes entrantes
// ─────────────────────────────────────────────
const handleIncomingMessage = async (restaurantId, config, message) => {
  const { from: phoneNumber, id: messageId, type } = message;

  // Extraer el texto o ID del botón/lista seleccionado
  let userInput = '';
  let interactiveId = '';

  let locationData = null; // { latitude, longitude } si el cliente compartió su ubicación

  if (type === 'text') {
    userInput = message.text?.body?.trim() || '';
  } else if (type === 'interactive') {
    if (message.interactive.type === 'button_reply') {
      interactiveId = message.interactive.button_reply.id;
      userInput = message.interactive.button_reply.title;
    } else if (message.interactive.type === 'list_reply') {
      interactiveId = message.interactive.list_reply.id;
      userInput = message.interactive.list_reply.title;
    }
  } else if (type === 'location') {
    locationData = {
      latitude: message.location?.latitude,
      longitude: message.location?.longitude,
    };
  }

  // Marcar como leído
  await markAsRead(config.phoneNumberId, config.accessToken, messageId);

  // Obtener configuración del restaurante
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { currency: true, deliveryLocationEnabled: true },
  });
  const currency = restaurant?.currency || 'MXN';
  const deliveryLocationEnabled = restaurant?.deliveryLocationEnabled || false;

  // Obtener/crear sesión
  const session = await getSession(restaurantId, phoneNumber);
  const data = session.data || {};
  const cart = Array.isArray(session.cart) ? session.cart : [];

  logger.info(`[BOT] ${phoneNumber} | Estado: ${session.state} | Input: "${userInput}" | ID: "${interactiveId}"`);

  const send = {
    text: (text) => sendText(config.phoneNumberId, config.accessToken, phoneNumber, text),
    buttons: (body, btns, header) => sendButtons(config.phoneNumberId, config.accessToken, phoneNumber, body, btns, header),
    list: (body, btnTitle, sections) => sendList(config.phoneNumberId, config.accessToken, phoneNumber, body, btnTitle, sections),
  };

  // ── Comandos globales ──────────────────────
  const lowerInput = userInput.toLowerCase();
  if (['cancelar', 'cancel', 'reiniciar', 'restart', 'salir'].includes(lowerInput)) {
    await updateSession(restaurantId, phoneNumber, { state: STATES.GREETING, cart: [], data: {} });
    await send.text('❌ Orden cancelada. ¡Cuando quieras volver a pedir, escríbeme!');
    return;
  }

  // ── Máquina de estados ─────────────────────
  switch (session.state) {

    case STATES.GREETING: {
      const open = await isRestaurantOpen(restaurantId);
      if (!open) {
        await send.text(`😴 Por el momento estamos cerrados. ¡Te esperamos en nuestro horario de atención!`);
        return;
      }

      await updateSession(restaurantId, phoneNumber, { state: STATES.CUSTOMER_NAME });
      await send.text(`${config.welcomeMessage}\n\n¿Cuál es tu nombre?`);
      break;
    }

    case STATES.CUSTOMER_NAME: {
      if (!userInput) { await send.text('Por favor, dime tu nombre 😊'); return; }
      await updateSession(restaurantId, phoneNumber, {
        state: STATES.MENU,
        data: { ...data, customerName: userInput },
      });
      await showMainMenu(session, send, restaurantId, userInput);
      break;
    }

    case STATES.MENU: {
      if (interactiveId === 'view_cart') {
        await showCart(session, send, cart, currency);
      } else if (interactiveId === 'confirm_order') {
        await updateSession(restaurantId, phoneNumber, { state: STATES.SERVICE_TYPE });
        await askServiceType(send);
      } else {
        // Es una categoría seleccionada
        await showCategoryItems(session, send, restaurantId, interactiveId, phoneNumber, currency);
      }
      break;
    }

    case STATES.CATEGORY: {
      if (interactiveId === 'back_menu') {
        await updateSession(restaurantId, phoneNumber, { state: STATES.MENU });
        await showMainMenu(session, send, restaurantId, data.customerName);
      } else if (interactiveId === 'view_cart') {
        await showCart(session, send, cart, currency);
      } else if (interactiveId.startsWith('item_')) {
        // Agregar item al carrito
        const itemId = interactiveId.replace('item_', '');
        const menuItem = await prisma.menuItem.findFirst({
          where: { id: itemId, restaurantId, isActive: true, isAvailable: true },
        });
        if (!menuItem) { await send.text('❌ Item no disponible.'); return; }

        const newCart = await addToCart({ cart }, {
          menuItemId: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          quantity: 1,
        });
        await updateSession(restaurantId, phoneNumber, { cart: newCart });
        const total = getCartTotal(newCart);

        await send.buttons(
          `✅ *${menuItem.name}* agregado al carrito.\n\n🛒 Tienes ${newCart.length} item(s) — Total: ${formatPrice(total, currency)}`,
          [
            { id: 'add_more', title: '➕ Agregar más' },
            { id: 'view_cart', title: '🛒 Ver carrito' },
            { id: 'confirm_order', title: '✅ Confirmar' },
          ]
        );
      } else if (interactiveId === 'add_more') {
        await updateSession(restaurantId, phoneNumber, { state: STATES.MENU });
        await showMainMenu(session, send, restaurantId, data.customerName);
      } else if (interactiveId === 'confirm_order') {
        await updateSession(restaurantId, phoneNumber, { state: STATES.SERVICE_TYPE });
        await askServiceType(send);
      }
      break;
    }

    case STATES.CART: {
      if (interactiveId === 'continue_shopping') {
        await updateSession(restaurantId, phoneNumber, { state: STATES.MENU });
        await showMainMenu(session, send, restaurantId, data.customerName);
      } else if (interactiveId === 'confirm_order') {
        await updateSession(restaurantId, phoneNumber, { state: STATES.SERVICE_TYPE });
        await askServiceType(send);
      } else if (interactiveId === 'clear_cart') {
        await updateSession(restaurantId, phoneNumber, { cart: [], state: STATES.MENU });
        await send.text('🗑️ Carrito vaciado.');
        await showMainMenu(session, send, restaurantId, data.customerName);
      }
      break;
    }

    case STATES.SERVICE_TYPE: {
      let serviceType = null;
      if (interactiveId === 'service_dine_in') serviceType = 'DINE_IN';
      else if (interactiveId === 'service_takeaway') serviceType = 'TAKEAWAY';
      else if (interactiveId === 'service_delivery') serviceType = 'DELIVERY';

      if (!serviceType) { await askServiceType(send); return; }

      await updateSession(restaurantId, phoneNumber, { data: { ...data, serviceType } });

      if (serviceType === 'DELIVERY') {
        await updateSession(restaurantId, phoneNumber, { state: STATES.DELIVERY_ADDR });
        await send.text('🏠 ¿Cuál es tu dirección de entrega?');
      } else {
        await updateSession(restaurantId, phoneNumber, { state: STATES.CONFIRM });
        await sendConfirmation(session, send, cart, { ...data, serviceType }, currency);
      }
      break;
    }

    case STATES.TABLE_NUMBER: {
      if (!userInput) { await send.text('Por favor indica el número de mesa.'); return; }
      const updatedData = { ...data, tableNumber: userInput };
      await updateSession(restaurantId, phoneNumber, { state: STATES.CONFIRM, data: updatedData });
      await sendConfirmation(session, send, cart, updatedData, currency);
      break;
    }

    case STATES.DELIVERY_ADDR: {
      if (!userInput) { await send.text('Por favor indica tu dirección.'); return; }
      const updatedData = { ...data, deliveryAddress: userInput };

      if (deliveryLocationEnabled) {
        // Pedir ubicación nativa de WhatsApp para pasársela al rider
        await updateSession(restaurantId, phoneNumber, { state: STATES.DELIVERY_LOCATION, data: updatedData });
        await sendLocationRequest(
          config.phoneNumberId, config.accessToken, phoneNumber,
          '📍 Por favor comparte tu ubicación para que el repartidor pueda encontrarte más fácilmente.'
        );
      } else {
        await updateSession(restaurantId, phoneNumber, { state: STATES.CONFIRM, data: updatedData });
        await sendConfirmation(session, send, cart, updatedData, currency);
      }
      break;
    }

    case STATES.DELIVERY_LOCATION: {
      if (locationData?.latitude && locationData?.longitude) {
        // Cliente compartió su ubicación GPS
        const updatedData = {
          ...data,
          deliveryLatitude: locationData.latitude,
          deliveryLongitude: locationData.longitude,
        };
        await updateSession(restaurantId, phoneNumber, { state: STATES.CONFIRM, data: updatedData });
        await send.text('✅ Ubicación recibida. Gracias 📍');
        await sendConfirmation(session, send, cart, updatedData, currency);
      } else {
        // Cliente escribió texto en lugar de compartir ubicación → aceptar y continuar
        await updateSession(restaurantId, phoneNumber, { state: STATES.CONFIRM });
        await sendConfirmation(session, send, cart, data, currency);
      }
      break;
    }

    case STATES.CONFIRM: {
      if (interactiveId === 'place_order') {
        await placeOrder(restaurantId, config, phoneNumber, session, cart, data, send);
      } else if (interactiveId === 'edit_order') {
        await updateSession(restaurantId, phoneNumber, { state: STATES.MENU });
        await send.text('✏️ De acuerdo, puedes modificar tu orden.');
        await showMainMenu(session, send, restaurantId, data.customerName);
      }
      break;
    }

    case STATES.DONE: {
      await updateSession(restaurantId, phoneNumber, { state: STATES.GREETING, cart: [], data: {} });
      await send.text('¡Hola de nuevo! 👋 ¿Deseas hacer un nuevo pedido?');
      await handleIncomingMessage(restaurantId, config, message);
      break;
    }

    default: {
      await updateSession(restaurantId, phoneNumber, { state: STATES.GREETING, cart: [], data: {} });
      await send.text(config.welcomeMessage);
    }
  }
};

// ─────────────────────────────────────────────
// Helpers de presentación
// ─────────────────────────────────────────────

const showMainMenu = async (session, send, restaurantId, customerName) => {
  const categories = await prisma.category.findMany({
    where: { restaurantId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  if (categories.length === 0) {
    await send.text('😔 No hay categorías disponibles en este momento.');
    return;
  }

  const cart = Array.isArray(session.cart) ? session.cart : [];
  const cartInfo = cart.length > 0 ? `\n🛒 Tienes ${cart.length} item(s) en tu carrito.` : '';
  const greeting = customerName ? `Hola, *${customerName}*! ` : '';

  const sections = [{
    title: '📋 Categorías',
    rows: categories.map(cat => ({
      id: cat.id,
      title: `${cat.emoji || ''} ${cat.name}`.trim(),
      description: 'Ver platillos',
    })),
  }];

  if (cart.length > 0) {
    sections.push({
      title: '🛒 Mi orden',
      rows: [
        { id: 'view_cart', title: '🛒 Ver carrito', description: `${cart.length} item(s)` },
        { id: 'confirm_order', title: '✅ Confirmar orden', description: 'Proceder al pedido' },
      ],
    });
  }

  await send.list(
    `${greeting}¿Qué te gustaría ordenar hoy?${cartInfo}\n\nElige una categoría:`,
    '📋 Ver menú',
    sections
  );
};

const showCategoryItems = async (session, send, restaurantId, categoryId, phoneNumber, currency = 'MXN') => {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, restaurantId, isActive: true },
    include: {
      items: {
        where: { isActive: true, isAvailable: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!category || category.items.length === 0) {
    await send.text('😔 No hay items disponibles en esta categoría.');
    return;
  }

  await updateSession(restaurantId, phoneNumber, { state: STATES.CATEGORY });

  const rows = category.items.slice(0, 10).map(item => ({
    id: `item_${item.id}`,
    title: item.name.substring(0, 24),
    description: `${formatPrice(item.price, currency)}${item.description ? ' — ' + item.description.substring(0, 30) : ''}`,
  }));

  const navRows = [
    { id: 'back_menu', title: '⬅️ Volver al menú', description: 'Ver otras categorías' },
  ];

  const cart = Array.isArray(session.cart) ? session.cart : [];
  if (cart.length > 0) {
    navRows.push({ id: 'view_cart', title: '🛒 Ver carrito', description: `${cart.length} item(s)` });
  }

  await send.list(
    `${category.emoji || '🍽️'} *${category.name}*\n\nSelecciona un platillo para agregarlo a tu orden:`,
    '🍽️ Ver platillos',
    [
      { title: `📋 ${category.name}`, rows },
      { title: '🔧 Opciones', rows: navRows },
    ]
  );
};

const showCart = async (session, send, cart, currency = 'MXN') => {
  if (!cart || cart.length === 0) {
    await send.buttons(
      '🛒 Tu carrito está vacío.',
      [{ id: 'continue_shopping', title: '🛍️ Ver menú' }]
    );
    return;
  }

  const summary = formatCartSummary(cart, currency);
  await send.buttons(
    summary,
    [
      { id: 'continue_shopping', title: '➕ Agregar más' },
      { id: 'confirm_order', title: '✅ Confirmar' },
      { id: 'clear_cart', title: '🗑️ Vaciar' },
    ]
  );
};

const askServiceType = async (send) => {
  await send.buttons(
    '¿Cómo deseas recibir tu orden?',
    [
      { id: 'service_takeaway', title: '🥡 Pasar a recoger' },
      { id: 'service_delivery', title: '🚴 A domicilio' },
    ]
  );
};

const sendConfirmation = async (session, send, cart, data, currency = 'MXN') => {
  const summary = formatCartSummary(cart, currency);
  let serviceInfo = '';
  if (data.serviceType === 'TAKEAWAY') serviceInfo = `🥡 *Pasar a recoger*`;
  else if (data.serviceType === 'DELIVERY') serviceInfo = `🚴 *A domicilio:* ${data.deliveryAddress}`;

  await send.buttons(
    `${summary}\n\n${serviceInfo}\n\n¿Confirmas tu orden?`,
    [
      { id: 'place_order', title: '✅ ¡Confirmar!' },
      { id: 'edit_order', title: '✏️ Modificar' },
    ]
  );
};

// ─────────────────────────────────────────────
// Crear orden confirmada
// ─────────────────────────────────────────────
const placeOrder = async (restaurantId, config, phoneNumber, session, cart, data, send) => {
  try {
    if (!cart || cart.length === 0) {
      await send.text('❌ Tu carrito está vacío. Agrega items primero.');
      return;
    }

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    const orderNumber = await generateOrderNumber(restaurantId);
    const subtotal = getCartTotal(cart);
    const total = subtotal; // Impuesto se puede agregar después

    // Buscar mesa si aplica
    let tableId = null;
    if (data.serviceType === 'DINE_IN' && data.tableNumber) {
      const table = await prisma.table.findFirst({
        where: { restaurantId, number: data.tableNumber.toString() },
      });
      tableId = table?.id || null;
    }

    // Crear la orden en BD
    const order = await prisma.order.create({
      data: {
        restaurantId,
        orderNumber,
        customerPhone: phoneNumber,
        customerName: data.customerName,
        serviceType: data.serviceType,
        tableId,
        deliveryAddress: data.deliveryAddress || null,
        deliveryLatitude: data.deliveryLatitude || null,
        deliveryLongitude: data.deliveryLongitude || null,
        status: 'CONFIRMED',
        subtotal,
        tax: 0,
        total,
        confirmedAt: new Date(),
        items: {
          create: cart.map(item => ({
            menuItemId: item.menuItemId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            notes: item.notes || null,
          })),
        },
      },
      include: { items: true, table: true },
    });

    // Crear jobs de impresión (cocina + ticket cliente)
    await createPrintJob(restaurantId, order);
    await createCustomerTicketJob(restaurantId, order);

    // Emitir al backoffice en tiempo real
    const io = global.io;
    if (io) {
      io.to(`restaurant:${restaurantId}`).emit('order:new', order);
    }

    // Limpiar sesión
    await updateSession(restaurantId, phoneNumber, {
      state: STATES.DONE,
      cart: [],
      data: { customerName: data.customerName }, // Conservar nombre
    });

    // Confirmar al cliente
    await send.text(
      `🎉 ¡Orden confirmada!\n\n` +
      `📋 *Número de pedido: #${orderNumber}*\n\n` +
      `${formatCartSummary(cart, restaurant.currency)}\n\n` +
      `⏱️ Tu orden está siendo preparada. ¡Gracias por tu preferencia!\n\n` +
      `_Escribe cualquier cosa para hacer un nuevo pedido._`
    );

    logger.info(`✅ Orden #${orderNumber} creada para ${phoneNumber} en restaurante ${restaurantId}`);
  } catch (err) {
    logger.error('Error al crear orden:', err);
    await send.text('❌ Hubo un error al procesar tu orden. Por favor intenta de nuevo.');
  }
};

module.exports = { handleIncomingMessage };
