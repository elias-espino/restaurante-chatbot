#!/usr/bin/env node
/**
 * list-ports.js
 * --------------
 * Comando de diagnóstico. Lista:
 *   1) Los puertos serie disponibles en el sistema (para SERIAL_PORT)
 *   2) Las impresoras instaladas en el SO          (para SPOOLER_PRINTER_NAME)
 *
 * Uso:
 *   npm run list-ports
 *
 * Sirve sobre todo en macOS para descubrir el path de la impresora BT
 * tras emparejarla, y en cualquier SO para ver el nombre exacto de la
 * impresora en la cola del SO.
 */
require('dotenv').config();

(async () => {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  PUERTOS SERIE DISPONIBLES (para PRINTER_TYPE=SERIAL)');
  console.log('══════════════════════════════════════════════════════════════\n');

  try {
    const { listSerialPorts } = require('./printer/serial.adapter');
    const ports = await listSerialPorts();
    if (!ports.length) {
      console.log('  (ninguno detectado)');
    } else {
      for (const p of ports) {
        console.log(`  • ${p.path}`);
        if (p.manufacturer)  console.log(`      manufacturer : ${p.manufacturer}`);
        if (p.friendlyName)  console.log(`      friendlyName : ${p.friendlyName}`);
        if (p.serialNumber)  console.log(`      serial       : ${p.serialNumber}`);
        if (p.vendorId)      console.log(`      VID:PID      : ${p.vendorId}:${p.productId || '?'}`);
      }
    }
  } catch (err) {
    console.error(`  ⚠️  No se pudieron listar los puertos serie: ${err.message}`);
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  IMPRESORAS INSTALADAS EN EL SO (para PRINTER_TYPE=SPOOLER)');
  console.log('══════════════════════════════════════════════════════════════\n');

  try {
    const { listPrinters } = require('./printer/spooler.printer');
    const printers = listPrinters();
    if (!printers.length) {
      console.log('  (ninguna detectada)');
    } else {
      for (const p of printers) {
        const def = p.isDefault ? ' [default]' : '';
        const status = p.status ? ` — ${Array.isArray(p.status) ? p.status.join(',') : p.status}` : '';
        console.log(`  • ${p.name}${def}${status}`);
      }
    }
  } catch (err) {
    console.log(`  ℹ️  ${err.message.split('\n')[0]}`);
    console.log('  (instala @grandchef/node-printer si vas a usar PRINTER_TYPE=SPOOLER)');
  }

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('Tips:');
  console.log('  • macOS PT-210 vía Bluetooth → suele aparecer como /dev/cu.<nombre>-SPP');
  console.log('  • macOS — `lpstat -p` también lista impresoras de CUPS');
  console.log('  • Windows BT → "Standard Serial over Bluetooth link" en Device Manager');
  console.log('  • Linux  BT → necesita `rfcomm bind 0 <MAC> 1` antes\n');
})();
