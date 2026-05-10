// Rutas protegidas del módulo Delivery (requieren JWT del backoffice)
const router = require('express').Router();
const ctrl = require('./delivery.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// Riders
router.get('/riders', ctrl.getRiders);
router.post('/riders', ctrl.createRider);
router.patch('/riders/:id', ctrl.updateRider);
router.delete('/riders/:id', ctrl.deleteRider);

// Órdenes de delivery
router.get('/orders', ctrl.getDeliveryOrders);
router.post('/orders/:orderId/assign', ctrl.assignRider);
router.post('/orders/:orderId/unassign', ctrl.unassignRider);

module.exports = router;
