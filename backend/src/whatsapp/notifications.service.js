const { PrismaClient } = require('@prisma/client');
const { sendText } = require('./whatsapp.api');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// Mensajes por estado
const STATUS_MESSAGES = {
  PREPARING: (order) =>
    `👨‍🍳 ¡Tu orden *#${order.orderNumber}* ya está en preparación!\n\nEn breve estará lista. Gracias por tu paciencia 🙏`,

  READY: (order) => {
    if (order.serviceType === 'TAKEAWAY') {
      return `✅ ¡Tu orden *#${order.orderNumber}* lista para recoger!\n\nYa puedes pasar a recogerla. 🥡`;
    } else {
      return `✅ ¡Tu orden *#${order.orderNumber}* está en camino!\n\nNuestro repartidor va en dirección a tu domicilio. 🚴`;
    }
  },

  OUT_FOR_DELIVERY: (order) =>
    `🛵 ¡Tu orden *#${order.orderNumber}* está en camino!\n\nNuestro repartidor ya salió hacia tu dirección. Prepara tu código de confirmación: *${order.deliveryCode}*\n\n_Entrégaselo al repartidor cuando llegue._`,

  DELIVERED: (order) =>
    `🎉 ¡Orden *#${order.orderNumber}* entregada!\n\nEsperamos que la disfrutes mucho. ¡Gracias por tu preferencia! 😊\n\n_Escríbenos cuando quieras hacer un nuevo pedido._`,

  CANCELLED: (order) =>
    `❌ Tu orden *#${order.orderNumber}* fue cancelada.\n\nSi tienes alguna duda, por favor contáctanos directamente. Disculpa los inconvenientes.`,
};

/**
 * Envía una notificación WhatsApp al cliente cuando cambia el estado de su orden.
 * Solo envía para los estados que el cliente necesita saber.
 */
const notifyOrderStatus = async (restaurantId, order) => {
  const notifiableStatuses = ['PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
  if (!notifiableStatuses.includes(order.status)) return;

  try {
    // Obtener config de WhatsApp del restaurante
    const config = await prisma.whatsappConfig.findFirst({
      where: { restaurantId, isActive: true },
    });

    if (!config) {
      logger.warn(`[Notif] Sin config WhatsApp para restaurante ${restaurantId}`);
      return;
    }

    const messageFn = STATUS_MESSAGES[order.status];
    if (!messageFn) return;

    const messageText = messageFn(order);

    await sendText(config.phoneNumberId, config.accessToken, order.customerPhone, messageText);

    logger.info(`[Notif] ✅ Notificado ${order.customerPhone} — Orden #${order.orderNumber} → ${order.status}`);
  } catch (err) {
    // No interrumpir el flujo principal si falla la notificación
    logger.error(`[Notif] Error al notificar orden #${order.orderNumber}:`, err.message);
  }
};

/**
 * Notifica al cliente que su pedido tiene un repartidor asignado
 * y le envía el código de 4 dígitos que deberá dar al rider al recibir.
 */
const notifyRiderAssigned = async (restaurantId, order) => {
  if (!order.deliveryCode) return;

  try {
    const config = await prisma.whatsappConfig.findFirst({
      where: { restaurantId, isActive: true },
    });
    if (!config) return;

    const message =
      `🛵 ¡Tu pedido *#${order.orderNumber}* ya tiene repartidor asignado!\n\n` +
      `Cuando llegue a tu puerta, entrégale este código de confirmación:\n\n` +
      `*🔑 ${order.deliveryCode}*\n\n` +
      `_Guarda este código — el repartidor lo necesitará para completar la entrega._`;

    await sendText(config.phoneNumberId, config.accessToken, order.customerPhone, message);
    logger.info(`[Notif] ✅ Código de entrega enviado a ${order.customerPhone} — Orden #${order.orderNumber}`);
  } catch (err) {
    logger.error(`[Notif] Error al enviar código de entrega:`, err.message);
  }
};

module.exports = { notifyOrderStatus, notifyRiderAssigned };
