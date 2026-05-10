// Rutas PÚBLICAS del rider (sin JWT — el riderCode es la credencial)
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('./delivery.controller');

// Rate-limit estricto para prevenir fuerza bruta en los códigos hex
const riderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 60,                   // 60 requests por IP
  message: { success: false, message: 'Demasiadas solicitudes. Intenta en 10 minutos.' },
});

// Todas las rutas de rider pasan por validación de código + rate limit
router.use('/:riderCode', riderLimiter, ctrl.validateRiderCode);

router.get('/:riderCode', ctrl.getRiderInfo);
router.post('/:riderCode/status', ctrl.updateRiderOrderStatus);
router.post('/:riderCode/confirm', ctrl.confirmDelivery);

module.exports = router;
