require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const { flushPendingJobs, updateJobStatus } = require('./print/print.service');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

// ── WebSocket / Socket.io ──────────────────────────────────
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] },
});
global.io = io;
app.set('io', io);

io.on('connection', (socket) => {
  logger.info(`Socket conectado: ${socket.id}`);

  // Backoffice: unirse al room del restaurante
  socket.on('join:restaurant', (restaurantId) => {
    socket.join(`restaurant:${restaurantId}`);
    logger.info(`Backoffice unido a restaurant:${restaurantId}`);
  });

  // Print-Agent: autenticarse con su token
  socket.on('printer:auth', async ({ agentToken }) => {
    try {
      const printer = await prisma.printer.findFirst({ where: { agentToken } });
      if (!printer) { socket.emit('printer:auth:error', 'Token inválido'); return; }

      socket.join(`printer:${printer.id}`);
      await prisma.printer.update({ where: { id: printer.id }, data: { isOnline: true, lastSeenAt: new Date() } });

      socket.emit('printer:auth:ok', { printerId: printer.id, name: printer.name });
      logger.info(`Impresora conectada: ${printer.name} (${printer.id})`);

      // Enviar jobs pendientes
      await flushPendingJobs(printer.id);

      // Al desconectar, marcar offline
      socket.on('disconnect', async () => {
        await prisma.printer.update({ where: { id: printer.id }, data: { isOnline: false } });
        logger.info(`Impresora desconectada: ${printer.name}`);
      });
    } catch (err) {
      logger.error('printer:auth error:', err);
    }
  });

  // Print-Agent reporta resultado de impresión
  socket.on('print:result', async ({ jobId, success: printed, error: printError }) => {
    await updateJobStatus(jobId, printed ? 'PRINTED' : 'FAILED', printError);
    logger.info(`Job ${jobId}: ${printed ? 'IMPRESO ✓' : 'FALLIDO ✗'}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Socket desconectado: ${socket.id}`);
  });
});

// ── Middlewares ────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting general
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api/', limiter);

// Rate limiting estricto para el webhook de WhatsApp
const webhookLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 200 });
app.use('/webhook', webhookLimiter);

// ── Rutas ──────────────────────────────────────────────────
app.use('/webhook', require('./whatsapp/whatsapp.routes'));
app.use('/api/admin', require('./admin/admin.routes'));
app.use('/api/auth', require('./auth/auth.routes'));
app.use('/api/menu', require('./menu/menu.routes'));
app.use('/api/orders', require('./orders/orders.routes'));
app.use('/api/restaurant', require('./restaurants/restaurants.routes'));
app.use('/api/print', require('./print/print.routes'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada' });
});

// Error handler global
app.use((err, req, res, next) => {
  logger.error('Error no manejado:', err);
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

// ── Iniciar servidor ───────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`🚀 Servidor corriendo en puerto ${PORT}`);
  logger.info(`📱 Webhook: POST /webhook`);
  logger.info(`🖥️  API: http://localhost:${PORT}/api`);
});

// Limpieza al cerrar
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  server.close(() => logger.info('Servidor cerrado'));
});
