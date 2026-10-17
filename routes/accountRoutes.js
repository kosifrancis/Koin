
const express = require('express');

const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');

const {
    getMyAccount,
    getMyBalance,
    lookupRecipient
} = require('../controllers/accountController');

router.get('/me', authMiddleware, getMyAccount);

router.get('/balance', authMiddleware, getMyBalance);

router.get(
    '/lookup/:accountNumber', 
    authMiddleware,
    lookupRecipient
);

module.exports = router;
