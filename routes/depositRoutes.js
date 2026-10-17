
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const {
    createDemoDeposit
} = require('../controllers/depositController');

// Development-only simulated deposit
router.post('/demo', authMiddleware, createDemoDeposit);

module.exports = router;
