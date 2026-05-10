const axios = require('axios');
const logger = require('../utils/logger');

const BASE_URL = 'https://graph.facebook.com/v18.0';

const sendMessage = async (phoneNumberId, accessToken, to, message) => {
  try {
    const res = await axios.post(
      `${BASE_URL}/${phoneNumberId}/messages`,
      message,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return res.data;
  } catch (err) {
    logger.error('Error enviando mensaje WA:', err.response?.data || err.message);
    throw err;
  }
};

// Texto simple
const sendText = (phoneNumberId, token, to, text) =>
  sendMessage(phoneNumberId, token, to, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text, preview_url: false },
  });

// Botones de respuesta rápida (máximo 3)
const sendButtons = (phoneNumberId, token, to, bodyText, buttons, headerText = null) =>
  sendMessage(phoneNumberId, token, to, {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      ...(headerText && { header: { type: 'text', text: headerText } }),
      body: { text: bodyText },
      action: {
        buttons: buttons.map(btn => ({
          type: 'reply',
          reply: { id: btn.id, title: btn.title.substring(0, 20) },
        })),
      },
    },
  });

// Lista (hasta 10 secciones con múltiples ítems)
const sendList = (phoneNumberId, token, to, bodyText, buttonTitle, sections) =>
  sendMessage(phoneNumberId, token, to, {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonTitle,
        sections,
      },
    },
  });

// Marcar mensaje como leído
const markAsRead = (phoneNumberId, token, messageId) =>
  sendMessage(phoneNumberId, token, null, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  }).catch(() => {}); // No crítico

// Solicitar ubicación al cliente (WhatsApp native location picker)
const sendLocationRequest = (phoneNumberId, token, to, bodyText) =>
  sendMessage(phoneNumberId, token, to, {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'location_request_message',
      body: { text: bodyText },
      action: { name: 'send_location' },
    },
  });

module.exports = { sendText, sendButtons, sendList, markAsRead, sendLocationRequest };
