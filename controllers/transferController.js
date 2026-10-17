
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

// Convert a Naira amount into whole kobo without floating-point arithmetic.
const toKobo = (amountNaira) => {
    if (
        (typeof amountNaira !== 'string' &&
            typeof amountNaira !== 'number') ||
        !/^\d{1,10}(?:\.\d{1,2})?$/.test(String(amountNaira))
    ) {
        return null;
    }

    const [naira, kobo = ''] = String(amountNaira).split('.');
    const amountKobo = Number(naira) * 100 + Number(kobo.padEnd(2, '0'));

    if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
        return null;
    }

    return amountKobo;
};

// SEND MONEY
exports.sendMoney = async (req, res) => {
    const { recipientAccountNumber, amountNaira, description = '' } = req.body;

    if (
        typeof recipientAccountNumber !== 'string' ||
        !/^\d{10}$/.test(recipientAccountNumber)
    ) {
        return res.status(400).json({
            message: 'A valid 10-digit recipient account number is required.'
        });
    }

    const amountKobo = toKobo(amountNaira);

    if (amountKobo === null) {
        return res.status(400).json({
            message: 'Enter a positive amount in Naira with no more than 2 decimal places.'
        });
    }

    if (
        typeof description !== 'string' ||
        description.trim().length > 140
    ) {
        return res.status(400).json({
            message: 'Description must be text with a maximum of 140 characters.'
        });
    }

    let session;

    try {
        session = await mongoose.startSession();

        let completedTransfer;

        await session.withTransaction(async () => {
            const sender = await Account.findOne({
                user: req.userId
            }).session(session);

            if (!sender) {
                const error = new Error('Your bank account was not found.');
                error.statusCode = 404;
                throw error;
            }

            const recipient = await Account.findOne({
                accountNumber: recipientAccountNumber
            }).session(session);

            if (!recipient) {
                const error = new Error('Recipient account was not found.');
                error.statusCode = 404;
                throw error;
            }

            if (sender._id.equals(recipient._id)) {
                const error = new Error('You cannot transfer money to yourself.');
                error.statusCode = 400;
                throw error;
            }

            if (sender.balanceKobo < amountKobo) {
                const error = new Error('Insufficient balance.');
                error.statusCode = 400;
                throw error;
            }

            // Debit only if the account still has enough money.
            const debit = await Account.updateOne(
                {
                    _id: sender._id,
                    balanceKobo: { $gte: amountKobo }
                },
                {
                    $inc: { balanceKobo: -amountKobo }
                },
                { session }
            );

            if (debit.modifiedCount !== 1) {
                const error = new Error(
                    'Balance changed. Please retry the transfer.'
                );
                error.statusCode = 409;
                throw error;
            }

            // Credit the recipient without exceeding the safe integer limit.
            const credit = await Account.updateOne(
                {
                    _id: recipient._id,
                    balanceKobo: {
                        $lte: Number.MAX_SAFE_INTEGER - amountKobo
                    }
                },
                {
                    $inc: { balanceKobo: amountKobo }
                },
                { session }
            );

            if (credit.modifiedCount !== 1) {
                const error = new Error(
                    'Recipient balance could not be updated.'
                );
                error.statusCode = 409;
                throw error;
            }

            const [transaction] = await Transaction.create(
                [
                    {
                        reference: randomUUID(),
                        sender: sender._id,
                        recipient: recipient._id,
                        amountKobo,
                        description: description.trim(),
                        status: 'completed'
                    }
                ],
                { session }
            );

            completedTransfer = transaction;
        });

        return res.status(201).json({
            message: 'Transfer completed successfully.',
            transaction: {
                reference: completedTransfer.reference,
                amountNaira: (completedTransfer.amountKobo / 100).toFixed(2),
                description: completedTransfer.description,
                status: completedTransfer.status,
                createdAt: completedTransfer.createdAt
            }
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                message: error.message
            });
        }

        console.error('Transfer error:', error);

        return res.status(500).json({
            message: 'Transfer could not be completed. Please check your balance before trying again.'
        });
    } finally {
        if (session) {
            await session.endSession();
        }
    }
};
