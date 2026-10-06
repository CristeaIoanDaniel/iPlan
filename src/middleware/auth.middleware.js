const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';

const generateToken = (payload, expiresIn = '1h') => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new AppError('Unauthorized: Missing or invalid token format', 401));
    }

    const token = authHeader.slice('Bearer '.length);
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return next(new AppError('Unauthorized: Token expired', 401));
        }
        return next(new AppError('Unauthorized: Invalid token', 401));
    }
};

module.exports = {
    generateToken,
    authenticate,
};
