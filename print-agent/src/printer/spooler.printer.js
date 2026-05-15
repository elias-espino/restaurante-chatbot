/**
 * spooler.printer.js — Windows only
 * ------------------------------------
 * Imprime el ticket usando la cola del sistema operativo en modo RAW
 * (winspool). El SO envía los bytes ESC/POS directamente a la impresora
 * sin rasterizar — performance idéntica al modo nativo USB/Network.
 *
 * Úsalo cuando la impresora esté instalada en Windows (por USB, red,
 * o Bluetooth emparejado) y aparezca en "Dispositivos e impresoras".
 *
 * Requiere `@grandchef/node-printer` (addon nativo para Win32 API).
 * Instalar con: npm install @grandchef/node-printer
 * Necesita Visual Studio Build Tools (C++ workload) para compilar.
 */
const { buildTicketBuffer } = require('./escpos.printer');
const logger = require('../utils/logger');

const SPOOLER_PRINTER_NAME = process.env.SPOOLER_PRINTER_NAME;

let nodePrinter = null;
const loadNodePrinter = () => {
  if (nodePrinter) return nodePrinter;
  try {
    nodePrinter = require('@grandchef/node-printer');
  } catch (err) {
    throw new Error(
      'Modulo @grandchef/node-printer no instalado.\n' +
      'Para usar PRINTER_TYPE=SPOOLER en Windows:\n' +
      '  1. Instala Visual Studio Build Tools (workload "Desarrollo de escritorio con C++")\n' +
      '  2. npm install @grandchef/node-printer\n' +
      '  3. Ejecuta: npm run list-ports  para ver el nombre exacto de la impresora'
    );
  }
  return nodePrinter;
};

const printTicket = async (payload) => {
  if (!SPOOLER_PRINTER_NAME) {
    throw new Error(
      'SPOOLER_PRINTER_NAME no configurado en .env.\n' +
      'Como obtener el nombre exacto:\n' +
      '  Panel de Control > Dispositivos e impresoras\n' +
      '  O ejecuta: npm run list-ports'
    );
  }

  const printer = loadNodePrinter();
  const buffer = await buildTicketBuffer(payload);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout: la cola de Windows no respondio en 20 segundos'));
    }, 20000);

    try {
      printer.printDirect({
        data: buffer,
        printer: SPOOLER_PRINTER_NAME,
        type: 'RAW',   // pasa los bytes ESC/POS sin rasterizar
        success: (jobId) => {
          clearTimeout(timeout);
          logger.info(`Ticket impreso (SPOOLER RAW, jobId=${jobId}): #${payload.orderNumber}`);
          resolve(true);
        },
        error: (err) => {
          clearTimeout(timeout);
          const msg = err && err.message ? err.message : String(err);
          logger.error(`Error en spooler de Windows: ${msg}`);
          reject(new Error(msg));
        },
      });
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
};

/**
 * Lista las impresoras instaladas en Windows.
 * Util para diagnosticar el nombre exacto de SPOOLER_PRINTER_NAME.
 * @returns {Array<{name: string, isDefault?: boolean, status?: string}>}
 */
const listPrinters = () => {
  const printer = loadNodePrinter();
  return printer.getPrinters();
};

module.exports = { printTicket, listPrinters };
