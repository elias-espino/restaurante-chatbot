# 🍽️ Restaurant Chatbot — WhatsApp + Impresora Térmica

Sistema completo para restaurantes: toma órdenes por WhatsApp, imprime tickets en impresora térmica y gestiona todo desde un backoffice web.

---

## 📁 Estructura del proyecto

```
restaurant-chatbot/
├── backend/          # API Node.js + Express + Prisma + Socket.io
├── print-agent/      # Agente local de impresión (corre en el restaurante)
├── backoffice/       # Frontend React + Vite + Tailwind
└── docker-compose.yml
```

---

## 🚀 Inicio rápido (desarrollo local)

### 1. Prerrequisitos
- Node.js 20+
- MariaDB 11 corriendo localmente (o usar Docker)
- Cuenta Meta Business con WhatsApp Cloud API

### 2. Base de datos con Docker
```bash
docker run -d \
  --name chatbot_db \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=chatbot_db \
  -e MYSQL_USER=chatbot \
  -e MYSQL_PASSWORD=chatbot_pass \
  -p 3306:3306 \
  mariadb:11
```

### 3. Backend
```bash
cd backend
cp .env.example .env
# Edita .env con tus valores
npm install
npx prisma migrate dev --name init
npx prisma db seed        # Carga datos de ejemplo
npm run dev               # Puerto 3000
```

### 4. Backoffice
```bash
cd backoffice
npm install
npm run dev               # Puerto 5173
```

Accede en: `http://localhost:5173`
Login demo: `restaurante-demo` / `admin@demo.com` / `admin123`

### 5. Print Agent (en el restaurante)
```bash
cd print-agent
cp .env.example .env
# Edita .env con AGENT_TOKEN (desde Backoffice > Configuración > Impresoras)
npm install
npm start
```

---

## 🐳 Producción con Docker Compose

```bash
cp .env.example .env
# Edita .env con valores de producción

docker-compose up -d

# Primera vez: migraciones y seed
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend node prisma/seed.js
```

---

## 📱 Configurar WhatsApp Business API

1. Crea una app en [Meta for Developers](https://developers.facebook.com)
2. Agrega el producto **WhatsApp**
3. Configura el webhook:
   - **URL**: `https://tu-dominio.com/webhook`
   - **Verify Token**: el que pongas en el backoffice
   - **Eventos**: `messages`
4. En el Backoffice → Configuración → WhatsApp, ingresa:
   - Phone Number ID
   - Access Token
   - Business Account ID
   - Verify Token

> Para desarrollo local, usa [ngrok](https://ngrok.com): `ngrok http 3000`

---

## 🖨️ Configurar Print Agent

### USB
1. Conecta la impresora por USB al equipo del restaurante
2. Copia el `agentToken` desde Backoffice → Configuración → Impresoras
3. Configura `.env` del print-agent
4. Ejecuta: `npm start`

### Red (WiFi/Ethernet)
```env
PRINTER_TYPE=NETWORK
PRINTER_HOST=192.168.1.100   # IP de la impresora
PRINTER_PORT=9100
```

### Impresoras compatibles
Cualquier impresora con protocolo **ESC/POS**: Epson TM-T20, TM-T88, Star TSP, Bixolon SRP, etc.

---

## 🔑 Roles de usuario

| Rol    | Acceso |
|--------|--------|
| ADMIN  | Todo: menú, órdenes, reportes, configuración, usuarios |
| STAFF  | Órdenes y cambio de disponibilidad de items |
| VIEWER | Solo reportes y dashboard |

---

## 🌐 Flujo del bot WhatsApp

```
Cliente escribe → Bot saluda y pide nombre
→ Muestra menú por categorías (lista interactiva)
→ Cliente agrega items al carrito
→ Elige tipo: Mesa / Para llevar / Domicilio
→ Confirma la orden → Se imprime ticket en cocina
→ Bot confirma con número de orden
```

---

## 🔧 Variables de entorno

### backend/.env
| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL de conexión MariaDB |
| `JWT_SECRET` | Secreto para tokens de acceso |
| `JWT_REFRESH_SECRET` | Secreto para refresh tokens |
| `PORT` | Puerto del servidor (default: 3000) |
| `FRONTEND_URL` | URL del backoffice (para CORS) |

### print-agent/.env
| Variable | Descripción |
|----------|-------------|
| `BACKEND_URL` | URL del backend |
| `AGENT_TOKEN` | Token de la impresora (desde el backoffice) |
| `PRINTER_TYPE` | `USB` o `NETWORK` |
| `PAPER_WIDTH` | `32` para 58mm, `42` para 80mm |
| `RESTAURANT_NAME` | Nombre en el encabezado del ticket |
