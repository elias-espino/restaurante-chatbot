const { PrismaClient } = require('@prisma/client');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const { notifyOrderStatus } = require('../whatsapp/notifications.service');

const prisma = new PrismaClient();

const getOrders = async (req, res) => {
  try {
    const { status, date, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { restaurantId: req.restaurantId };
    if (status) where.status = status;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { gte: start, lte: end };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          table: { select: { number: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.order.count({ where }),
    ]);

    return success(res, { orders, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    logger.error('getOrders:', err);
    return error(res, 'Error al obtener órdenes', 500);
  }
};

const getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findFirst({
      where: { id, restaurantId: req.restaurantId },
      include: { items: true, table: true, printJobs: true },
    });
    if (!order) return error(res, 'Orden no encontrada', 404);
    return success(res, order);
  } catch (err) {
    return error(res, 'Error al obtener orden', 500);
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return error(res, 'Estado inválido', 400);
    }

    const order = await prisma.order.findFirst({
      where: { id, restaurantId: req.restaurantId },
    });
    if (!order) return error(res, 'Orden no encontrada', 404);

    const updateData = { status };
    if (status === 'CONFIRMED') updateData.confirmedAt = new Date();
    if (status === 'DELIVERED') updateData.completedAt = new Date();
    if (status === 'CANCELLED') updateData.cancelledAt = new Date();

    const updated = await prisma.order.update({ where: { id }, data: updateData });

    // Emitir evento WebSocket al backoffice en tiempo real
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${req.restaurantId}`).emit('order:updated', updated);
    }

    // Notificar al cliente por WhatsApp (no bloquea la respuesta)
    notifyOrderStatus(req.restaurantId, updated).catch(err =>
      logger.error('Error en notificación WhatsApp:', err)
    );

    return success(res, updated, 'Estado actualizado');
  } catch (err) {
    logger.error('updateOrderStatus:', err);
    return error(res, 'Error al actualizar estado', 500);
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const [
      totalToday,
      pendingOrders,
      preparingOrders,
      revenueToday,
      topItems,
      recentOrders,
    ] = await Promise.all([
      prisma.order.count({
        where: { restaurantId: req.restaurantId, createdAt: { gte: today, lt: tomorrow } },
      }),
      prisma.order.count({
        where: { restaurantId: req.restaurantId, status: 'CONFIRMED' },
      }),
      prisma.order.count({
        where: { restaurantId: req.restaurantId, status: 'PREPARING' },
      }),
      prisma.order.aggregate({
        where: {
          restaurantId: req.restaurantId,
          createdAt: { gte: today, lt: tomorrow },
          status: { not: 'CANCELLED' },
        },
        _sum: { total: true },
      }),
      prisma.orderItem.groupBy({
        by: ['name'],
        where: {
          order: {
            restaurantId: req.restaurantId,
            createdAt: { gte: today, lt: tomorrow },
            status: { not: 'CANCELLED' },
          },
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      prisma.order.findMany({
        where: { restaurantId: req.restaurantId },
        include: { items: true, table: { select: { number: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return success(res, {
      totalToday,
      pendingOrders,
      preparingOrders,
      revenueToday: revenueToday._sum.total || 0,
      topItems,
      recentOrders,
    });
  } catch (err) {
    logger.error('getDashboardStats:', err);
    return error(res, 'Error al obtener estadísticas', 500);
  }
};

const getSalesReport = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return error(res, 'Parámetros from y to requeridos', 400);

    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    const orders = await prisma.order.findMany({
      where: {
        restaurantId: req.restaurantId,
        createdAt: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalOrders = orders.length;

    // Agrupar por día
    const byDay = {};
    for (const order of orders) {
      const day = order.createdAt.toISOString().split('T')[0];
      if (!byDay[day]) byDay[day] = { date: day, orders: 0, revenue: 0 };
      byDay[day].orders++;
      byDay[day].revenue += Number(order.total);
    }

    return success(res, {
      totalRevenue,
      totalOrders,
      averageTicket: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      byDay: Object.values(byDay),
      orders,
    });
  } catch (err) {
    logger.error('getSalesReport:', err);
    return error(res, 'Error al generar reporte', 500);
  }
};

module.exports = { getOrders, getOrder, updateOrderStatus, getDashboardStats, getSalesReport };
