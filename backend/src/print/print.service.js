const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// Crear un job de impresión para una orden
// ─────────────────────────────────────────────
const createPrintJob = async (restaurantId, order) => {
  try {
    // Buscar impresora activa del restaurante
    const printer = await prisma.printer.findFirst({
      where: { restaurantId, isActive: true },
    });

    if (!printer) {
      logger.warn(`No hay impresora activa para restaurante ${restaurantId}`);
      return null;
    }

    const payload = buildTicketPayload(order);

    const job = await prisma.printJob.create({
      data: {
        restaurantId,
        printerId: printer.id,
        orderId: order.id,
        status: 'PENDING',
        payload,
      },
    });

    logger.info(`PrintJob creado: ${job.id} para orden #${order.orderNumber}`);

    // Notificar al print-agent vía WebSocket
    const io = global.io;
    if (io && printer.isOnline) {
      io.to(`printer:${printer.id}`).emit('print:job', { jobId: job.id, payload });
      await prisma.printJob.update({ where: { id: job.id }, data: { status: 'SENT' } });
    } else {
      logger.warn(`Impresora ${printer.id} offline. Job en cola.`);
    }

    return job;
  } catch (err) {
    logger.error('createPrintJob error:', err);
    return null;
  }
};

// ─────────────────────────────────────────────
// Construir el payload del ticket
// ─────────────────────────────────────────────
const buildTicketPayload = (order) => {
  const serviceTypeLabels = {
    DINE_IN: 'Mesa',
    TAKEAWAY: 'Para llevar',
    DELIVERY: 'Domicilio',
  };

  return {
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
    subtotal: Number(order.subtotal),
    tax: Number(order.tax),
    total: Number(order.total),
    notes: order.notes || null,
    createdAt: order.confirmedAt || order.createdAt,
  };
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

module.exports = { createPrintJob, flushPendingJobs, updateJobStatus };
