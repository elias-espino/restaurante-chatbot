# 🖨️ Print Agent — Restaurant Chatbot

Agente local de impresión térmica. Se instala en la computadora del restaurante, se conecta al backend por WebSocket y recibe los tickets automáticamente cuando se confirma una orden.

---

## Requisitos

- Node.js 18+
- Una impresora térmica ESC/POS (USB o red/WiFi)
- El backend del restaurante corriendo y accesible

---

## Configuración paso a paso

### 1. Registrar la impresora en el backoffice

Antes de arrancar el agente, hay que crear la impresora desde el panel:

1. Entra al **backoffice** del restaurante
2. Ve a **Configuración → 🖨️ Impresoras**
3. Haz clic en **Nueva impresora**
4. Ponle un nombre (ej. "Cocina principal"), elige el tipo (Red o USB) y, si es de red, escribe la IP y el puerto (default `9100`)
5. Guarda — el sistema genera un **Agent Token** único automáticamente

### 2. Copiar el Agent Token

En la lista de impresoras verás el token de cada una. Haz clic en el ícono de copiar junto al token.

### 3. Configurar el `.env`

```bash
cp .env.example .env
```

Edita el `.env` y pega el token:

```env
# URL del backend (en producción, la URL de tu servidor)
BACKEND_URL=http://localhost:3000

# Token copiado desde el backoffice > Configuración > Impresoras
AGENT_TOKEN=pega-aqui-el-agent-token

# Tipo de impresora: USB o NETWORK
PRINTER_TYPE=NETWORK

# Solo para NETWORK:
PRINTER_HOST=192.168.1.100
PRINTER_PORT=9100

# Ancho del papel: 32 para 58mm, 42 para 80mm
PAPER_WIDTH=32

# Info del encabezado del ticket
RESTAURANT_NAME=MI RESTAURANTE
RESTAURANT_ADDRESS=Calle Principal 123
RESTAURANT_PHONE=Tel: 555-1234
```

### 4. Instalar dependencias y arrancar

```bash
npm install
npm start
```

Si todo está bien, verás en la terminal:

```
🖨️  Print Agent iniciando...
✅ Conectado al backend (socket: xxxx)
🖨️  Autenticado como: Cocina principal (ID: uuid)
```

Y en el backoffice la impresora aparecerá como **Online** (ícono verde).

---

## Tipos de conexión

El agente soporta **cuatro modos** vía la variable `PRINTER_TYPE`. Todos comparten la misma cadena de formateo del ticket — sólo cambia el transporte.

### 🟢 NETWORK — Red / WiFi / Ethernet (recomendado para cocina fija)
La impresora se conecta por IP. Más estable y funciona en cualquier sistema operativo sin drivers adicionales.

```env
PRINTER_TYPE=NETWORK
PRINTER_HOST=192.168.1.100
PRINTER_PORT=9100
```

### 🟢 USB
El agente detecta automáticamente la primera impresora USB conectada.

```env
PRINTER_TYPE=USB
```

> **Mac:** Para USB en Mac instala primero `libusb` vía Homebrew:
> ```bash
> brew install libusb
> ```
> Si tienes problemas de permisos en Mac, usa mejor la conexión por red.

### 🟡 SERIAL — Bluetooth (PT-210, MTP-II, Goojprt) o RS-232
Útil para impresoras térmicas portátiles que se emparejan por Bluetooth y aparecen en el sistema operativo como un **puerto COM virtual** (Windows) o `/dev/cu.*` / `/dev/tty.*-SPP` (macOS) o `/dev/rfcomm0` (Linux). Sirve también para impresoras con puerto serial clásico.

```env
PRINTER_TYPE=SERIAL
SERIAL_PORT=auto      # auto = detección automática | o pon el path manualmente
SERIAL_BAUD=9600      # PT-210 y la mayoría usan 9600. Algunas Xprinter 19200/38400
ENCODING=CP437        # PT-210 viene en GBK por defecto, fuerza CP437 para acentos
```

> 💡 **Tip:** `npm run list-ports` muestra todos los puertos serie y las impresoras del SO — úsalo para descubrir el path o nombre exacto.

#### Conectar una PT-210 por Bluetooth en Windows
1. Encender la impresora (LED azul parpadeando = visible).
2. **Configuración → Bluetooth y dispositivos → Agregar dispositivo → Bluetooth**.
3. Seleccionar la PT-210 (suele aparecer como `BlueTooth Printer` o `PT-210`). Si pide PIN, usar `0000` o `1234`.
4. Una vez emparejada, abrir **Administrador de dispositivos → Puertos (COM y LPT)** — ahí aparece el COM asignado, ej. `COM5` (Standard Serial over Bluetooth link).
5. Ese número va en `SERIAL_PORT=COM5` del `.env`.
6. Si hay dos COM (entrante y saliente), usar el **saliente**.

#### Conectar una PT-210 por Bluetooth en macOS
1. Encender la impresora (LED azul parpadeando).
2. **Preferencias del Sistema → Bluetooth** (o Configuración del Sistema en Ventura+) → conectar al dispositivo `PT-210` o similar. Si pide PIN, usar `0000` o `1234`.
3. Descubrir el puerto que macOS asignó:
   ```bash
   ls /dev/cu.* /dev/tty.* | grep -i -E 'PT|MTP|SPP|printer|Bluetooth'
   # ejemplo de salida:
   # /dev/cu.PT-210-SerialPort
   # /dev/tty.PT-210-SerialPort
   ```
   Siempre **preferir `cu.*`** sobre `tty.*` (cu = call up, para conexiones salientes).
4. En `.env`:
   ```env
   PRINTER_TYPE=SERIAL
   SERIAL_PORT=/dev/cu.PT-210-SerialPort
   ```
   …o simplemente `SERIAL_PORT=auto` y deja que el agente lo detecte solo.

> ⚠️ **macOS Sonoma/Sequoia:** la primera vez que el proceso abra el puerto BT, macOS pedirá permiso de acceso a Bluetooth. Acepta — queda guardado para siguientes ejecuciones.

#### Conectar una PT-210 por Bluetooth en Linux
```bash
sudo bluetoothctl
[bluetooth]# scan on
[bluetooth]# pair AA:BB:CC:DD:EE:FF
[bluetooth]# trust AA:BB:CC:DD:EE:FF
[bluetooth]# exit

sudo rfcomm bind 0 AA:BB:CC:DD:EE:FF 1
# → /dev/rfcomm0
```

> ⚠️ **Aviso operativo:** las térmicas portátiles tipo PT-210 funcionan con batería y son lentas (~80mm/seg en bitmap, ~200mm/seg en texto). Para un restaurante con cocina fija conviene una impresora de red como la Xprinter XP-T80NL o Epson TM-T20III. La PT-210 es ideal para repartidores o vendedores ambulantes que llevan la impresora encima.

### 🟡 SPOOLER — Cola del SO en modo RAW (Win/Mac/Linux)
Fallback universal cross-platform: si la impresora está instalada en el SO (winspool en Windows, CUPS en macOS/Linux), este modo la encuentra por nombre y le pasa los bytes ESC/POS en modo RAW — **sin rasterizar**, así que la performance es idéntica a los modos nativos.

```env
PRINTER_TYPE=SPOOLER
SPOOLER_PRINTER_NAME=PT-210   # nombre tal como lo ve el SO
```

Para descubrir el nombre exacto:
```bash
npm run list-ports             # multiplataforma
# o:
lpstat -p                      # macOS / Linux
```

Requiere instalar la dependencia opcional (multiplataforma, usa Win32 API en Windows y CUPS en Mac/Linux):
```bash
npm install @grandchef/node-printer
```

Pre-requisitos del compilador (la dep es nativa):
- **Windows:** Visual Studio Build Tools.
- **macOS:** `xcode-select --install` (Xcode Command Line Tools). CUPS viene preinstalado.
- **Linux:** `sudo apt install build-essential libcups2-dev`.

#### Setup macOS para SPOOLER (vía CUPS)
1. **Preferencias del Sistema → Impresoras y escáneres → Agregar impresora**.
2. Seleccionar la PT-210 (debe estar emparejada por Bluetooth o conectada por USB).
3. En el driver elige **"Generic" → "Generic PostScript Printer"** o, mejor, instala el driver del fabricante si lo tiene. Para mandar RAW, el driver concreto importa poco.
4. Validar:
   ```bash
   lpstat -p          # debe listar la impresora
   echo "test" | lp -d PT-210 -o raw   # imprime un test
   ```
5. Poner el mismo nombre en `SPOOLER_PRINTER_NAME`.

> El driver del SO debe soportar el datatype **RAW**. Casi todos los drivers ESC/POS lo soportan (Epson, Xprinter, 3nStar, Bixolon, drivers genéricos de CUPS). Si tu driver solo soporta GDI/PostScript, este modo fallará — usa `SERIAL` en su lugar.

---

## Diagnóstico

```bash
npm run list-ports     # lista puertos serie + impresoras del SO
```

Útil para saber qué poner en `SERIAL_PORT` o `SPOOLER_PRINTER_NAME` antes de arrancar el agente.

---

## Comportamiento ante desconexiones

- Si el agente se desconecta del backend, reintenta automáticamente cada 5 segundos
- Los jobs que llegaron mientras estaba offline quedan en cola con estado `PENDING`
- Al reconectarse, puedes reenviarlos desde el backoffice haciendo clic en el ícono **Reencolar** (↺) junto a la impresora

---

## Desarrollo

```bash
npm run dev   # Usa nodemon — recarga al guardar cambios
```

---

## Estructura

```
print-agent/
├── src/
│   ├── index.js                # Entrada — lee .env y arranca la conexión
│   ├── list-ports.js           # `npm run list-ports` — diagnóstico
│   ├── client/
│   │   └── socket.client.js    # WebSocket: auth, jobs, dispatcher
│   └── printer/
│       ├── escpos.printer.js   # Cadena ESC/POS — modos USB, NETWORK, SERIAL
│       ├── serial.adapter.js   # Wrapper SerialPort + auto-discovery BT
│       └── spooler.printer.js  # Modo SPOOLER (winspool / CUPS, RAW)
├── .env.example
└── package.json
```
