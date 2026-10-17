
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

exports.getMyTransactions = async (req, res) => {
    try {
        const account = await Account.findOne({
            user: req.userId
        }).select('_id');

        if (!account) {
            return res.status(404).json({
                message: 'Bank account not found.'
            });
        }

        const requestedPage = Number.parseInt(req.query.page, 10);
        const requestedLimit = Number.parseInt(req.query.limit, 10);

        const page =
            Number.isSafeInteger(requestedPage) && requestedPage > 0
                ? requestedPage
                : 1;

        const limit =
            Number.isSafeInteger(requestedLimit) && requestedLimit > 0
                ? Math.min(requestedLimit, 50)
                : 20;

        const filter = {
            $or: [
                { sender: account._id },
                { recipient: account._id }
            ]
        };

        const [transactions, total] = await Promise.all([
            Transaction.find(filter)
                .populate('sender', 'accountNumber')
                .populate('recipient', 'accountNumber')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),

            Transaction.countDocuments(filter)
        ]);

        const history = transactions.map(transaction => {
            const isDeposit = transaction.type === 'deposit';

            const isSender =
                !isDeposit &&
                transaction.sender &&
                transaction.sender._id.equals(account._id);

            let type;
            let otherAccountNumber;

            if (isDeposit) {
                type = 'deposit';
                otherAccountNumber = null;
            } else if (isSender) {
                type = 'sent';
                otherAccountNumber =
                    transaction.recipient?.accountNumber ?? null;
            } else {
                type = 'received';
                otherAccountNumber =
                    transaction.sender?.accountNumber ?? null;
            }

            return {
                reference: transaction.reference,
                type,
                amountNaira: (
                    transaction.amountKobo / 100
                ).toFixed(2),
                otherAccountNumber,
                description: transaction.description,
                status: transaction.status,
                createdAt: transaction.createdAt
            };
        });

        return res.status(200).json({
            message: 'Transaction history retrieved successfully.',
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            transactions: history
        });
    } catch (error) {
        console.error('Transaction history error:', error);

        return res.status(500).json({
            message: 'Could not retrieve transaction history.'
        });
    }
};

exports.getTransactionByReference = async (req, res) => {
    try {
        const account = await Account.findOne({
            user: req.userId
        }).select('_id');

        if (!account) {
            return res.status(404).json({
                message: 'Bank account not found.'
            });
        }

        const transaction = await Transaction.findOne({
            reference: req.params.reference,
            $or: [
                { sender: account._id },
                { recipient: account._id }
            ]
        })
            .populate('sender', 'accountNumber')
            .populate('recipient', 'accountNumber');

        if (!transaction) {
            return res.status(404).json({
                message: 'Transaction not found.'
            });
        }

        const isDeposit = transaction.type === 'deposit';
        const isSender = !isDeposit &&
            transaction.sender &&
            transaction.sender._id.equals(account._id);

        return res.status(200).json({
            message: 'Transaction retrieved successfully.',
            transaction: {
                reference: transaction.reference,
                type: isDeposit
                    ? 'deposit'
                    : isSender
                        ? 'sent'
                        : 'received',
                amountNaira: (
                    transaction.amountKobo / 100
                ).toFixed(2),
                senderAccountNumber:
                    transaction.sender?.accountNumber ?? null,
                recipientAccountNumber:
                    transaction.recipient?.accountNumber ?? null,
                description: transaction.description,
                status: transaction.status,
                createdAt: transaction.createdAt
            }
        });
    } catch (error) {
        console.error('Transaction details error:', error);

        return res.status(500).json({
            message: 'Could not retrieve transaction details.'
        });
    }
};
