require('dotenv').config();
const { connect } = require('./client/socket.client');
const logger = require('./utils/logger');

if (!process.env.AGENT_TOKEN) {
  logger.error('❌ AGENT_TOKEN no configurado en .env');
  logger.error('Copia el agentToken de la impresora desde el backoffice.');
  process.exit(1);
}

logger.info('🖨️  Print Agent iniciando...');
logger.info(`   Tipo impresora : ${process.env.PRINTER_TYPE || 'USB'}`);
logger.info(`   Backend URL    : ${process.env.BACKEND_URL || 'http://localhost:3000'}`);

// ── Capturar errores globales para que el proceso nunca muera ──
process.on('uncaughtException', (err) => {
  logger.error(`💥 Error no capturado: ${err.message}\n${err.stack}`);
  logger.warn('⚠️  El agente sigue corriendo a pesar del error.');
});

process.on('unhandledRejection', (reason) => {
  logger.error(`💥 Promesa rechazada sin capturar: ${reason}`);
  logger.warn('⚠️  El agente sigue corriendo a pesar del error.');
});

connect();
