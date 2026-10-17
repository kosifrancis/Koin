
const express = require('express');
const router = express.Router();

const {
    signup,
    login,
    getMyProfile,
    changePassword
} = require('../controllers/authController');

const authMiddleware = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiters');

router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);

// Protected profile endpoint
router.get('/me', authMiddleware, getMyProfile);

// Change password while logged in
router.patch('/change-password', authMiddleware, authLimiter, changePassword);

module.exports = router;
