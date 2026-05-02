const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { error } = require('../utils/response');

const prisma = new PrismaClient();

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'Token de acceso requerido', 401);
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findFirst({
      where: { id: decoded.userId, isActive: true },
      include: { restaurant: { select: { id: true, name: true, slug: true, isActive: true } } },
    });

    if (!user || !user.restaurant.isActive) {
      return error(res, 'Usuario no encontrado o inactivo', 401);
    }

    req.user = user;
    req.restaurantId = user.restaurantId;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return error(res, 'Token expirado', 401);
    if (err.name === 'JsonWebTokenError') return error(res, 'Token inválido', 401);
    return error(res, 'Error de autenticación', 500);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return error(res, 'No tienes permisos para esta acción', 403);
    }
    next();
  };
};

// Middleware para webhook de WhatsApp (sin JWT, usa verify token)
const authenticateWebhook = (req, res, next) => {
  // La verificación del webhook se hace en el controller
  next();
};

module.exports = { authenticate, authorize, authenticateWebhook };
