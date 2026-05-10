/**
 * SerialAdapter
 * --------------
 * Adaptador que envuelve un puerto serie (SerialPort) y expone la misma
 * interfaz que esperan los adapters nativos de la librería `escpos`
 * (open / write / close), de modo que podamos reutilizar `escpos.Printer`
 * sin tocar la cadena de formateo del ticket.
 *
 * Pensado para impresoras térmicas Bluetooth (PT-210, MTP-II, GP-M322B,
 * Goojprt, etc.) que tras emparejarse exponen un puerto COM virtual
 * (Windows) o `/dev/cu.*` / `/dev/tty.*-SPP` (macOS) o `/dev/rfcomm0`
 * (Linux). También sirve para impresoras seriales clásicas RS-232.
 *
 * Uso típico:
 *   const device  = new SerialAdapter('COM5', 9600);
 *   const printer = new escpos.Printer(device, { encoding: 'CP437' });
 *   device.open(err => { ... printer.text('hola').cut().close(); });
 *
 * Auto-discovery:
 *   Si path = 'auto', escanea los puertos del sistema y elige el primero
 *   que parezca una impresora Bluetooth. Resuelto en open().
 */
const { SerialPort } = require('serialport');
const logger = require('../utils/logger');

// Patrones para identificar puertos de impresoras BT al hacer auto-discovery.
// Se aplica al `path` y al `manufacturer` que devuelve SerialPort.list().
const BT_PRINTER_PATTERNS = [
  /printer/i,
  /\bPT[-_]?\d{2,4}\b/i,       // PT-210, PT300, PT_58, etc.
  /\bMTP[-_]?\w+/i,             // MTP-II, MTP-3, MPT-II
  /goojprt/i,
  /thermal/i,
  /-SPP$/i,                     // /dev/cu.MyPrinter-SPP en macOS
  /rfcomm\d+/i,                 // /dev/rfcomm0 en Linux
  /Bluetooth-Incoming-Port/i,
];

/**
 * Lista los puertos serie del sistema. Wrapper para que el script de
 * diagnóstico pueda reusarlo.
 */
async function listSerialPorts() {
  return SerialPort.list();
}

/**
 * Intenta encontrar automáticamente el puerto de la impresora BT.
 * En macOS prefiere /dev/cu.* sobre /dev/tty.* (cu = "call up", el
 * recomendado para conexiones salientes; tty es para entrantes).
 *
 * @returns {Promise<string>} path del puerto encontrado
 * @throws si no encuentra ninguno
 */
async function autoDiscoverPort() {
  const ports = await SerialPort.list();
  if (!ports || ports.length === 0) {
    throw new Error('Auto-discovery: no hay puertos serie disponibles en el sistema.');
  }

  const matches = (port) => {
    const haystack = `${port.path} ${port.manufacturer || ''} ${port.friendlyName || ''} ${port.pnpId || ''}`;
    return BT_PRINTER_PATTERNS.some((re) => re.test(haystack));
  };

  // 1. Mejor candidato: matchea patrones Y es /dev/cu.* (macOS preferido)
  const cuMatch = ports.find((p) => p.path.startsWith('/dev/cu.') && matches(p));
  if (cuMatch) return cuMatch.path;

  // 2. Cualquier match
  const anyMatch = ports.find(matches);
  if (anyMatch) return anyMatch.path;

  // 3. Sin match — listar puertos para que el usuario sepa qué configurar
  const list = ports.map((p) => `  - ${p.path}${p.manufacturer ? ` (${p.manufacturer})` : ''}`).join('\n');
  throw new Error(
    'Auto-discovery: no se detectó ninguna impresora BT entre los puertos disponibles:\n' +
    list +
    '\nConfigura SERIAL_PORT con el path manualmente.'
  );
}

class SerialAdapter {
  /**
   * @param {string} path     - Nombre del puerto, o 'auto' para auto-discovery
   * @param {number} baudRate - Baudios. PT-210 y la mayoría usan 9600.
   */
  constructor(path, baudRate = 9600) {
    this.path = path;
    this.baudRate = baudRate;
    this.port = null;
  }

  /**
   * Abre el puerto serie.
   * @param {(err: Error|null) => void} callback
   */
  open(callback) {
    const doOpen = (resolvedPath) => {
      try {
        this.port = new SerialPort({
          path: resolvedPath,
          baudRate: this.baudRate,
          autoOpen: false,
        });
      } catch (err) {
        return callback(err);
      }

      this.port.open((err) => {
        if (err) {
          logger.error(`SerialAdapter: error abriendo ${resolvedPath} @ ${this.baudRate}: ${err.message}`);
          return callback(err);
        }
        this.path = resolvedPath; // guardar el path real (útil si fue auto)
        logger.info(`SerialAdapter: puerto ${resolvedPath} abierto a ${this.baudRate} bps`);
        callback(null);
      });

      // Si el puerto se cierra inesperadamente (ej. la impresora BT se apaga),
      // logueamos para que el reintento del job lo detecte.
      this.port.on('error', (err) => {
        logger.warn(`SerialAdapter: error en ${resolvedPath}: ${err.message}`);
      });
    };

    // Resolver auto-discovery si corresponde
    if (this.path && this.path.toLowerCase() === 'auto') {
      autoDiscoverPort()
        .then((resolved) => {
          logger.info(`SerialAdapter: auto-discovery seleccionó ${resolved}`);
          doOpen(resolved);
        })
        .catch(callback);
    } else {
      doOpen(this.path);
    }
  }

  /**
   * Escribe un buffer al puerto. La librería escpos usa esta firma.
   * @param {Buffer} data
   * @param {(err: Error|null) => void} [callback]
   */
  write(data, callback = () => {}) {
    if (!this.port || !this.port.isOpen) {
      return callback(new Error('SerialAdapter: el puerto no está abierto'));
    }
    this.port.write(data, (writeErr) => {
      if (writeErr) return callback(writeErr);
      // drain para asegurar que los bytes salen físicamente antes de continuar
      this.port.drain(callback);
    });
  }

  /**
   * Cierra el puerto serie.
   * @param {(err?: Error) => void} [callback]
   */
  close(callback = () => {}) {
    if (!this.port) return callback();
    if (!this.port.isOpen) return callback();

    // Pequeño delay antes de cerrar: algunas térmicas BT pierden los últimos
    // bytes si cerramos inmediatamente después del último write/cut.
    setTimeout(() => {
      this.port.drain(() => {
        this.port.close((err) => {
          if (err) logger.warn(`SerialAdapter: error cerrando ${this.path}: ${err.message}`);
          callback(err);
        });
      });
    }, 200);
  }
}

module.exports = SerialAdapter;
module.exports.listSerialPorts = listSerialPorts;
module.exports.autoDiscoverPort = autoDiscoverPort;
