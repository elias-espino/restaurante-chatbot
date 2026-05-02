const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// Estados de la conversación
const STATES = {
  GREETING:     'GREETING',
  MENU:         'MENU',
  CATEGORY:     'CATEGORY',
  CART:         'CART',
  SERVICE_TYPE: 'SERVICE_TYPE',
  TABLE_NUMBER: 'TABLE_NUMBER',
  DELIVERY_ADDR:'DELIVERY_ADDR',
  CUSTOMER_NAME:'CUSTOMER_NAME',
  CONFIRM:      'CONFIRM',
  DONE:         'DONE',
};

const SESSION_EXPIRY_MINUTES = 30;

const getSession = async (restaurantId, phoneNumber) => {
  let session = await prisma.conversationSession.findUnique({
    where: { restaurantId_phoneNumber: { restaurantId, phoneNumber } },
  });

  if (!session || new Date() > session.expiresAt) {
    // Crear o reiniciar sesión
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MINUTES * 60 * 1000);
    session = await prisma.conversationSession.upsert({
      where: { restaurantId_phoneNumber: { restaurantId, phoneNumber } },
      create: {
        restaurantId,
        phoneNumber,
        state: STATES.GREETING,
        cart: [],
        data: {},
        expiresAt,
      },
      update: {
        state: STATES.GREETING,
        cart: [],
        data: {},
        expiresAt,
      },
    });
    logger.info(`Nueva sesión: ${phoneNumber} en restaurante ${restaurantId}`);
  }

  return session;
};

const updateSession = async (restaurantId, phoneNumber, updates) => {
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MINUTES * 60 * 1000);
  return prisma.conversationSession.update({
    where: { restaurantId_phoneNumber: { restaurantId, phoneNumber } },
    data: { ...updates, expiresAt },
  });
};

const addToCart = async (session, item) => {
  const cart = Array.isArray(session.cart) ? session.cart : [];
  const existingIdx = cart.findIndex(i => i.menuItemId === item.menuItemId);
  if (existingIdx >= 0) {
    cart[existingIdx].quantity += item.quantity || 1;
  } else {
    cart.push({ ...item, quantity: item.quantity || 1 });
  }
  return cart;
};

const removeFromCart = async (session, index) => {
  const cart = Array.isArray(session.cart) ? [...session.cart] : [];
  cart.splice(index, 1);
  return cart;
};

const getCartTotal = (cart) => {
  return cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
};

// Símbolos por moneda
const CURRENCY_SYMBOLS = {
  MXN: 'MXN $',
  GTQ: 'Q',
  HNL: 'L',
  NIO: 'C$',
  CRC: '₡',
  PAB: 'B/.',
  BZD: 'BZ$',
  USD: '$',
  COP: 'COP $',
  PEN: 'S/',
  ARS: 'ARS $',
  CLP: 'CLP $',
};

const formatPrice = (amount, currency = 'MXN') => {
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  return `${symbol}${Number(amount).toFixed(2)}`;
};

const formatCartSummary = (cart, currency = 'MXN') => {
  if (!cart || cart.length === 0) return 'Tu carrito está vacío.';
  let text = '🛒 *Tu orden:*\n\n';
  cart.forEach((item, idx) => {
    const subtotal = formatPrice(Number(item.price) * item.quantity, currency);
    const unitPrice = formatPrice(item.price, currency);
    text += `${idx + 1}. *${item.name}*\n`;
    text += `   ${unitPrice} x${item.quantity} = ${subtotal}\n`;
    if (item.notes) text += `   _Nota: ${item.notes}_\n`;
    text += '\n';
  });
  text += `*Total: ${formatPrice(getCartTotal(cart), currency)}*`;
  return text;
};

module.exports = { STATES, getSession, updateSession, addToCart, removeFromCart, getCartTotal, formatCartSummary, formatPrice };
