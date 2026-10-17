
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const { sendMoney } = require('../controllers/transferController');

router.post('/', authMiddleware, sendMoney);

module.exports = router;
