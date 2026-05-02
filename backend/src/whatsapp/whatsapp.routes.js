const router = require('express').Router();
const { verifyWebhook, handleWebhook } = require('./whatsapp.controller');

router.get('/', verifyWebhook);
router.post('/', handleWebhook);

module.exports = router;
