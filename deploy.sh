#!/bin/bash
# ============================================================
# deploy.sh — Rebuild y redeploy del chatbot en el VPS
# Uso: bash deploy.sh
# ============================================================
set -e

COMPOSE_FILE="docker-compose.yml"
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RESET="\033[0m"

echo -e "${BOLD}🚀 Iniciando deploy...${RESET}"
echo ""

# 1. Pull del código
echo -e "${YELLOW}[1/4] Actualizando código...${RESET}"
git pull origin main
echo ""

# 2. Rebuild backend (incluye prisma generate + db push)
echo -e "${YELLOW}[2/4] Reconstruyendo backend...${RESET}"
docker compose -f $COMPOSE_FILE build --no-cache backend
echo ""

# 3. Rebuild backoffice (React build con nuevas páginas)
echo -e "${YELLOW}[3/4] Reconstruyendo backoffice...${RESET}"
docker compose -f $COMPOSE_FILE build --no-cache backoffice
echo ""

# 4. Reiniciar contenedores con cero downtime
echo -e "${YELLOW}[4/4] Reiniciando contenedores...${RESET}"
docker compose -f $COMPOSE_FILE up -d --force-recreate backend backoffice
echo ""

echo -e "${GREEN}${BOLD}✅ Deploy completado.${RESET}"
echo ""
echo "  Backend:    https://app.espino-software.online/api/health"
echo "  Backoffice: https://app.espino-software.online"
echo "  Rider:      https://app.espino-software.online/rider"
echo ""
echo "Logs del backend:"
docker compose -f $COMPOSE_FILE logs --tail=30 backend
