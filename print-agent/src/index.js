require('dotenv').config();
const { connect } = require('./client/socket.client');
const logger = require('./utils/logger');

if (!process.env.AGENT_TOKEN) {
  logger.error('❌ AGENT_TOKEN no configurado en .env');
  logger.error('Copia el agentToken de la impresora desde el backoffice.');
  process.exit(1);
}

const printerType = (process.env.PRINTER_TYPE || 'USB').toUpperCase();
logger.info('🖨️  Print Agent iniciando...');
logger.info(`   Tipo impresora : ${printerType}`);
logger.info(`   Backend URL    : ${process.env.BACKEND_URL || 'http://localhost:3000'}`);

// Log adicional según transporte para facilitar diagnóstico
logger.info(`   Plataforma     : ${process.platform} (${process.arch})`);
if (printerType === 'NETWORK') {
  logger.info(`   Host:Puerto    : ${process.env.PRINTER_HOST || '192.168.1.100'}:${process.env.PRINTER_PORT || '9100'}`);
} else if (printerType === 'SERIAL') {
  logger.info(`   Puerto serie   : ${process.env.SERIAL_PORT || 'auto'} @ ${process.env.SERIAL_BAUD || '9600'} bps`);
} else if (printerType === 'SPOOLER') {
  logger.info(`   Impresora SO   : ${process.env.SPOOLER_PRINTER_NAME || '(no configurada)'}`);
}

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
