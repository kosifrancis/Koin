
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

const toKobo = (amountNaira) => {
    if (
        (typeof amountNaira !== 'string' &&
            typeof amountNaira !== 'number') ||
        !/^\d{1,10}(?:\.\d{1,2})?$/.test(String(amountNaira))
    ) {
        return null;
    }

    const [naira, kobo = ''] = String(amountNaira).split('.');
    const amount = Number(naira) * 100 +
        Number(kobo.padEnd(2, '0'));

    if (!Number.isSafeInteger(amount) || amount <= 0) {
        return null;
    }

    return amount;
};

exports.createDemoDeposit = async (req, res) => {
    // Never permit demo deposits in production.
    if (
        process.env.NODE_ENV === 'production' ||
        process.env.ALLOW_DEMO_DEPOSITS !== 'true'
    ) {
        return res.status(403).json({
            message: 'Demo deposits are disabled.'
        });
    }

    const amountKobo = toKobo(req.body.amountNaira);
    const description =
        typeof req.body.description === 'string'
            ? req.body.description.trim()
            : 'Development demo deposit';

    if (amountKobo === null) {
        return res.status(400).json({
            message: 'Enter a positive Naira amount with no more than 2 decimal places.'
        });
    }

    if (description.length > 140) {
        return res.status(400).json({
            message: 'Description cannot exceed 140 characters.'
        });
    }

    let session;

    try {
        session = await mongoose.startSession();

        let deposit;

        await session.withTransaction(async () => {
            const account = await Account.findOne({
                user: req.userId
            }).session(session);

            if (!account) {
                const error = new Error('Bank account not found.');
                error.statusCode = 404;
                throw error;
            }

            const update = await Account.updateOne(
                {
                    _id: account._id,
                    balanceKobo: {
                        $lte: Number.MAX_SAFE_INTEGER - amountKobo
                    }
                },
                {
                    $inc: {
                        balanceKobo: amountKobo
                    }
                },
                { session }
            );

            if (update.modifiedCount !== 1) {
                const error = new Error(
                    'The deposit could not be applied to this account.'
                );
                error.statusCode = 409;
                throw error;
            }

            const [transaction] = await Transaction.create(
                [{
                    reference: randomUUID(),
                    type: 'deposit',
                    recipient: account._id,
                    amountKobo,
                    description,
                    status: 'completed'
                }],
                { session }
            );

            deposit = transaction;
        });

        return res.status(201).json({
            message: 'Demo deposit completed.',
            transaction: {
                reference: deposit.reference,
                type: deposit.type,
                amountNaira: (
                    deposit.amountKobo / 100
                ).toFixed(2),
                description: deposit.description,
                status: deposit.status,
                createdAt: deposit.createdAt
            }
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                message: error.message
            });
        }

        console.error('Demo deposit error:', error);

        return res.status(500).json({
            message: 'Demo deposit could not be completed.'
        });
    } finally {
        if (session) {
            await session.endSession();
        }
    }
};
