/**
 * mock-printer.js
 * Simula una impresora térmica de red en localhost:9100
 * Recibe los bytes ESC/POS y los muestra como texto en la terminal.
 *
 * Uso:
 *   node src/mock-printer.js
 *
 * Luego configura el .env del agente con:
 *   PRINTER_TYPE=NETWORK
 *   PRINTER_HOST=127.0.0.1
 *   PRINTER_PORT=9100
 */

const net = require('net');

const PORT = parseInt(process.env.MOCK_PORT || '9100');

// Comandos ESC/POS comunes a filtrar (no son texto legible)
const ESCPOS_CMDS = [
  '\x1b@',       // Init
  '\x1ba',       // Align
  '\x1b!',       // Print mode
  '\x1bd',       // Feed lines
  '\x1bm',       // Cut
  '\x1bi',       // Cut
  '\x1dV',       // Cut (GS V)
  '\x1b-',       // Underline
  '\x1bE',       // Bold
  '\x1bG',       // Double-strike
  '\x1b\x21',   // Print mode select
  '\x1d!',       // Select character size
  '\x1dB',       // Black/white reverse
];

function decodeEscPos(buffer) {
  let text = '';
  let i = 0;
  const bytes = Buffer.from(buffer);

  while (i < bytes.length) {
    const byte = bytes[i];

    // ESC sequences
    if (byte === 0x1b || byte === 0x1d) {
      i += 2; // saltar comando + parámetro básico
      continue;
    }

    // Corte de papel → separador visual
    if (byte === 0x0c) {
      text += '\n' + '━'.repeat(42) + ' [CORTE] ' + '━'.repeat(42) + '\n\n';
      i++;
      continue;
    }

    // Newline normal
    if (byte === 0x0a) {
      text += '\n';
      i++;
      continue;
    }

    // Carriage return
    if (byte === 0x0d) {
      i++;
      continue;
    }

    // Bytes imprimibles
    if (byte >= 0x20 && byte <= 0x7e) {
      text += String.fromCharCode(byte);
      i++;
      continue;
    }

    // UTF-8 multibyte
    if (byte >= 0xc0 && byte <= 0xdf && i + 1 < bytes.length) {
      text += bytes.slice(i, i + 2).toString('utf8');
      i += 2;
      continue;
    }
    if (byte >= 0xe0 && byte <= 0xef && i + 2 < bytes.length) {
      text += bytes.slice(i, i + 3).toString('utf8');
      i += 3;
      continue;
    }

    // Otros bytes de control → ignorar
    i++;
  }

  return text;
}

const server = net.createServer((socket) => {
  const addr = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`\n🔌 Agente conectado desde ${addr}`);

  const chunks = [];

  socket.on('data', (chunk) => {
    chunks.push(chunk);
  });

  socket.on('end', () => {
    const raw = Buffer.concat(chunks);
    const decoded = decodeEscPos(raw);

    console.log('\n' + '═'.repeat(50));
    console.log('🖨️  TICKET RECIBIDO');
    console.log('═'.repeat(50));
    console.log(decoded);
    console.log('═'.repeat(50));
    console.log(`📦 Bytes recibidos: ${raw.length}`);
    console.log(`🔌 Conexión cerrada: ${addr}\n`);
  });

  socket.on('error', (err) => {
    console.error(`❌ Error de socket: ${err.message}`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   🖨️  Mock Printer — Modo Simulación      ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`\n✅ Escuchando en localhost:${PORT}`);
  console.log('\nConfigura el .env del print-agent así:');
  console.log('  PRINTER_TYPE=NETWORK');
  console.log('  PRINTER_HOST=127.0.0.1');
  console.log(`  PRINTER_PORT=${PORT}`);
  console.log('\nEsperando tickets...\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Puerto ${PORT} ya está en uso. Cierra el proceso que lo ocupa o usa otro puerto:`);
    console.error(`   MOCK_PORT=9101 node src/mock-printer.js`);
  } else {
    console.error('❌ Error del servidor:', err.message);
  }
  process.exit(1);
});
