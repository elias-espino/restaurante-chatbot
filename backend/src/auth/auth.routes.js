const router = require('express').Router();
const { login, refreshToken, me, changePassword } = require('./auth.controller');
const { authenticate } = require('../middleware/auth');

router.post('/login', login);
router.post('/refresh', refreshToken);
router.get('/me', authenticate, me);
router.put('/change-password', authenticate, changePassword);

module.exports = router;
