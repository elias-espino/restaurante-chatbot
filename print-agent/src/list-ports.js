#!/usr/bin/env node
/**
 * list-ports.js — Windows
 * -------------------------
 * Herramienta de diagnóstico. Muestra:
 *   1) Puertos COM disponibles  → para configurar SERIAL_PORT (PT-210 BT)
 *   2) Impresoras instaladas    → para configurar SPOOLER_PRINTER_NAME
 *
 * Uso:
 *   npm run list-ports
 */
require('dotenv').config();

(async () => {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  PUERTOS COM DISPONIBLES  (PRINTER_TYPE=SERIAL)');
  console.log('══════════════════════════════════════════════════════════════\n');

  try {
    const { listSerialPorts } = require('./printer/serial.adapter');
    const ports = await listSerialPorts();
    if (!ports.length) {
      console.log('  (ninguno detectado)');
      console.log('\n  Tip: asegurate de haber emparejado la PT-210 por Bluetooth');
      console.log('       antes de ejecutar este comando.');
    } else {
      for (const p of ports) {
        const isBT = /bluetooth/i.test(p.friendlyName || '') || /bluetooth/i.test(p.manufacturer || '');
        const tag = isBT ? ' ← posible impresora BT' : '';
        console.log(`  • ${p.path}${tag}`);
        if (p.friendlyName)  console.log(`      Nombre       : ${p.friendlyName}`);
        if (p.manufacturer)  console.log(`      Fabricante   : ${p.manufacturer}`);
        if (p.serialNumber)  console.log(`      Serie        : ${p.serialNumber}`);
      }
    }
  } catch (err) {
    console.error(`  ⚠️  No se pudieron listar los puertos COM: ${err.message}`);
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  IMPRESORAS INSTALADAS EN WINDOWS  (PRINTER_TYPE=SPOOLER)');
  console.log('══════════════════════════════════════════════════════════════\n');

  try {
    const { listPrinters } = require('./printer/spooler.printer');
    const printers = listPrinters();
    if (!printers.length) {
      console.log('  (ninguna detectada)');
    } else {
      for (const p of printers) {
        const def = p.isDefault ? ' [default]' : '';
        const status = p.status ? ` — ${Array.isArray(p.status) ? p.status.join(', ') : p.status}` : '';
        console.log(`  • ${p.name}${def}${status}`);
      }
    }
  } catch (err) {
    console.log(`  ℹ️  ${err.message.split('\n')[0]}`);
    console.log('  (instala @grandchef/node-printer si vas a usar PRINTER_TYPE=SPOOLER)');
  }

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('  Setup PT-210 Bluetooth en Windows:');
  console.log('');
  console.log('  1. Encender PT-210 en modo emparejamiento (FEED ~3 seg)');
  console.log('  2. Windows > Bluetooth > Agregar dispositivo > "PT-210"');
  console.log('  3. El puerto COM aparece en Administrador de dispositivos');
  console.log('     bajo "Puertos (COM y LPT)" como:');
  console.log('     "Standard Serial over Bluetooth link (COMx)"');
  console.log('  4. Configurar en .env:');
  console.log('     PRINTER_TYPE=SERIAL');
  console.log('     SERIAL_PORT=COMx    ← el que encontraste arriba');
  console.log('     SERIAL_BAUD=9600');
  console.log('──────────────────────────────────────────────────────────────\n');
})();
