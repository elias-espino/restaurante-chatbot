const router = require('express').Router();
const ctrl = require('./incidents.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.getIncidencias);
router.get('/:id', ctrl.getIncidencia);
router.post('/:id/respond', ctrl.respondIncidencia);
router.patch('/:id/close', ctrl.closeIncidencia);

module.exports = router;
