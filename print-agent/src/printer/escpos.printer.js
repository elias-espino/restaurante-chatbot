const escpos = require('escpos');
escpos.USB = require('escpos-usb');
escpos.Network = require('escpos-network');
const SerialAdapter = require('./serial.adapter');
const logger = require('../utils/logger');

const PRINTER_TYPE = (process.env.PRINTER_TYPE || 'USB').toUpperCase(); // USB | NETWORK | SERIAL
const PRINTER_HOST = process.env.PRINTER_HOST || '192.168.1.100';
const PRINTER_PORT = parseInt(process.env.PRINTER_PORT || '9100');
const SERIAL_PORT  = process.env.SERIAL_PORT || 'COM5';
const SERIAL_BAUD  = parseInt(process.env.SERIAL_BAUD || '9600');
const PAPER_WIDTH  = parseInt(process.env.PAPER_WIDTH || '32'); // caracteres por línea (58mm=32, 80mm=42)

// Encoding del texto que enviamos a la impresora.
// PT-210 y muchas térmicas BT chinas vienen por defecto en GBK; forzamos CP437
// para que acentos del español salgan correctamente. Override con ENCODING en .env.
const TEXT_ENCODING = process.env.ENCODING || 'CP437';

const getDevice = () => {
  if (PRINTER_TYPE === 'NETWORK') {
    return new escpos.Network(PRINTER_HOST, PRINTER_PORT);
  }
  if (PRINTER_TYPE === 'SERIAL') {
    return new SerialAdapter(SERIAL_PORT, SERIAL_BAUD);
  }
  // USB: escoge el primer dispositivo USB disponible
  const devices = escpos.USB.findPrinter();
  if (!devices || devices.length === 0) throw new Error('No se encontró impresora USB');
  return new escpos.USB(devices[0]);
};

const padEnd = (text, len) => text.substring(0, len).padEnd(len, ' ');

/**
 * Construye el ticket en el printer recibido (cualquier escpos.Printer).
 * Esto está extraído para que el módulo spooler.printer.js pueda reusar
 * la misma cadena de comandos pero apuntada a un BufferAdapter.
 *
 * @param {escpos.Printer} printer
 * @param {object} payload  - Datos del ticket
 * @param {() => void} onDone - Callback que el caller usa para cerrar/recoger output
 */
const buildTicket = (printer, payload, onDone) => {
  const now = new Date(payload.createdAt);
  const dateStr = now.toLocaleDateString('es-MX');
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  printer
    .align('CT')
    .style('B')
    .size(1, 1)
    .text(process.env.RESTAURANT_NAME || 'RESTAURANTE')
    .style('NORMAL')
    .size(0, 0)
    .text(process.env.RESTAURANT_ADDRESS || '')
    .text(process.env.RESTAURANT_PHONE || '')
    .drawLine()

    // Encabezado de la orden
    .align('LT')
    .style('B')
    .text(`ORDEN #${payload.orderNumber}`)
    .style('NORMAL')
    .text(`Fecha : ${dateStr}  ${timeStr}`)
    .text(`Cliente: ${payload.customerName}`)
    .text(`Tel    : ${payload.customerPhone}`)
    .text(`Tipo   : ${payload.serviceTypeLabel}`);

  if (payload.tableNumber) {
    printer.text(`Mesa   : ${payload.tableNumber}`);
  }
  if (payload.deliveryAddress) {
    printer.text(`Dir    : ${payload.deliveryAddress.substring(0, PAPER_WIDTH - 7)}`);
  }

  if (payload.isCustomerTicket) {
    // ── Ticket cliente: con precios ─────────────────────────
    printer
      .drawLine()
      .style('B')
      .text(`${padEnd('DESCRIPCIÓN', PAPER_WIDTH - 12)}${'CANT'.padStart(4)}${'TOTAL'.padStart(8)}`)
      .style('NORMAL')
      .drawLine();

    for (const item of payload.items) {
      const totalStr = `$${item.total.toFixed(2)}`;
      const qtyStr = `x${item.quantity}`;
      const nameWidth = PAPER_WIDTH - qtyStr.length - totalStr.length - 2;
      const name = item.name.substring(0, nameWidth).padEnd(nameWidth);
      printer.text(`${name} ${qtyStr} ${totalStr}`);
      if (item.notes) printer.text(`  * ${item.notes}`);
    }

    printer
      .drawLine()
      .align('RT')
      .style('B')
      .text(`SUBTOTAL: $${payload.subtotal.toFixed(2)}`)
      .text(`TOTAL:    $${payload.total.toFixed(2)}`)
      .style('NORMAL')
      .align('CT')
      .drawLine()
      .text('¡Gracias por su preferencia!')
      .text(' ');
  } else {
    // ── Ticket cocina: sin precios, negrita = esta impresora ─
    printer
      .drawLine()
      .style('B')
      .text(`${padEnd('DESCRIPCIÓN', PAPER_WIDTH - 5)}${'CANT'.padStart(4)}`)
      .style('NORMAL')
      .drawLine();

    for (const item of payload.items) {
      const qtyStr = `x${item.quantity}`;
      const nameWidth = PAPER_WIDTH - qtyStr.length - 1;
      const name = item.name.substring(0, nameWidth).padEnd(nameWidth);
      if (item.isPrimary) {
        printer.style('B').text(`${name} ${qtyStr}`).style('NORMAL');
      } else {
        printer.text(`${name} ${qtyStr}`);
      }
      if (item.notes) printer.text(`  * ${item.notes}`);
    }

    printer
      .drawLine()
      .align('CT')
      .text('*** USO INTERNO ***')
      .text(' ');
  }

  printer.cut().close(onDone);
};

const printTicket = (payload) => {
  return new Promise((resolve, reject) => {
    let device;
    try {
      device = getDevice();
    } catch (err) {
      return reject(err);
    }

    const printer = new escpos.Printer(device, { encoding: TEXT_ENCODING });

    const safeClose = () => { try { device.close(); } catch (_) {} };

    // Timeout de seguridad: si la impresora no responde en 15s, rechazar
    const timeout = setTimeout(() => {
      safeClose();
      reject(new Error('Timeout: la impresora no respondió en 15 segundos'));
    }, 15000);

    device.open((openErr) => {
      if (openErr) {
        clearTimeout(timeout);
        logger.error('Error abriendo dispositivo:', openErr.message || openErr);
        safeClose();
        return reject(openErr);
      }

      try {
        buildTicket(printer, payload, () => {
          clearTimeout(timeout);
          logger.info(`✅ Ticket impreso (${PRINTER_TYPE}): #${payload.orderNumber}`);
          resolve(true);
        });
      } catch (printErr) {
        clearTimeout(timeout);
        logger.error('Error durante impresión:', printErr.message || printErr);
        safeClose();
        reject(printErr);
      }
    });
  });
};

/**
 * BufferAdapter: device "fake" que captura todos los bytes ESC/POS que
 * la cadena de escpos.Printer querría enviar, sin abrir ningún hardware.
 * Lo usa spooler.printer.js para mandar el buffer resultante a la cola
 * del SO (winspool en Windows, CUPS en Mac/Linux) en modo RAW.
 */
class BufferAdapter {
  constructor() { this._chunks = []; }
  open(cb) { this._chunks = []; if (cb) cb(null); }
  write(data, cb) {
    if (data) this._chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
    if (cb) cb(null);
  }
  close(cb) { if (cb) cb(null); }
  getBuffer() { return Buffer.concat(this._chunks); }
}

/**
 * Construye el buffer ESC/POS completo del ticket sin imprimirlo.
 * Útil para mandar al spooler de Windows en modo RAW.
 * @param {object} payload
 * @returns {Promise<Buffer>}
 */
const buildTicketBuffer = (payload) => {
  return new Promise((resolve, reject) => {
    try {
      const device = new BufferAdapter();
      const printer = new escpos.Printer(device, { encoding: TEXT_ENCODING });
      device.open(() => {
        buildTicket(printer, payload, () => {
          resolve(device.getBuffer());
        });
      });
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { printTicket, buildTicketBuffer, PRINTER_TYPE };
