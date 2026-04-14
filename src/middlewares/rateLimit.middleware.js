import rateLimit from 'express-rate-limit';

export const withdrawalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 withdrawal requests per window
    message: { error: 'Too many withdrawal attempts. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});