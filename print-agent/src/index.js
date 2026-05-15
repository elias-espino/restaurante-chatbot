require('dotenv').config();
const { connect } = require('./client/socket.client');
const logger = require('./utils/logger');

if (!process.env.AGENT_TOKEN) {
  logger.error('AGENT_TOKEN no configurado en .env');
  logger.error('Copia el agentToken desde Backoffice > Configuracion > Impresoras.');
  process.exit(1);
}

const printerType = (process.env.PRINTER_TYPE || 'SERIAL').toUpperCase();

logger.info('Print Agent iniciando... (Windows)');
logger.info(`   Tipo impresora : ${printerType}`);
logger.info(`   Backend URL    : ${process.env.BACKEND_URL || 'http://localhost:3000'}`);

if (printerType === 'NETWORK') {
  logger.info(`   Host:Puerto    : ${process.env.PRINTER_HOST || '192.168.1.100'}:${process.env.PRINTER_PORT || '9100'}`);
} else if (printerType === 'SERIAL') {
  logger.info(`   Puerto COM     : ${process.env.SERIAL_PORT || 'auto'} @ ${process.env.SERIAL_BAUD || '9600'} bps`);
  if ((process.env.SERIAL_PORT || 'auto').toLowerCase() === 'auto') {
    logger.info('   (auto-discovery activo — buscando impresora BT...)');
  }
} else if (printerType === 'SPOOLER') {
  logger.info(`   Cola Windows   : ${process.env.SPOOLER_PRINTER_NAME || '(no configurada)'}`);
}

// Capturar errores globales — el agente nunca debe morir
process.on('uncaughtException', (err) => {
  logger.error(`Error no capturado: ${err.message}\n${err.stack}`);
  logger.warn('El agente sigue corriendo.');
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Promesa rechazada sin capturar: ${reason}`);
  logger.warn('El agente sigue corriendo.');
});

connect();
