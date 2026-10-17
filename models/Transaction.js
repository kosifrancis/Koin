
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
    {
        reference: {
            type: String,
            required: true,
            unique: true
        },

        type: {
            type: String,
            enum: ['transfer', 'deposit'],
            required: true,
            default: 'transfer'
        },

        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: function () {
                return this.type === 'transfer';
            }
        },

        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true
        },

        amountKobo: {
            type: Number,
            required: true,
            min: 1,
            validate: {
                validator: Number.isSafeInteger,
                message: 'Transaction amount must be a whole number of kobo.'
            }
        },

        description: {
            type: String,
            trim: true,
            maxlength: 140,
            default: ''
        },

        status: {
            type: String,
            enum: ['completed'],
            default: 'completed',
            required: true
        }
    },
    {
        timestamps: true
    }
);

transactionSchema.index({ sender: 1, createdAt: -1 });
transactionSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
