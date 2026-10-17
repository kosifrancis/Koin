
const express = require('express');
require('dotenv').config();

const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const accountRoutes = require('./routes/accountRoutes');
const transferRoutes = require('./routes/transferRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const depositRoutes = require('./routes/depositRoutes');
const helmet = require('helmet');

const app = express();
app.use(helmet());

// Middleware
app.use(express.json({ limit: '10kb' }));

// Home route
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Welcome to the Koin Banking API!'
    });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/accounts', accountRoutes);
app.use('/api/v1/transfers', transferRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/deposits', depositRoutes);

// Handle unknown routes
app.use((req, res) => {
    res.status(404).json({
        message: 'API route not found.'
    });
});

// Start server after connecting to MongoDB
const PORT = process.env.PORT || 3000;

const startServer = async () => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`Koin Banking API is running on port ${PORT}`);
    });
};

startServer();
