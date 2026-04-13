import { logger } from '../utils/logger.utils.js';

export const notFoundHandler = (req, res) => {
    res.status(404).json({ error: 'Resource not found' });
};

export const errorHandler = (err, req, res, next) => {
    logger.error('Unhandled error', {
        message: err.message,
        stack: err.stack,
        path: req.originalUrl,
        method: req.method
    });

    const status = err.statusCode || 500;
    res.status(status).json({ error: 'Internal server error' });
};
