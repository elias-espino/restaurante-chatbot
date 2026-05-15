/**
 * SerialAdapter — Windows only
 * --------------
 * Adaptador que envuelve un puerto serie (SerialPort) y expone la misma
 * interfaz que esperan los adapters nativos de la librería `escpos`
 * (open / write / close), de modo que podamos reutilizar `escpos.Printer`
 * sin tocar la cadena de formateo del ticket.
 *
 * Pensado para impresoras térmicas Bluetooth en Windows (PT-210, MTP-II,
 * GP-M322B, etc.) que tras emparejarse exponen un puerto COM virtual
 * (ej. COM3, COM5). También sirve para impresoras conectadas por USB
 * que el SO expone como COM.
 *
 * Setup PT-210 en Windows:
 *   1. Encender la PT-210 (mantener FEED hasta que parpadee el LED azul)
 *   2. Windows > Configuración > Bluetooth > Agregar dispositivo
 *      Seleccionar "PT-210" (puede aparecer también como "MTP-II")
 *   3. Administrador de dispositivos > Puertos (COM y LPT):
 *      busca "Standard Serial over Bluetooth link" — ese COMx es el tuyo
 *   4. En .env: SERIAL_PORT=COMx  (ej. COM5)
 *
 * Auto-discovery:
 *   Si SERIAL_PORT=auto, escanea todos los puertos COM y elige el primero
 *   que parezca una impresora Bluetooth por su friendlyName/fabricante.
 */
const { SerialPort } = require('serialport');
const logger = require('../utils/logger');

// Patrones para identificar puertos COM de impresoras BT en Windows.
// Se aplica sobre path, manufacturer, friendlyName y pnpId.
const BT_PRINTER_PATTERNS = [
  /printer/i,
  /\bPT[-_]?\d{2,4}\b/i,       // PT-210, PT300, PT-58, etc.
  /\bMTP[-_]?\w+/i,             // MTP-II, MTP-3, MPT-II
  /goojprt/i,
  /thermal/i,
  /bluetooth.*serial/i,         // "Standard Serial over Bluetooth link"
  /serial.*bluetooth/i,
  /Bluetooth-Incoming-Port/i,
];

/**
 * Lista los puertos COM disponibles en Windows.
 * Wrapper para que list-ports.js lo pueda importar.
 */
async function listSerialPorts() {
  return SerialPort.list();
}

/**
 * Intenta encontrar automáticamente el puerto COM de la impresora BT.
 * En Windows, los COM de Bluetooth suelen tener friendlyName con
 * "Standard Serial over Bluetooth link" o el nombre del dispositivo.
 *
 * @returns {Promise<string>} path del puerto (ej. "COM5")
 * @throws si no encuentra ninguno
 */
async function autoDiscoverPort() {
  const ports = await SerialPort.list();
  if (!ports || ports.length === 0) {
    throw new Error(
      'Auto-discovery: no hay puertos COM disponibles.\n' +
      'Asegurate de haber emparejado la PT-210 por Bluetooth en Windows.'
    );
  }

  const matches = (port) => {
    const haystack = [port.path, port.manufacturer, port.friendlyName, port.pnpId]
      .filter(Boolean).join(' ');
    return BT_PRINTER_PATTERNS.some((re) => re.test(haystack));
  };

  const found = ports.find(matches);
  if (found) {
    logger.info(`Auto-discovery: detectado ${found.path}${found.friendlyName ? ` (${found.friendlyName})` : ''}`);
    return found.path;
  }

  // Sin match — mostrar todos los disponibles para configurar manualmente
  const list = ports.map((p) => {
    const extra = [p.friendlyName, p.manufacturer].filter(Boolean).join(' / ');
    return `  - ${p.path}${extra ? ` (${extra})` : ''}`;
  }).join('\n');

  throw new Error(
    'Auto-discovery: no se detecto ninguna impresora BT en los puertos disponibles:\n' +
    list +
    '\n\nConfigura SERIAL_PORT=COMx manualmente en el .env.\n' +
    'Tip: busca "Standard Serial over Bluetooth link" en Administrador de dispositivos.'
  );
}

class SerialAdapter {
  /**
   * @param {string} path     - Puerto COM (ej. "COM5"), o "auto" para auto-discovery
   * @param {number} baudRate - Baudios. PT-210 usa 9600 por defecto.
   */
  constructor(path, baudRate = 9600) {
    this.path = path;
    this.baudRate = baudRate;
    this.port = null;
  }

  /**
   * Abre el puerto COM.
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
          logger.error(`SerialAdapter: error abriendo ${resolvedPath} @ ${this.baudRate} bps: ${err.message}`);
          return callback(err);
        }
        this.path = resolvedPath;
        logger.info(`SerialAdapter: ${resolvedPath} abierto @ ${this.baudRate} bps`);
        callback(null);
      });

      // Si la impresora BT se apaga o pierde el emparejamiento, logueamos
      // para que el reintento automático del job lo capture.
      this.port.on('error', (err) => {
        logger.warn(`SerialAdapter: error en ${resolvedPath}: ${err.message}`);
      });
    };

    if (this.path && this.path.toLowerCase() === 'auto') {
      autoDiscoverPort()
        .then((resolved) => {
          logger.info(`SerialAdapter: auto-discovery selecciono ${resolved}`);
          doOpen(resolved);
        })
        .catch(callback);
    } else {
      doOpen(this.path);
    }
  }

  /**
   * Escribe un buffer al puerto. Firma compatible con escpos.
   * @param {Buffer} data
   * @param {(err: Error|null) => void} [callback]
   */
  write(data, callback = () => {}) {
    if (!this.port || !this.port.isOpen) {
      return callback(new Error('SerialAdapter: el puerto no esta abierto'));
    }
    this.port.write(data, (writeErr) => {
      if (writeErr) return callback(writeErr);
      // drain: espera a que los bytes salgan físicamente antes de continuar
      this.port.drain(callback);
    });
  }

  /**
   * Cierra el puerto COM.
   * @param {(err?: Error) => void} [callback]
   */
  close(callback = () => {}) {
    if (!this.port || !this.port.isOpen) return callback();

    // Delay antes de cerrar: algunas térmicas BT pierden los últimos bytes
    // si cerramos inmediatamente tras el corte de papel.
    setTimeout(() => {
      this.port.drain(() => {
        this.port.close((err) => {
          if (err) logger.warn(`SerialAdapter: error cerrando ${this.path}: ${err.message}`);
          callback(err);
        });
      });
    }, 300);
  }
}

module.exports = SerialAdapter;
module.exports.listSerialPorts = listSerialPorts;
module.exports.autoDiscoverPort = autoDiscoverPort;
