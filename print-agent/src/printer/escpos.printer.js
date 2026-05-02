const escpos = require('escpos');
escpos.USB = require('escpos-usb');
escpos.Network = require('escpos-network');
const logger = require('../utils/logger');

const PRINTER_TYPE = process.env.PRINTER_TYPE || 'USB'; // 'USB' o 'NETWORK'
const PRINTER_HOST = process.env.PRINTER_HOST || '192.168.1.100';
const PRINTER_PORT = parseInt(process.env.PRINTER_PORT || '9100');
const PAPER_WIDTH = parseInt(process.env.PAPER_WIDTH || '32'); // caracteres por línea (58mm=32, 80mm=42)

const getDevice = () => {
  if (PRINTER_TYPE === 'NETWORK') {
    return new escpos.Network(PRINTER_HOST, PRINTER_PORT);
  }
  // USB: escoge el primer dispositivo USB disponible
  const devices = escpos.USB.findPrinter();
  if (!devices || devices.length === 0) throw new Error('No se encontró impresora USB');
  return new escpos.USB(devices[0]);
};

const line = (char = '─') => char.repeat(PAPER_WIDTH);
const center = (text, width = PAPER_WIDTH) => {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(pad) + text;
};
const padEnd = (text, len) => text.substring(0, len).padEnd(len, ' ');
const padStart = (text, len) => String(text).padStart(len, ' ');

const printTicket = (payload) => {
  return new Promise((resolve, reject) => {
    let device;
    try {
      device = getDevice();
    } catch (err) {
      return reject(err);
    }

    const printer = new escpos.Printer(device, { encoding: 'utf8' });

    device.open((openErr) => {
      if (openErr) {
        logger.error('Error abriendo dispositivo:', openErr);
        return reject(openErr);
      }

      try {
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

        printer
          .drawLine()
          .style('B')
          .text(`${padEnd('DESCRIPCIÓN', PAPER_WIDTH - 12)}${'CANT'.padStart(4)}${'TOTAL'.padStart(8)}`)
          .style('NORMAL')
          .drawLine();

        // Items
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
          .text(' ')
          .cut()
          .close(() => {
            logger.info(`✅ Ticket impreso: #${payload.orderNumber}`);
            resolve(true);
          });

      } catch (printErr) {
        logger.error('Error durante impresión:', printErr);
        try { device.close(); } catch (_) {}
        reject(printErr);
      }
    });
  });
};

module.exports = { printTicket };
