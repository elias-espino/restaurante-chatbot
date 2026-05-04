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

### Red / WiFi (recomendado)
La impresora se conecta por IP. Más estable y funciona en cualquier sistema operativo sin drivers adicionales.

```env
PRINTER_TYPE=NETWORK
PRINTER_HOST=192.168.1.100
PRINTER_PORT=9100
```

### USB
El agente detecta automáticamente la primera impresora USB conectada.

```env
PRINTER_TYPE=USB
```

> **Mac:** Para USB en Mac instala primero `libusb` vía Homebrew:
> ```bash
> brew install libusb
> ```
> Si tienes problemas de permisos en Mac, usa mejor la conexión por red.

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
│   ├── index.js              # Entrada — lee .env y arranca la conexión
│   ├── client/
│   │   └── socket.client.js  # WebSocket: auth, recepción de jobs, resultados
│   └── printer/
│       └── escpos.printer.js # Formateo e impresión del ticket ESC/POS
├── .env.example
└── package.json
```
