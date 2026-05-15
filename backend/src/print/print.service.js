const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// Crear jobs de impresión para una orden
// Agrupa los items por impresora asignada.
// Items sin impresora van a la impresora default del restaurante.
// ─────────────────────────────────────────────
const createPrintJob = async (restaurantId, order, options = {}) => {
  try {
    // Obtener los menuItems con su impresora asignada
    const menuItemIds = order.items.map(i => i.menuItemId).filter(Boolean);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, printerId: true },
    });

    const printerMap = {};
    for (const mi of menuItems) {
      printerMap[mi.id] = mi.printerId || null;
    }

    // Impresora por defecto del restaurante (para items sin asignación)
    const defaultPrinter = await prisma.printer.findFirst({
      where: { restaurantId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    // Agrupar items por impresora
    // { printerId: [orderItems] }
    const groups = {};

    for (const item of order.items) {
      const assignedPrinterId = (item.menuItemId && printerMap[item.menuItemId])
        ? printerMap[item.menuItemId]
        : (defaultPrinter ? defaultPrinter.id : null);

      if (!assignedPrinterId) continue;

      if (!groups[assignedPrinterId]) groups[assignedPrinterId] = [];
      groups[assignedPrinterId].push(item);
    }

    if (Object.keys(groups).length === 0) {
      logger.warn(`No hay impresora asignada para ningún item del restaurante ${restaurantId}`);
      return null;
    }

    const io = global.io;
    const createdJobs = [];

    for (const [printerId, items] of Object.entries(groups)) {
      const printer = await prisma.printer.findUnique({ where: { id: printerId } });
      if (!printer || !printer.isActive) {
        logger.warn(`Impresora ${printerId} no encontrada o inactiva, saltando grupo.`);
        continue;
      }

      const payload = buildTicketPayload(order, items, { reprint: options.reprint || false });

      const job = await prisma.printJob.create({
        data: {
          restaurantId,
          printerId,
          orderId: order.id,
          status: 'PENDING',
          payload,
        },
      });

      logger.info(`PrintJob creado: ${job.id} → impresora "${printer.name}" (${items.length} items) para orden #${order.orderNumber}`);

      if (io && printer.isOnline) {
        io.to(`printer:${printerId}`).emit('print:job', { jobId: job.id, payload });
        await prisma.printJob.update({ where: { id: job.id }, data: { status: 'SENT' } });
      } else {
        logger.warn(`Impresora ${printerId} offline. Job en cola.`);
      }

      createdJobs.push(job);
    }

    return createdJobs.length > 0 ? createdJobs : null;
  } catch (err) {
    logger.error('createPrintJob error:', err);
    return null;
  }
};

// ─────────────────────────────────────────────
// Construir el payload del ticket
// Acepta un subconjunto de items para tickets por impresora.
// Si no se pasan items, usa todos los de la orden.
// ─────────────────────────────────────────────
const buildTicketPayload = (order, primaryItems = null, options = {}) => {
  const serviceTypeLabels = {
    DINE_IN: 'Mesa',
    TAKEAWAY: 'Para llevar',
    DELIVERY: 'Domicilio',
  };

  const primaryIds = new Set((primaryItems || order.items).map(i => i.id));

  return {
    orderNumber: order.orderNumber,
    customerName: order.customerName || 'Cliente',
    customerPhone: order.customerPhone,
    serviceType: order.serviceType,
    serviceTypeLabel: serviceTypeLabels[order.serviceType] || order.serviceType,
    tableNumber: order.table?.number || null,
    deliveryAddress: order.deliveryAddress || null,
    isReprint: options.reprint || false,
    // Todos los items de la orden; isPrimary=true → van a esta impresora (negrita)
    items: order.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      notes: item.notes || null,
      isPrimary: primaryIds.has(item.id),
    })),
    notes: order.notes || null,
    createdAt: order.confirmedAt || order.createdAt,
  };
};

// ─────────────────────────────────────────────
// Ticket del cliente (con precios, sin distinción de impresoras)
// ─────────────────────────────────────────────
const createCustomerTicketJob = async (restaurantId, order) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { customerTicketPrinterId: true },
    });

    const printerId = restaurant?.customerTicketPrinterId;
    if (!printerId) return null; // no configurada, no imprimir

    const printer = await prisma.printer.findFirst({
      where: { id: printerId, restaurantId, isActive: true },
    });
    if (!printer) return null;

    const serviceTypeLabels = { DINE_IN: 'Mesa', TAKEAWAY: 'Para llevar', DELIVERY: 'Domicilio' };
    const total = Number(order.total);
    const subtotal = Number(order.subtotal);

    const payload = {
      isCustomerTicket: true,
      orderNumber: order.orderNumber,
      customerName: order.customerName || 'Cliente',
      customerPhone: order.customerPhone,
      serviceType: order.serviceType,
      serviceTypeLabel: serviceTypeLabels[order.serviceType] || order.serviceType,
      tableNumber: order.table?.number || null,
      deliveryAddress: order.deliveryAddress || null,
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: Number(item.price),
        total: Number(item.price) * item.quantity,
        notes: item.notes || null,
      })),
      subtotal,
      total,
      notes: order.notes || null,
      createdAt: order.confirmedAt || order.createdAt,
    };

    const job = await prisma.printJob.create({
      data: { restaurantId, printerId, orderId: order.id, status: 'PENDING', payload },
    });

    const io = global.io;
    if (io && printer.isOnline) {
      io.to(`printer:${printerId}`).emit('print:job', { jobId: job.id, payload });
      await prisma.printJob.update({ where: { id: job.id }, data: { status: 'SENT' } });
    }

    logger.info(`CustomerTicketJob creado: ${job.id} → impresora "${printer.name}" para orden #${order.orderNumber}`);
    return job;
  } catch (err) {
    logger.error('createCustomerTicketJob error:', err);
    return null;
  }
};

// ─────────────────────────────────────────────
// Reencolar jobs pendientes (al conectar una impresora)
// ─────────────────────────────────────────────
const flushPendingJobs = async (printerId) => {
  const pendingJobs = await prisma.printJob.findMany({
    where: { printerId, status: { in: ['PENDING', 'FAILED'] }, attempts: { lt: 3 } },
    orderBy: { createdAt: 'asc' },
  });

  if (pendingJobs.length === 0) return;

  logger.info(`Reencolando ${pendingJobs.length} jobs para impresora ${printerId}`);

  const io = global.io;
  if (!io) return;

  for (const job of pendingJobs) {
    io.to(`printer:${printerId}`).emit('print:job', { jobId: job.id, payload: job.payload });
    await prisma.printJob.update({
      where: { id: job.id },
      data: { status: 'SENT', attempts: { increment: 1 } },
    });
  }
};

// ─────────────────────────────────────────────
// Marcar job como impreso o fallido
// ─────────────────────────────────────────────
const updateJobStatus = async (jobId, status, error = null) => {
  await prisma.printJob.update({
    where: { id: jobId },
    data: {
      status,
      processedAt: status === 'PRINTED' ? new Date() : undefined,
      lastError: error,
    },
  });
};

module.exports = { createPrintJob, createCustomerTicketJob, flushPendingJobs, updateJobStatus };
