const router = require('express').Router();
const ctrl = require('./restaurants.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/', ctrl.getRestaurant);
router.put('/', authorize('ADMIN'), ctrl.updateRestaurant);
router.put('/schedules', authorize('ADMIN'), ctrl.updateSchedules);
router.put('/whatsapp', authorize('ADMIN'), ctrl.updateWhatsappConfig);
router.get('/users', authorize('ADMIN'), ctrl.getUsers);
router.post('/users', authorize('ADMIN'), ctrl.createUser);
router.put('/users/:id', authorize('ADMIN'), ctrl.updateUser);
router.get('/tables', ctrl.getTables);
router.post('/tables', authorize('ADMIN'), ctrl.upsertTable);

module.exports = router;
