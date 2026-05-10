/**
 * spooler.printer.js
 * --------------------
 * Imprime el ticket usando la cola del sistema operativo en modo RAW:
 *   • Windows → spooler nativo (winspool)
 *   • macOS   → CUPS
 *   • Linux   → CUPS
 *
 * Es el fallback universal: si la impresora aparece en el SO (emparejada
 * por Bluetooth, conectada por USB, compartida en red, etc.), este modo
 * la encuentra por nombre y le pasa los bytes ESC/POS sin rasterizar —
 * performance idéntica al modo nativo escpos-usb / escpos-network.
 *
 * Requiere `@grandchef/node-printer` (multiplataforma, usa Win32 API en
 * Windows y CUPS en Mac/Linux). Solo se carga si PRINTER_TYPE=SPOOLER.
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
      'Módulo @grandchef/node-printer no instalado. Para usar PRINTER_TYPE=SPOOLER:\n' +
      '  npm install @grandchef/node-printer\n' +
      '  Windows: requiere Visual Studio Build Tools.\n' +
      '  macOS:   requiere Xcode Command Line Tools (xcode-select --install) y CUPS (preinstalado).\n' +
      '  Linux:   requiere build-essential, libcups2-dev.'
    );
  }
  return nodePrinter;
};

const printTicket = async (payload) => {
  if (!SPOOLER_PRINTER_NAME) {
    throw new Error(
      'SPOOLER_PRINTER_NAME no configurado en .env. Cómo obtener el nombre exacto:\n' +
      '  Windows: Panel de Control > Dispositivos e impresoras\n' +
      '  macOS:   `lpstat -p` en Terminal, o Preferencias del Sistema > Impresoras\n' +
      '  Linux:   `lpstat -p`'
    );
  }

  const printer = loadNodePrinter();
  const buffer = await buildTicketBuffer(payload);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout: la cola del SO no respondió en 20 segundos'));
    }, 20000);

    try {
      printer.printDirect({
        data: buffer,
        printer: SPOOLER_PRINTER_NAME,
        type: 'RAW',          // ← clave: pasa los bytes ESC/POS sin rasterizar
        success: (jobId) => {
          clearTimeout(timeout);
          logger.info(`✅ Ticket impreso (SPOOLER RAW, jobId=${jobId}): #${payload.orderNumber}`);
          resolve(true);
        },
        error: (err) => {
          clearTimeout(timeout);
          const msg = err && err.message ? err.message : String(err);
          logger.error(`Error en spooler del SO: ${msg}`);
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
 * Lista las impresoras instaladas en el SO. Útil para depurar el nombre
 * exacto que hay que poner en SPOOLER_PRINTER_NAME.
 * @returns {Array<{name: string, isDefault?: boolean, status?: string}>}
 */
const listPrinters = () => {
  const printer = loadNodePrinter();
  return printer.getPrinters();
};

module.exports = { printTicket, listPrinters };
