import { env, isDevelopment, defaultMpesaWhitelist } from '../config/env.js';
import { parseAllowedIpList } from '../config/validator.js';

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

export const whitelistMpesa = (req, res, next) => {
    if (isDevelopment) {
        return next();
    }

    const clientIp = normalizeIp(req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress);
    const allowedIps = getAllowedCallbackIps();
    const isWhitelisted = allowedIps.includes(clientIp);

    if (!isWhitelisted) {
        console.warn(`[SECURITY ALERT] Blocked unauthorized callback attempt from: ${clientIp}`);
        return res.status(403).json({ error: 'Access Denied' });
    }

    next();
};

export { normalizeIp };
