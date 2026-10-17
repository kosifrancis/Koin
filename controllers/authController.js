
const User = require('../models/User');
const Account = require('../models/Account');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomInt } = require('crypto');

// Generate a random 10-digit account number
const generateAccountNumber = () => {
    return randomInt(1000000000, 10000000000).toString();
};

// SIGN UP
exports.signup = async (req, res) => {
    const { fullName, phoneNumber, password } = req.body;

    const cleanName =
        typeof fullName === 'string' ? fullName.trim() : '';

    const cleanPhone =
        typeof phoneNumber === 'string'
            ? phoneNumber.replace(/[\s()-]/g, '')
            : '';

    if (!cleanName || !cleanPhone || !password) {
        return res.status(400).json({
            message: 'Full name, phone number and password are required.'
        });
    }

    if (!/^\+?\d{8,15}$/.test(cleanPhone)) {
        return res.status(400).json({
            message: 'Please provide a valid phone number.'
        });
    }

    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({
            message: 'Password must contain at least 8 characters.'
        });
    }

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            message: 'Authentication is not configured on the server.'
        });
    }

    let user;
    let account;

    try {
        const existingUser = await User.findOne({
            phoneNumber: cleanPhone
        });

        if (existingUser) {
            return res.status(409).json({
                message: 'This phone number is already registered.'
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        user = await User.create({
            fullName: cleanName,
            phoneNumber: cleanPhone,
            passwordHash
        });

        // Retry if a generated account number already exists.
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                account = await Account.create({
                    user: user._id,
                    accountNumber: generateAccountNumber(),
                    balanceKobo: 0
                });

                break;
            } catch (error) {
                if (
                    error.code === 11000 &&
                    error.keyPattern?.accountNumber
                ) {
                    continue;
                }

                throw error;
            }
        }

        if (!account) {
            throw new Error('Could not generate a unique account number.');
        }

        const token = jwt.sign(
            { sub: user._id.toString() },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        return res.status(201).json({
            message: 'Koin account created successfully.',
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber
            },
            account: {
                accountNumber: account.accountNumber,
                balanceKobo: account.balanceKobo
            }
        });
    } catch (error) {
        // Remove any records created by this failed signup.
        if (account) {
            await Account.deleteOne({ _id: account._id }).catch(
                cleanupError => console.error(cleanupError)
            );
        }

        if (user) {
            await User.deleteOne({ _id: user._id }).catch(
                cleanupError => console.error(cleanupError)
            );
        }

        if (error.code === 11000) {
            return res.status(409).json({
                message: 'This phone number or account number already exists.'
            });
        }

        console.error('Signup error:', error);

        return res.status(500).json({
            message: 'Could not create your account.'
        });
    }
};

// LOG IN
exports.login = async (req, res) => {
    const { phoneNumber, password } = req.body;

    const cleanPhone =
        typeof phoneNumber === 'string'
            ? phoneNumber.replace(/[\s()-]/g, '')
            : '';

    if (!cleanPhone || typeof password !== 'string' || !password) {
        return res.status(400).json({
            message: 'Phone number and password are required.'
        });
    }

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            message: 'Authentication is not configured on the server.'
        });
    }

    try {
        const user = await User.findOne({
            phoneNumber: cleanPhone
        }).select('+passwordHash');

        if (!user) {
            return res.status(401).json({
                message: 'Invalid phone number or password.'
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: 'Invalid phone number or password.'
            });
        }

        const account = await Account.findOne({
            user: user._id
        });

        if (!account) {
            return res.status(500).json({
                message: 'Bank account could not be found.'
            });
        }

        const token = jwt.sign(
            { sub: user._id.toString() },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        return res.status(200).json({
            message: 'Login successful.',
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber
            },
            account: {
                accountNumber: account.accountNumber,
                balanceKobo: account.balanceKobo
            }
        });
    } catch (error) {
        console.error('Login error:', error);

        return res.status(500).json({
            message: 'Could not log in.'
        });
    }
};

 // GET MY PROFILE
exports.getMyProfile = async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .select('fullName phoneNumber createdAt');

        if (!user) {
            return res.status(404).json({
                message: 'User not found.'
            });
        }

        return res.status(200).json({
            message: 'Profile retrieved successfully.',
            user: {
                id: user._id,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);

        return res.status(500).json({
            message: 'Could not retrieve your profile.'
        });
    }
};

exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (
        typeof currentPassword !== 'string' ||
        typeof newPassword !== 'string' ||
        !currentPassword ||
        !newPassword
    ) {
        return res.status(400).json({
            message: 'Current password and new password are required.'
        });
    }

    if (newPassword.length < 8 || newPassword.length > 72) {
        return res.status(400).json({
            message: 'New password must be between 8 and 72 characters.'
        });
    }

    try {
        const user = await User.findById(req.userId)
            .select('+passwordHash');

        if (!user) {
            return res.status(404).json({
                message: 'User not found.'
            });
        }

        const passwordMatches = await bcrypt.compare(
            currentPassword,
            user.passwordHash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: 'Your current password is incorrect.'
            });
        }

        const samePassword = await bcrypt.compare(
            newPassword,
            user.passwordHash
        );

        if (samePassword) {
            return res.status(400).json({
                message: 'Choose a different password.'
            });
        }

        user.passwordHash = await bcrypt.hash(newPassword, 12);
        await user.save();

        return res.status(200).json({
            message: 'Password changed successfully. Please log in again on your other devices.'
        });
    } catch (error) {
        console.error('Change password error:', error);

        return res.status(500).json({
            message: 'Could not change your password.'
        });
    }
};
