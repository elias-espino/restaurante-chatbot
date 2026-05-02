const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '8h' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken };
};

const login = async (req, res) => {
  try {
    const { email, password, restaurantSlug } = req.body;

    if (!email || !password || !restaurantSlug) {
      return error(res, 'Email, password y restaurante son requeridos', 400);
    }

    const restaurant = await prisma.restaurant.findUnique({ where: { slug: restaurantSlug } });
    if (!restaurant || !restaurant.isActive) {
      return error(res, 'Restaurante no encontrado', 404);
    }

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), restaurantId: restaurant.id, isActive: true },
    });

    if (!user) return error(res, 'Credenciales incorrectas', 401);

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return error(res, 'Credenciales incorrectas', 401);

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const { accessToken, refreshToken } = generateTokens(user.id);

    logger.info(`Login: ${user.email} en ${restaurant.name}`);

    return success(res, {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug, currency: restaurant.currency },
    }, 'Login exitoso');
  } catch (err) {
    logger.error('Error en login:', err);
    return error(res, 'Error interno del servidor', 500);
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return error(res, 'Refresh token requerido', 400);

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await prisma.user.findFirst({ where: { id: decoded.userId, isActive: true } });
    if (!user) return error(res, 'Usuario no válido', 401);

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id);
    return success(res, { accessToken, refreshToken: newRefreshToken }, 'Token renovado');
  } catch (err) {
    return error(res, 'Refresh token inválido o expirado', 401);
  }
};

const me = async (req, res) => {
  const { password, ...userWithoutPassword } = req.user;
  return success(res, userWithoutPassword);
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return error(res, 'Datos incompletos', 400);
    if (newPassword.length < 8) return error(res, 'La nueva contraseña debe tener al menos 8 caracteres', 400);

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return error(res, 'Contraseña actual incorrecta', 400);

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });

    return success(res, {}, 'Contraseña actualizada');
  } catch (err) {
    logger.error('Error en changePassword:', err);
    return error(res, 'Error interno', 500);
  }
};

module.exports = { login, refreshToken, me, changePassword };
