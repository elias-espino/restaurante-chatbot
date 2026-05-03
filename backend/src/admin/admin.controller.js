const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// ── LOGIN SUPERADMIN ────────────────────────────────────────

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return error(res, 'Email y password requeridos', 400);

    if (
      email !== process.env.ADMIN_EMAIL ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      return error(res, 'Credenciales incorrectas', 401);
    }

    const token = jwt.sign(
      { role: 'SUPERADMIN', email },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: '12h' }
    );

    logger.info(`Admin login: ${email}`);
    return success(res, { token }, 'Login exitoso');
  } catch (err) {
    logger.error('Admin login error:', err);
    return error(res, 'Error interno', 500);
  }
};

// ── STATS GLOBALES ──────────────────────────────────────────

const getStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const [
      totalRestaurants,
      activeRestaurants,
      ordersToday,
      revenueToday,
    ] = await Promise.all([
      prisma.restaurant.count(),
      prisma.restaurant.count({ where: { isActive: true } }),
      prisma.order.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: today, lt: tomorrow }, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
    ]);

    return success(res, {
      totalRestaurants,
      activeRestaurants,
      inactiveRestaurants: totalRestaurants - activeRestaurants,
      ordersToday,
      revenueToday: revenueToday._sum.total || 0,
    });
  } catch (err) {
    logger.error('Admin getStats:', err);
    return error(res, 'Error al obtener estadísticas', 500);
  }
};

// ── LISTAR RESTAURANTES ─────────────────────────────────────

const getRestaurants = async (req, res) => {
  try {
    const { search, active } = req.query;

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
        { phone: { contains: search } },
      ];
    }
    if (active !== undefined) where.isActive = active === 'true';

    const restaurants = await prisma.restaurant.findMany({
      where,
      include: {
        _count: { select: { orders: true, users: true, menuItems: true } },
        whatsappConfig: { select: { isActive: true, phoneNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return success(res, restaurants);
  } catch (err) {
    logger.error('Admin getRestaurants:', err);
    return error(res, 'Error al obtener restaurantes', 500);
  }
};

// ── OBTENER UN RESTAURANTE ──────────────────────────────────

const getRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: {
        schedules: true,
        whatsappConfig: { select: { isActive: true, phoneNumber: true, phoneNumberId: true, businessAccountId: true } },
        printers: { select: { id: true, name: true, type: true, isOnline: true, isActive: true } },
        users: { select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true } },
        _count: { select: { orders: true, menuItems: true, categories: true, tables: true } },
      },
    });

    if (!restaurant) return error(res, 'Restaurante no encontrado', 404);
    return success(res, restaurant);
  } catch (err) {
    logger.error('Admin getRestaurant:', err);
    return error(res, 'Error al obtener restaurante', 500);
  }
};

// ── CREAR RESTAURANTE + ADMIN ───────────────────────────────

const createRestaurant = async (req, res) => {
  try {
    const {
      name, slug, address, phone, currency = 'MXN',
      timezone = 'America/Mexico_City',
      adminName, adminEmail, adminPassword,
    } = req.body;

    if (!name || !slug || !adminEmail || !adminPassword) {
      return error(res, 'name, slug, adminEmail y adminPassword son requeridos', 400);
    }

    const slugExists = await prisma.restaurant.findUnique({ where: { slug } });
    if (slugExists) return error(res, 'El slug ya está en uso', 400);

    const restaurant = await prisma.restaurant.create({
      data: { name, slug, address, phone, currency, timezone },
    });

    // Horarios por defecto: Lun-Sab 8am-10pm, Dom cerrado
    for (let day = 0; day <= 6; day++) {
      await prisma.restaurantSchedule.create({
        data: {
          restaurantId: restaurant.id,
          dayOfWeek: day,
          openTime: '08:00',
          closeTime: '22:00',
          isOpen: day !== 0,
        },
      });
    }

    const hashed = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        restaurantId: restaurant.id,
        name: adminName || 'Administrador',
        email: adminEmail.toLowerCase(),
        password: hashed,
        role: 'ADMIN',
      },
    });

    logger.info(`Nuevo restaurante creado: ${name} (${slug})`);
    return success(res, { id: restaurant.id, name: restaurant.name, slug: restaurant.slug }, 'Restaurante creado', 201);
  } catch (err) {
    if (err.code === 'P2002') return error(res, 'El slug o email ya existe', 400);
    logger.error('Admin createRestaurant:', err);
    return error(res, 'Error al crear restaurante', 500);
  }
};

// ── ACTUALIZAR RESTAURANTE ──────────────────────────────────

const updateRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, address, phone, currency, timezone, isActive } = req.body;

    const exists = await prisma.restaurant.findUnique({ where: { id } });
    if (!exists) return error(res, 'Restaurante no encontrado', 404);

    if (slug && slug !== exists.slug) {
      const slugTaken = await prisma.restaurant.findUnique({ where: { slug } });
      if (slugTaken) return error(res, 'El slug ya está en uso por otro restaurante', 400);
    }

    const updated = await prisma.restaurant.update({
      where: { id },
      data: { name, slug, address, phone, currency, timezone, isActive },
    });

    logger.info(`Restaurante actualizado: ${updated.name} — isActive: ${updated.isActive}`);
    return success(res, updated, 'Restaurante actualizado');
  } catch (err) {
    logger.error('Admin updateRestaurant:', err);
    return error(res, 'Error al actualizar restaurante', 500);
  }
};

// ── RESETEAR PASSWORD DE ADMIN DEL RESTAURANTE ─────────────

const resetAdminPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return error(res, 'La contraseña debe tener al menos 8 caracteres', 400);
    }

    const admin = await prisma.user.findFirst({
      where: { restaurantId: id, role: 'ADMIN' },
    });
    if (!admin) return error(res, 'No se encontró usuario admin en este restaurante', 404);

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: admin.id }, data: { password: hashed } });

    logger.info(`Password reseteada para admin de restaurante ${id}`);
    return success(res, {}, 'Contraseña reseteada');
  } catch (err) {
    logger.error('Admin resetAdminPassword:', err);
    return error(res, 'Error al resetear contraseña', 500);
  }
};

module.exports = {
  login,
  getStats,
  getRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant,
  resetAdminPassword,
};
