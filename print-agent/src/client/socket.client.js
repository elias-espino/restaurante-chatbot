const { io } = require('socket.io-client');
const logger = require('../utils/logger');

// ── Dispatcher de transporte ────────────────────────────────────────────────
// Selecciona el módulo de impresión según PRINTER_TYPE:
//   USB      → escpos-usb (nativo, por libusb)            — Win/Mac/Linux
//   NETWORK  → escpos-network (TCP/IP puerto 9100)         — Win/Mac/Linux
//   SERIAL   → puerto serie / COM virtual (Bluetooth, RS-232) — Win/Mac/Linux
//   SPOOLER  → cola del SO en modo RAW (winspool / CUPS)   — Win/Mac/Linux
const PRINTER_TYPE = (process.env.PRINTER_TYPE || 'USB').toUpperCase();
const printTicket = (() => {
  if (PRINTER_TYPE === 'SPOOLER') {
    return require('../printer/spooler.printer').printTicket;
  }
  // USB, NETWORK y SERIAL los maneja el módulo escpos clásico
  return require('../printer/escpos.printer').printTicket;
})();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const AGENT_TOKEN  = process.env.AGENT_TOKEN;
const RECONNECT_DELAY = 5000;

let socket;
let reconnectAttempts = 0;

const connect = () => {
  logger.info(`Conectando a backend: ${BACKEND_URL}`);

  socket = io(BACKEND_URL, {
    reconnection: true,
    reconnectionDelay: RECONNECT_DELAY,
    reconnectionAttempts: Infinity,
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    reconnectAttempts = 0;
    logger.info(`✅ Conectado al backend (socket: ${socket.id})`);
    // Autenticarse como impresora
    socket.emit('printer:auth', { agentToken: AGENT_TOKEN });
  });

  socket.on('printer:auth:ok', ({ printerId, name }) => {
    logger.info(`🖨️  Autenticado como: ${name} (ID: ${printerId})`);
  });

  socket.on('printer:auth:error', (msg) => {
    logger.error(`❌ Auth fallida: ${msg}`);
    logger.error('Verifica el AGENT_TOKEN en el .env');
  });

  // Recibir job de impresión — con reintentos automáticos
  socket.on('print:job', async ({ jobId, payload }) => {
    logger.info(`📥 Job recibido: ${jobId} — Orden #${payload.orderNumber}`);

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 3000; // ms entre reintentos

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await printTicket(payload);
        socket.emit('print:result', { jobId, success: true });
        return; // éxito, salir del loop
      } catch (err) {
        const errMsg = err.message || String(err);
        if (attempt < MAX_RETRIES) {
          logger.warn(`⚠️  Intento ${attempt}/${MAX_RETRIES} fallido para job ${jobId}: ${errMsg}. Reintentando en ${RETRY_DELAY / 1000}s...`);
          await new Promise(r => setTimeout(r, RETRY_DELAY));
        } else {
          logger.error(`❌ Job ${jobId} fallido tras ${MAX_RETRIES} intentos: ${errMsg}\n${err.stack || ''}`);
          socket.emit('print:result', { jobId, success: false, error: errMsg });
        }
      }
    }
  });

  socket.on('disconnect', (reason) => {
    logger.warn(`⚠️  Desconectado: ${reason}`);
  });

  socket.on('connect_error', (err) => {
    reconnectAttempts++;
    logger.error(`Error de conexión (intento ${reconnectAttempts}): ${err.message}`);
  });

  socket.on('reconnect', (attempt) => {
    logger.info(`🔄 Reconectado tras ${attempt} intento(s)`);
  });
};

module.exports = { connect };
