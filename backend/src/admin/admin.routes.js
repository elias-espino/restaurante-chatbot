const router = require('express').Router();
const ctrl = require('./admin.controller');
const { authenticateAdmin } = require('./admin.middleware');

// Pública: login del superadmin
router.post('/login', ctrl.login);

// Todas las rutas siguientes requieren token de superadmin
router.use(authenticateAdmin);

router.get('/stats', ctrl.getStats);

router.get('/restaurants', ctrl.getRestaurants);
router.post('/restaurants', ctrl.createRestaurant);
router.get('/restaurants/:id', ctrl.getRestaurant);
router.put('/restaurants/:id', ctrl.updateRestaurant);
router.post('/restaurants/:id/reset-password', ctrl.resetAdminPassword);

module.exports = router;
