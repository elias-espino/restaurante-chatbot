const jwt = require('jsonwebtoken');
const { error } = require('../utils/response');

const authenticateAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'Token de admin requerido', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);

    if (decoded.role !== 'SUPERADMIN') {
      return error(res, 'Acceso denegado', 403);
    }

    req.isSuperAdmin = true;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return error(res, 'Token expirado', 401);
    if (err.name === 'JsonWebTokenError') return error(res, 'Token inválido', 401);
    return error(res, 'Error de autenticación', 500);
  }
};

module.exports = { authenticateAdmin };
