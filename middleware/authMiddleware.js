
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            message: 'Authentication required. Please log in.'
        });
    }

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            message: 'Authentication is not configured.'
        });
    }

    const token = authHeader.slice(7);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded.sub) {
            return res.status(401).json({
                message: 'Invalid authentication token.'
            });
        }

        req.userId = decoded.sub;
        next();
    } catch (error) {
        return res.status(401).json({
            message: 'Invalid or expired authentication token.'
        });
    }
};

// Export the function itself, not an object.
module.exports = authMiddleware;
