
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');

const {
    getMyTransactions,
    getTransactionByReference
} = require('../controllers/transactionController');

router.get('/history', authMiddleware, getMyTransactions);

router.get(
    '/:reference',
    authMiddleware,
    getTransactionByReference
);

module.exports = router;