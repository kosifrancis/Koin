
const Account = require('../models/Account');

// GET MY ACCOUNT
exports.getMyAccount = async (req, res) => {
    try {
        const account = await Account.findOne({
            user: req.userId
        }).select('accountNumber balanceKobo createdAt');

        if (!account) {
            return res.status(404).json({
                message: 'Bank account not found.'
            });
        }

        return res.status(200).json({
            message: 'Account retrieved successfully.',
            account: {
                accountNumber: account.accountNumber,
                balanceKobo: account.balanceKobo,
                balanceNaira: (
                    account.balanceKobo / 100
                ).toFixed(2),
                createdAt: account.createdAt
            }
        });
    } catch (error) {
        console.error('Get account error:', error);

        return res.status(500).json({
            message: 'Could not retrieve your account.'
        });
    }
};

// CHECK MY BALANCE
exports.getMyBalance = async (req, res) => {
    try {
        const account = await Account.findOne({
            user: req.userId
        }).select('balanceKobo');

        if (!account) {
            return res.status(404).json({
                message: 'Bank account not found.'
            });
        }

        return res.status(200).json({
            balanceKobo: account.balanceKobo,
            balanceNaira: (
                account.balanceKobo / 100
            ).toFixed(2)
        });
    } catch (error) {
        console.error('Get balance error:', error);

        return res.status(500).json({
            message: 'Could not retrieve your balance.'
        });
    }
};

 // LOOK UP A RECIPIENT
exports.lookupRecipient = async (req, res) => {
    const { accountNumber } = req.params;

    if (!/^\d{10}$/.test(accountNumber)) {
        return res.status(400).json({
            message: 'Enter a valid 10-digit account number.'
        });
    }

    try {
        const account = await Account.findOne({
            accountNumber
        }).populate('user', 'fullName');

        if (!account || !account.user) {
            return res.status(404).json({
                message: 'Koin account not found.'
            });
        }

        return res.status(200).json({
            message: 'Recipient found.',
            recipient: {
                accountName: account.user.fullName,
                accountNumber: account.accountNumber
            }
        });
    } catch (error) {
        console.error('Recipient lookup error:', error);

        return res.status(500).json({
            message: 'Could not look up the recipient.'
        });
    }
};
