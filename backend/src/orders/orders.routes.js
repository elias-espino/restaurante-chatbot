const router = require('express').Router();
const ctrl = require('./orders.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/', ctrl.getOrders);
router.get('/dashboard', ctrl.getDashboardStats);
router.get('/report', authorize('ADMIN'), ctrl.getSalesReport);
router.get('/:id', ctrl.getOrder);
router.patch('/:id/status', ctrl.updateOrderStatus);

module.exports = router;
