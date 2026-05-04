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

---

## 🛠️ Guía completa de instalación en producción

Esta sección cubre desde cero la instalación en un servidor Linux con Docker.

### Prerrequisitos del servidor

- Ubuntu 22.04 / Debian 12 o superior
- Docker Engine 24+ y Docker Compose v2
- Dominio apuntando al servidor (registro A en tu DNS)
- Puertos 80 y 443 abiertos en el firewall

```bash
# Verificar versiones
docker --version
docker compose version
```

---

### 1. Clonar el repositorio

```bash
git clone <url-del-repo> restaurant-chatbot
cd restaurant-chatbot
```

---

### 2. Configurar las variables de entorno

Copia el archivo de ejemplo y edítalo con tus valores reales:

```bash
cp .env.example .env
nano .env
```

#### Variables obligatorias del `.env` raíz:

```env
# ── Dominios ──────────────────────────────────────────────
APP_DOMAIN=app.tu-dominio.com        # Subdominio del backoffice
WEB_DOMAIN=tu-dominio.com            # Dominio del sitio web
ACME_EMAIL=tu@email.com              # Email para certificados SSL (Let's Encrypt)

# ── Base de datos ──────────────────────────────────────────
DB_ROOT_PASSWORD=password-root-seguro
DB_NAME=chatbot_db
DB_USER=chatbot
DB_PASSWORD=password-chatbot-seguro

# ── JWT (genera strings aleatorios largos) ─────────────────
JWT_SECRET=genera-un-string-de-64-caracteres-aleatorios
JWT_REFRESH_SECRET=otro-string-diferente-de-64-caracteres

# ── Panel Superadmin (/admin) ──────────────────────────────
ADMIN_EMAIL=superadmin@tu-empresa.com
ADMIN_PASSWORD=password-seguro-para-el-admin
ADMIN_JWT_SECRET=tercer-string-de-64-caracteres-diferente

# ── Asistente IA (Gemini) ──────────────────────────────────
# Obtén tu API key en: https://aistudio.google.com/apikey
GEMINI_API_KEY=AIza...

# ── Entorno ────────────────────────────────────────────────
NODE_ENV=production
```

> **Generar strings seguros:** usa `openssl rand -hex 32` para cada secreto JWT.

---

### 3. Levantar los contenedores

```bash
docker compose up -d
```

Esto levanta: MariaDB, Backend, Backoffice (nginx), Traefik (reverse proxy + SSL).

Verifica que todos los contenedores estén corriendo:

```bash
docker compose ps
```

Deberías ver los 4 servicios en estado `Up`.

---

### 4. Ejecutar las migraciones de base de datos

**Primera instalación** — crea todas las tablas:

```bash
docker compose exec db mariadb -u root -p$DB_ROOT_PASSWORD $DB_NAME \
  < backend/prisma/migrations/20240101000000_add_ai_config/migration.sql
```

O si prefieres hacerlo dentro del contenedor del backend con Prisma:

```bash
docker compose exec backend npx prisma migrate deploy
```

**Migración de IA** (si ya tenías el sistema instalado sin la branch IA):

Esta migración agrega las columnas `aiEnabled` y `aiPersonality` a la tabla `restaurants`.
El `IF NOT EXISTS` hace que sea seguro ejecutarlo aunque ya estuvieran las columnas.

```bash
docker compose exec db mariadb -u root -p$DB_ROOT_PASSWORD $DB_NAME -e \
  "ALTER TABLE restaurants \
   ADD COLUMN IF NOT EXISTS aiEnabled BOOLEAN NOT NULL DEFAULT false, \
   ADD COLUMN IF NOT EXISTS aiPersonality TEXT NULL;"
```

Verifica que las columnas quedaron:

```bash
docker compose exec db mariadb -u root -p$DB_ROOT_PASSWORD $DB_NAME \
  -e "DESCRIBE restaurants;" | grep -E "aiEnabled|aiPersonality"
```

Deberías ver:
```
aiEnabled     | tinyint(1) | NO  | | 0    |
aiPersonality | text       | YES | | NULL |
```

---

### 5. Cargar datos de ejemplo (opcional)

Crea un restaurante demo con menú de ejemplo para probar el sistema:

```bash
docker compose exec backend node prisma/seed.js
```

Credenciales del restaurante demo:
- **Slug:** `restaurante-demo`
- **Email:** `admin@demo.com`
- **Password:** `admin123`

> ⚠️ Elimina o desactiva este restaurante antes de producción real.

---

### 6. Crear el primer cliente real

Accede al panel superadmin:

```
https://app.tu-dominio.com/admin
```

Inicia sesión con `ADMIN_EMAIL` y `ADMIN_PASSWORD` del `.env`.

Ve a **Clientes → Nuevo cliente** y completa:
- Nombre del restaurante
- Slug (ej: `la-taqueria`) — es el identificador de login del cliente
- Email y contraseña del administrador del restaurante

---

### 7. Configurar WhatsApp Business API por cliente

El cliente (o tú como administrador) debe completar esto desde el backoffice:

1. Accede al backoffice del cliente:
   ```
   https://app.tu-dominio.com
   ```
   Login: `la-taqueria` / `admin@cliente.com` / su contraseña

2. Ve a **Configuración → WhatsApp** y llena:

   | Campo | Dónde obtenerlo |
   |-------|----------------|
   | **Phone Number ID** | Meta for Developers → WhatsApp → Configuración |
   | **Número WhatsApp** | El número registrado en Meta Business |
   | **Business Account ID** | Meta Business Manager → Configuración de negocio |
   | **Access Token** | Meta for Developers → Herramientas → Token de acceso del sistema (permanente) |
   | **Webhook Verify Token** | Inventa cualquier string secreto (ej: `mi-token-secreto-123`) |

3. Configura el webhook en Meta for Developers:
   - **URL del Webhook:** `https://app.tu-dominio.com/webhook`
   - **Verify Token:** el mismo que pusiste en el backoffice
   - **Campos suscritos:** `messages`

---

### 8. Configurar el asistente IA (opcional por cliente)

Desde el **panel superadmin** (`/admin`):

1. Ve a **Clientes → [nombre del cliente]**
2. En la sección **Asistente IA**:
   - Activa el toggle **Activar IA**
   - Escribe la personalidad del asistente (tono, estilo, instrucciones especiales)
3. Guarda

También el propio cliente puede hacerlo desde su backoffice en **Configuración → ✨ IA**.

> La IA usa el modelo **Gemini 2.5 Flash** (pago por uso, ~$0.003 USD por orden).
> El tier gratuito de Google AI Studio cubre hasta 1,500 requests/día sin costo.

---

### 9. Configurar impresora térmica en el restaurante

En el equipo físico del restaurante (PC o Raspberry Pi):

```bash
cd print-agent
cp .env.example .env
```

Edita el `.env`:

```env
BACKEND_URL=https://app.tu-dominio.com
AGENT_TOKEN=<token-copiado-del-backoffice>   # Configuración → Impresoras
PRINTER_TYPE=USB                              # o NETWORK
PAPER_WIDTH=42                               # 32 para papel 58mm, 42 para 80mm
RESTAURANT_NAME=La Taquería de Juan
```

El `AGENT_TOKEN` lo encuentras en el backoffice del cliente: **Configuración → Impresoras**.

```bash
npm install
npm start
```

Para correrlo como servicio permanente con PM2:

```bash
npm install -g pm2
pm2 start src/index.js --name print-agent
pm2 save
pm2 startup
```

---

### 10. Verificar que todo funciona

```bash
# Ver logs del backend en tiempo real
docker compose logs -f backend

# Ver logs del backoffice (nginx)
docker compose logs -f backoffice

# Health check del backend
curl https://app.tu-dominio.com/api/../health
```

El backend debe responder:
```json
{ "status": "ok", "timestamp": "..." }
```

---

### Resumen de URLs

| URL | Qué es |
|-----|--------|
| `https://app.tu-dominio.com` | Backoffice del restaurante (login de clientes) |
| `https://app.tu-dominio.com/admin` | Panel superadmin |
| `https://app.tu-dominio.com/admin/login` | Login del superadmin |
| `https://app.tu-dominio.com/webhook` | Webhook de WhatsApp (configurar en Meta) |
| `https://app.tu-dominio.com/health` | Health check del backend |

---

### Comandos útiles de mantenimiento

```bash
# Reiniciar todos los servicios
docker compose restart

# Reiniciar solo el backend
docker compose restart backend

# Ver logs en tiempo real
docker compose logs -f

# Actualizar código y reconstruir
git pull
docker compose up -d --build backend backoffice

# Backup de la base de datos
docker compose exec db mariadb-dump \
  -u root -p$DB_ROOT_PASSWORD $DB_NAME > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker compose exec -T db mariadb \
  -u root -p$DB_ROOT_PASSWORD $DB_NAME < backup_20240101.sql

# Entrar a la DB manualmente
docker compose exec db mariadb -u root -p$DB_ROOT_PASSWORD $DB_NAME
```
