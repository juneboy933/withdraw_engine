import crypto from 'crypto';
import { env, isDevelopment, defaultMpesaWhitelist } from '../config/env.js';
import { parseAllowedIpList } from '../config/validator.js';
import { logger } from '../utils/logger.utils.js';

const normalizeIp = (ip) => {
    if (!ip || typeof ip !== 'string') return '';
    return ip.trim().split(',')[0].replace(/^::ffff:/, '');
};

export const getAllowedCallbackIps = (ipList = env.MPESA_WHITELISTED_IPS) => {
    const results = parseAllowedIpList(ipList);
    if (results.length > 0) {
        return results;
    }
    return defaultMpesaWhitelist;
};

const validateCallbackSecret = (req) => {
    if (isDevelopment) {
        return true;
    }

    const secretHeader = req.headers['x-callback-secret'] || req.headers['x-mpesa-callback-secret'];
    const expectedSecret = env.MPESA_CALLBACK_SECRET;

    if (!secretHeader || !expectedSecret) {
        return false;
    }

    const secretBuffer = Buffer.from(secretHeader);
    const expectedBuffer = Buffer.from(expectedSecret);
    if (secretBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(secretBuffer, expectedBuffer);
};

export const validateMpesaCallback = (req, res, next) => {
    if (isDevelopment) {
        return next();
    }

    const clientIp = normalizeIp(req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress);
    const allowedIps = getAllowedCallbackIps();
    const ipValid = allowedIps.includes(clientIp);
    const secretValid = validateCallbackSecret(req);

    if (!ipValid || !secretValid) {
        logger.warn('[SECURITY ALERT] Blocked unsafe callback attempt', {
            clientIp,
            ipValid,
            secretValid
        });
        return res.status(403).json({ error: 'Access Denied' });
    }

    next();
};

export { normalizeIp };
