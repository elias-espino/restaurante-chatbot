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
  const notifiableStatuses = ['PREPARING', 'READY', 'DELIVERED', 'CANCELLED'];
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

module.exports = { notifyOrderStatus };
