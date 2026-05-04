const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// Listar incidencias del restaurante
// ─────────────────────────────────────────────
const getIncidencias = async (req, res) => {
  try {
    const { restaurantId } = req.user;
    const { status } = req.query;

    const where = { restaurantId };
    if (status) where.status = status;

    const incidencias = await prisma.incidencia.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: incidencias });
  } catch (err) {
    logger.error('getIncidencias error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener incidencias' });
  }
};

// ─────────────────────────────────────────────
// Obtener una incidencia
// ─────────────────────────────────────────────
const getIncidencia = async (req, res) => {
  try {
    const { restaurantId } = req.user;
    const { id } = req.params;

    const incidencia = await prisma.incidencia.findFirst({
      where: { id, restaurantId },
    });

    if (!incidencia) return res.status(404).json({ success: false, message: 'Incidencia no encontrada' });

    res.json({ success: true, data: incidencia });
  } catch (err) {
    logger.error('getIncidencia error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener incidencia' });
  }
};

// ─────────────────────────────────────────────
// Responder a una incidencia (restaurante → IA/cliente)
// ─────────────────────────────────────────────
const respondIncidencia = async (req, res) => {
  try {
    const { restaurantId } = req.user;
    const { id } = req.params;
    const { text } = req.body;

    if (!text?.trim()) return res.status(400).json({ success: false, message: 'La respuesta no puede estar vacía' });

    const incidencia = await prisma.incidencia.findFirst({
      where: { id, restaurantId },
    });
    if (!incidencia) return res.status(404).json({ success: false, message: 'Incidencia no encontrada' });

    const messages = Array.isArray(incidencia.messages) ? incidencia.messages : [];
    const newMsg = {
      id: Date.now().toString(),
      role: 'restaurant',
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };
    messages.push(newMsg);

    const updated = await prisma.incidencia.update({
      where: { id },
      data: {
        messages,
        status: 'ANSWERED',
        updatedAt: new Date(),
      },
    });

    // Emitir en tiempo real
    const io = global.io;
    if (io) {
      io.to(`restaurant:${restaurantId}`).emit('incidencia:updated', updated);
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('respondIncidencia error:', err);
    res.status(500).json({ success: false, message: 'Error al responder incidencia' });
  }
};

// ─────────────────────────────────────────────
// Cerrar incidencia
// ─────────────────────────────────────────────
const closeIncidencia = async (req, res) => {
  try {
    const { restaurantId } = req.user;
    const { id } = req.params;

    const incidencia = await prisma.incidencia.findFirst({
      where: { id, restaurantId },
    });
    if (!incidencia) return res.status(404).json({ success: false, message: 'Incidencia no encontrada' });

    const updated = await prisma.incidencia.update({
      where: { id },
      data: { status: 'CLOSED', resolvedAt: new Date() },
    });

    const io = global.io;
    if (io) {
      io.to(`restaurant:${restaurantId}`).emit('incidencia:updated', updated);
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('closeIncidencia error:', err);
    res.status(500).json({ success: false, message: 'Error al cerrar incidencia' });
  }
};

// ─────────────────────────────────────────────
// Crear incidencia (llamada interna desde el AI handler)
// ─────────────────────────────────────────────
const createIncidencia = async ({ restaurantId, phoneNumber, customerName, aiQuestion }) => {
  const messages = [
    {
      id: Date.now().toString(),
      role: 'ai',
      text: aiQuestion,
      timestamp: new Date().toISOString(),
    },
  ];

  const incidencia = await prisma.incidencia.create({
    data: {
      restaurantId,
      phoneNumber,
      customerName: customerName || null,
      status: 'OPEN',
      messages,
    },
  });

  // Emitir en tiempo real al backoffice
  const io = global.io;
  if (io) {
    io.to(`restaurant:${restaurantId}`).emit('incidencia:new', incidencia);
  }

  logger.info(`Incidencia creada: ${incidencia.id} para restaurante ${restaurantId}`);
  return incidencia;
};

module.exports = { getIncidencias, getIncidencia, respondIncidencia, closeIncidencia, createIncidencia };
