
const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true
        },

        accountNumber: {
            type: String,
            required: true,
            unique: true,
            match: /^\d{10}$/
        },

        balanceKobo: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
            validate: {
                validator: Number.isSafeInteger,
                message: 'Balance must be a whole number of kobo.'
            }
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('Account', accountSchema);
