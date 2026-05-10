// ============================================================
// DELIVERY CONTROLLER
// Gestión de riders + asignación de órdenes + pantalla pública
// ============================================================
const { PrismaClient } = require('@prisma/client');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const { notifyOrderStatus } = require('../whatsapp/notifications.service');

const prisma = new PrismaClient();

// ── Generador de código hex único por restaurante ───────────
const generateRiderCode = async (restaurantId) => {
  const MAX_ATTEMPTS = 20;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const code = Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, '0');
    const exists = await prisma.rider.findFirst({
      where: { restaurantId, riderCode: code },
    });
    if (!exists) return code;
  }
  throw new Error('No se pudo generar un código único para el rider');
};

// ── Generador de código de entrega (4 dígitos) ──────────────
const generateDeliveryCode = () => {
  return String(Math.floor(1000 + Math.random() * 9000));
};

// ════════════════════════════════════════════════════════════
// RIDERS — CRUD (requieren auth del backoffice)
// ════════════════════════════════════════════════════════════

// GET /api/delivery/riders
const getRiders = async (req, res) => {
  try {
    const riders = await prisma.rider.findMany({
      where: { restaurantId: req.restaurantId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { orders: true },
        },
        orders: {
          where: {
            status: { in: ['OUT_FOR_DELIVERY', 'READY'] },
            riderId: { not: null },
          },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            deliveryAddress: true,
            customerName: true,
          },
          take: 1,
        },
      },
    });
    return success(res, riders);
  } catch (err) {
    logger.error('getRiders:', err);
    return error(res, 'Error al obtener riders', 500);
  }
};

// POST /api/delivery/riders
const createRider = async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name || !name.trim()) {
      return error(res, 'El nombre del rider es requerido', 400);
    }

    const riderCode = await generateRiderCode(req.restaurantId);

    const rider = await prisma.rider.create({
      data: {
        restaurantId: req.restaurantId,
        name: name.trim(),
        phone: phone?.trim() || null,
        riderCode,
      },
    });

    return success(res, rider, 'Rider creado exitosamente', 201);
  } catch (err) {
    logger.error('createRider:', err);
    return error(res, 'Error al crear rider', 500);
  }
};

// PATCH /api/delivery/riders/:id
const updateRider = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, isActive, isAvailable } = req.body;

    const rider = await prisma.rider.findFirst({
      where: { id, restaurantId: req.restaurantId },
    });
    if (!rider) return error(res, 'Rider no encontrado', 404);

    const updated = await prisma.rider.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
        ...(isAvailable !== undefined && { isAvailable }),
      },
    });

    return success(res, updated, 'Rider actualizado');
  } catch (err) {
    logger.error('updateRider:', err);
    return error(res, 'Error al actualizar rider', 500);
  }
};

// DELETE /api/delivery/riders/:id
const deleteRider = async (req, res) => {
  try {
    const { id } = req.params;
    const rider = await prisma.rider.findFirst({
      where: { id, restaurantId: req.restaurantId },
    });
    if (!rider) return error(res, 'Rider no encontrado', 404);

    // Verificar que no tenga órdenes activas
    const activeOrder = await prisma.order.findFirst({
      where: { riderId: id, status: { in: ['OUT_FOR_DELIVERY', 'READY'] } },
    });
    if (activeOrder) {
      return error(res, 'No se puede eliminar un rider con entregas activas', 400);
    }

    await prisma.rider.delete({ where: { id } });
    return success(res, null, 'Rider eliminado');
  } catch (err) {
    logger.error('deleteRider:', err);
    return error(res, 'Error al eliminar rider', 500);
  }
};

// ════════════════════════════════════════════════════════════
// ASIGNACIÓN DE ÓRDENES (requieren auth del backoffice)
// ════════════════════════════════════════════════════════════

// POST /api/delivery/orders/:orderId/assign
const assignRider = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { riderId } = req.body;

    if (!riderId) return error(res, 'riderId es requerido', 400);

    // Verificar orden
    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId: req.restaurantId },
    });
    if (!order) return error(res, 'Orden no encontrada', 404);
    if (order.serviceType !== 'DELIVERY') {
      return error(res, 'Solo se pueden asignar órdenes de tipo DELIVERY', 400);
    }
    if (['DELIVERED', 'CANCELLED'].includes(order.status)) {
      return error(res, 'No se puede asignar un rider a una orden finalizada', 400);
    }

    // Verificar rider
    const rider = await prisma.rider.findFirst({
      where: { id: riderId, restaurantId: req.restaurantId, isActive: true },
    });
    if (!rider) return error(res, 'Rider no encontrado o inactivo', 404);

    // Generar código de entrega de 4 dígitos
    const deliveryCode = generateDeliveryCode();

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        riderId,
        deliveryCode,
        deliveryAssignedAt: new Date(),
        // Si la orden ya estaba en READY o anterior, la dejamos como está
        // El rider la marcará OUT_FOR_DELIVERY al salir
      },
      include: { items: true, rider: true },
    });

    // Marcar rider como no disponible
    await prisma.rider.update({
      where: { id: riderId },
      data: { isAvailable: false },
    });

    // Emitir evento WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${req.restaurantId}`).emit('order:updated', updated);
    }

    return success(res, updated, `Rider asignado. Código de entrega: ${deliveryCode}`);
  } catch (err) {
    logger.error('assignRider:', err);
    return error(res, 'Error al asignar rider', 500);
  }
};

// POST /api/delivery/orders/:orderId/unassign
const unassignRider = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId: req.restaurantId },
    });
    if (!order) return error(res, 'Orden no encontrada', 404);
    if (!order.riderId) return error(res, 'La orden no tiene rider asignado', 400);
    if (order.status === 'OUT_FOR_DELIVERY') {
      return error(res, 'No se puede desasignar un rider que ya está en camino', 400);
    }

    const prevRiderId = order.riderId;

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        riderId: null,
        deliveryCode: null,
        deliveryAssignedAt: null,
      },
    });

    // Liberar rider
    await prisma.rider.update({
      where: { id: prevRiderId },
      data: { isAvailable: true },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${req.restaurantId}`).emit('order:updated', updated);
    }

    return success(res, updated, 'Rider desasignado');
  } catch (err) {
    logger.error('unassignRider:', err);
    return error(res, 'Error al desasignar rider', 500);
  }
};

// GET /api/delivery/orders?status=READY,OUT_FOR_DELIVERY  (órdenes delivery del día)
const getDeliveryOrders = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const orders = await prisma.order.findMany({
      where: {
        restaurantId: req.restaurantId,
        serviceType: 'DELIVERY',
        createdAt: { gte: today, lt: tomorrow },
      },
      include: {
        items: true,
        rider: { select: { id: true, name: true, phone: true, riderCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return success(res, orders);
  } catch (err) {
    logger.error('getDeliveryOrders:', err);
    return error(res, 'Error al obtener órdenes de delivery', 500);
  }
};

// ════════════════════════════════════════════════════════════
// PANTALLA PÚBLICA DEL RIDER (sin auth JWT, usa riderCode)
// ════════════════════════════════════════════════════════════

// Middleware para validar riderCode (se usa en rider.routes.js)
const validateRiderCode = async (req, res, next) => {
  try {
    const { riderCode } = req.params;
    if (!riderCode || !/^[0-9a-f]{1,4}$/.test(riderCode.toLowerCase())) {
      return error(res, 'Código de rider inválido', 400);
    }

    const rider = await prisma.rider.findFirst({
      where: { riderCode: riderCode.toLowerCase(), isActive: true },
      include: { restaurant: { select: { id: true, name: true, logoUrl: true } } },
    });

    if (!rider) return error(res, 'Código de rider no encontrado', 404);

    req.rider = rider;
    req.restaurantId = rider.restaurantId;
    next();
  } catch (err) {
    logger.error('validateRiderCode:', err);
    return error(res, 'Error al validar código', 500);
  }
};

// GET /api/rider/:riderCode  — Rider obtiene su info + orden activa
const getRiderInfo = async (req, res) => {
  try {
    const { rider } = req;

    // Buscar orden activa asignada a este rider
    const activeOrder = await prisma.order.findFirst({
      where: {
        riderId: rider.id,
        status: { in: ['READY', 'OUT_FOR_DELIVERY'] },
      },
      include: {
        items: { select: { name: true, quantity: true, notes: true } },
      },
      orderBy: { deliveryAssignedAt: 'desc' },
    });

    // Historial del día (últimas 10 entregas completadas)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const history = await prisma.order.findMany({
      where: {
        riderId: rider.id,
        status: 'DELIVERED',
        deliveryConfirmedAt: { gte: today },
      },
      select: {
        orderNumber: true,
        customerName: true,
        deliveryAddress: true,
        deliveryConfirmedAt: true,
        total: true,
      },
      orderBy: { deliveryConfirmedAt: 'desc' },
      take: 10,
    });

    return success(res, {
      rider: {
        id: rider.id,
        name: rider.name,
        phone: rider.phone,
        riderCode: rider.riderCode,
        isAvailable: rider.isAvailable,
        restaurant: rider.restaurant,
      },
      activeOrder,
      history,
    });
  } catch (err) {
    logger.error('getRiderInfo:', err);
    return error(res, 'Error al obtener información del rider', 500);
  }
};

// POST /api/rider/:riderCode/status  — Rider marca "En camino"
const updateRiderOrderStatus = async (req, res) => {
  try {
    const { rider } = req;
    const { status } = req.body;

    if (status !== 'OUT_FOR_DELIVERY') {
      return error(res, 'Solo se puede cambiar a OUT_FOR_DELIVERY desde esta ruta', 400);
    }

    const activeOrder = await prisma.order.findFirst({
      where: { riderId: rider.id, status: 'READY' },
    });

    if (!activeOrder) {
      return error(res, 'No tienes una orden activa lista para salir', 404);
    }

    const updated = await prisma.order.update({
      where: { id: activeOrder.id },
      data: {
        status: 'OUT_FOR_DELIVERY',
        deliveryStartedAt: new Date(),
      },
    });

    // Emitir WebSocket al backoffice
    const io = global.io;
    if (io) {
      io.to(`restaurant:${rider.restaurantId}`).emit('order:updated', updated);
    }

    // Notificar al cliente por WhatsApp
    notifyOrderStatus(rider.restaurantId, updated).catch(err =>
      logger.error('Error notificación WhatsApp (en camino):', err)
    );

    return success(res, updated, '¡En camino! 🛵');
  } catch (err) {
    logger.error('updateRiderOrderStatus:', err);
    return error(res, 'Error al actualizar estado', 500);
  }
};

// POST /api/rider/:riderCode/confirm  — Rider confirma entrega con el código del cliente
const confirmDelivery = async (req, res) => {
  try {
    const { rider } = req;
    const { code } = req.body;

    if (!code || !/^\d{4}$/.test(String(code))) {
      return error(res, 'El código de entrega debe ser de 4 dígitos', 400);
    }

    const activeOrder = await prisma.order.findFirst({
      where: {
        riderId: rider.id,
        status: { in: ['OUT_FOR_DELIVERY', 'READY'] },
      },
    });

    if (!activeOrder) {
      return error(res, 'No tienes una orden activa para confirmar', 404);
    }

    if (activeOrder.deliveryCode !== String(code)) {
      return error(res, 'Código incorrecto. Verifica el código con el cliente.', 400);
    }

    const updated = await prisma.order.update({
      where: { id: activeOrder.id },
      data: {
        status: 'DELIVERED',
        deliveryConfirmedAt: new Date(),
        completedAt: new Date(),
      },
    });

    // Liberar rider
    await prisma.rider.update({
      where: { id: rider.id },
      data: { isAvailable: true },
    });

    // Emitir WebSocket al backoffice
    const io = global.io;
    if (io) {
      io.to(`restaurant:${rider.restaurantId}`).emit('order:updated', updated);
    }

    // Notificar al cliente por WhatsApp
    notifyOrderStatus(rider.restaurantId, updated).catch(err =>
      logger.error('Error notificación WhatsApp (entregado):', err)
    );

    return success(res, updated, '¡Entrega confirmada! ✅');
  } catch (err) {
    logger.error('confirmDelivery:', err);
    return error(res, 'Error al confirmar entrega', 500);
  }
};

module.exports = {
  // Admin (requieren auth)
  getRiders,
  createRider,
  updateRider,
  deleteRider,
  assignRider,
  unassignRider,
  getDeliveryOrders,
  // Público (rider screen)
  validateRiderCode,
  getRiderInfo,
  updateRiderOrderStatus,
  confirmDelivery,
};
