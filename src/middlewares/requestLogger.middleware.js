import { logger } from '../utils/logger.utils.js';

export const requestLogger = (req, res, next) => {
    res.on('finish', () => {
        logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} from ${req.ip || req.socket.remoteAddress}`);
    });
    next();
};
