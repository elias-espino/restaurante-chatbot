const { PrismaClient } = require('@prisma/client');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

const getRestaurant = async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.restaurantId },
      include: { schedules: true, whatsappConfig: true, printers: true, tables: true },
    });
    return success(res, restaurant);
  } catch (err) {
    return error(res, 'Error al obtener restaurante', 500);
  }
};

const updateRestaurant = async (req, res) => {
  try {
    const { name, address, phone, currency, timezone, logoUrl } = req.body;
    const updated = await prisma.restaurant.update({
      where: { id: req.restaurantId },
      data: { name, address, phone, currency, timezone, logoUrl },
    });
    return success(res, updated, 'Restaurante actualizado');
  } catch (err) {
    return error(res, 'Error al actualizar', 500);
  }
};

const updateSchedules = async (req, res) => {
  try {
    const { schedules } = req.body;
    for (const s of schedules) {
      await prisma.restaurantSchedule.upsert({
        where: { restaurantId_dayOfWeek: { restaurantId: req.restaurantId, dayOfWeek: s.dayOfWeek } },
        create: { restaurantId: req.restaurantId, ...s },
        update: { openTime: s.openTime, closeTime: s.closeTime, isOpen: s.isOpen },
      });
    }
    return success(res, {}, 'Horarios actualizados');
  } catch (err) {
    return error(res, 'Error al actualizar horarios', 500);
  }
};

const updateWhatsappConfig = async (req, res) => {
  try {
    const { phoneNumberId, phoneNumber, accessToken, webhookVerifyToken, businessAccountId, welcomeMessage } = req.body;
    const config = await prisma.whatsappConfig.upsert({
      where: { restaurantId: req.restaurantId },
      create: { restaurantId: req.restaurantId, phoneNumberId, phoneNumber, accessToken, webhookVerifyToken, businessAccountId, welcomeMessage },
      update: { phoneNumberId, phoneNumber, accessToken, webhookVerifyToken, businessAccountId, welcomeMessage },
    });
    return success(res, config, 'Configuración WhatsApp actualizada');
  } catch (err) {
    return error(res, 'Error al actualizar configuración', 500);
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { restaurantId: req.restaurantId },
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    });
    return success(res, users);
  } catch (err) {
    return error(res, 'Error al obtener usuarios', 500);
  }
};

const createUser = async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return error(res, 'Datos incompletos', 400);

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { restaurantId: req.restaurantId, name, email: email.toLowerCase(), password: hashed, role: role || 'STAFF' },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    return success(res, user, 'Usuario creado', 201);
  } catch (err) {
    if (err.code === 'P2002') return error(res, 'El email ya existe', 400);
    return error(res, 'Error al crear usuario', 500);
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, isActive } = req.body;
    const updated = await prisma.user.update({
      where: { id },
      data: { name, role, isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    return success(res, updated, 'Usuario actualizado');
  } catch (err) {
    return error(res, 'Error al actualizar usuario', 500);
  }
};

const getTables = async (req, res) => {
  try {
    const tables = await prisma.table.findMany({
      where: { restaurantId: req.restaurantId },
      orderBy: { number: 'asc' },
    });
    return success(res, tables);
  } catch (err) {
    return error(res, 'Error al obtener mesas', 500);
  }
};

const upsertTable = async (req, res) => {
  try {
    const { number, capacity } = req.body;
    const table = await prisma.table.upsert({
      where: { restaurantId_number: { restaurantId: req.restaurantId, number } },
      create: { restaurantId: req.restaurantId, number, capacity: capacity || 4 },
      update: { capacity },
    });
    return success(res, table, 'Mesa guardada', 201);
  } catch (err) {
    return error(res, 'Error al guardar mesa', 500);
  }
};

const getAiConfig = async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.restaurantId },
      select: { aiEnabled: true, aiPersonality: true },
    });
    return success(res, restaurant);
  } catch (err) {
    return error(res, 'Error al obtener configuración IA', 500);
  }
};

const updateAiConfig = async (req, res) => {
  try {
    const { aiEnabled, aiPersonality } = req.body;
    const updated = await prisma.restaurant.update({
      where: { id: req.restaurantId },
      data: { aiEnabled, aiPersonality },
      select: { aiEnabled: true, aiPersonality: true },
    });
    return success(res, updated, 'Configuración IA actualizada');
  } catch (err) {
    return error(res, 'Error al actualizar configuración IA', 500);
  }
};

const getDeliveryConfig = async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.restaurantId },
      select: { deliveryLocationEnabled: true },
    });
    return success(res, restaurant);
  } catch (err) {
    return error(res, 'Error al obtener configuración de delivery', 500);
  }
};

const updateDeliveryConfig = async (req, res) => {
  try {
    const { deliveryLocationEnabled } = req.body;
    const updated = await prisma.restaurant.update({
      where: { id: req.restaurantId },
      data: { deliveryLocationEnabled: Boolean(deliveryLocationEnabled) },
      select: { deliveryLocationEnabled: true },
    });
    return success(res, updated, 'Configuración Delivery actualizada');
  } catch (err) {
    return error(res, 'Error al actualizar configuración de delivery', 500);
  }
};

const getTicketConfig = async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.restaurantId },
      select: { customerTicketPrinterId: true },
    });
    return success(res, restaurant);
  } catch (err) {
    return error(res, 'Error al obtener configuración de ticket', 500);
  }
};

const updateTicketConfig = async (req, res) => {
  try {
    const { customerTicketPrinterId } = req.body;
    if (customerTicketPrinterId) {
      const printer = await prisma.printer.findFirst({
        where: { id: customerTicketPrinterId, restaurantId: req.restaurantId },
      });
      if (!printer) return error(res, 'Impresora no encontrada', 404);
    }
    const updated = await prisma.restaurant.update({
      where: { id: req.restaurantId },
      data: { customerTicketPrinterId: customerTicketPrinterId || null },
      select: { customerTicketPrinterId: true },
    });
    return success(res, updated, 'Configuración de ticket actualizada');
  } catch (err) {
    return error(res, 'Error al actualizar configuración de ticket', 500);
  }
};

module.exports = { getRestaurant, updateRestaurant, updateSchedules, updateWhatsappConfig, getUsers, createUser, updateUser, getTables, upsertTable, getAiConfig, updateAiConfig, getDeliveryConfig, updateDeliveryConfig, getTicketConfig, updateTicketConfig };
