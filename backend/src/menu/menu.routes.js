const router = require('express').Router();
const ctrl = require('./menu.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Público
router.get('/public/:restaurantId', ctrl.getPublicMenu);

// Protegido
router.use(authenticate);
router.get('/categories', ctrl.getCategories);
router.post('/categories', authorize('ADMIN'), ctrl.createCategory);
router.put('/categories/:id', authorize('ADMIN'), ctrl.updateCategory);
router.delete('/categories/:id', authorize('ADMIN'), ctrl.deleteCategory);

router.get('/items', ctrl.getItems);
router.post('/items', authorize('ADMIN'), ctrl.createItem);
router.put('/items/:id', authorize('ADMIN'), ctrl.updateItem);
router.patch('/items/:id/toggle', authorize('ADMIN', 'STAFF'), ctrl.toggleAvailability);
router.delete('/items/:id', authorize('ADMIN'), ctrl.deleteItem);

module.exports = router;
