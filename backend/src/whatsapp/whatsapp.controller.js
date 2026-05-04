const { PrismaClient } = require('@prisma/client');
const { handleIncomingMessage } = require('./bot.handler');
const { handleAiMessage } = require('../ai/ai.handler');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// GET /webhook — Verificación del webhook de Meta
const verifyWebhook = async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode !== 'subscribe') return res.status(403).send('Forbidden');

  // Buscar el restaurante que tenga este verify token
  const config = await prisma.whatsappConfig.findFirst({
    where: { webhookVerifyToken: token, isActive: true },
  });

  if (!config) {
    logger.warn(`Webhook verify fallido. Token: ${token}`);
    return res.status(403).send('Forbidden');
  }

  logger.info(`Webhook verificado para restaurante ${config.restaurantId}`);
  return res.status(200).send(challenge);
};

// POST /webhook — Mensajes entrantes de Meta
const handleWebhook = async (req, res) => {
  // Meta espera respuesta 200 inmediata
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        // Encontrar la configuración por phoneNumberId
        const config = await prisma.whatsappConfig.findFirst({
          where: { phoneNumberId, isActive: true },
          include: { restaurant: true },
        });
        if (!config) {
          logger.warn(`No se encontró config para phoneNumberId: ${phoneNumberId}`);
          continue;
        }

        // Procesar mensajes
        for (const message of value.messages || []) {
          if (!['text', 'interactive'].includes(message.type)) continue;

          // Rutear: IA o bot clásico según configuración del restaurante
          if (config.restaurant.aiEnabled) {
            await handleAiMessage(config.restaurant, config, message);
          } else {
            await handleIncomingMessage(config.restaurantId, config, message);
          }
        }
      }
    }
  } catch (err) {
    logger.error('Error procesando webhook:', err);
  }
};

module.exports = { verifyWebhook, handleWebhook };
