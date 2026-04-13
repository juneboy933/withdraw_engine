// Known Safaricom M-Pesa Sandbox/Production IPs
const SAFARICOM_IPS = [
    '196.201.214.200',
    '196.201.214.206',
    '196.201.213.114',
    '196.201.214.207',
    '196.201.214.208',
    '196.50.137.33'
];

export const whitelistMpesa = (req, res, next) => {
    // In production, your app is likely behind a proxy (Nginx/Heroku/Cloudflare)
    // Use x-forwarded-for to get the real client IP
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Bypass check during local development
    if (process.env.NODE_ENV === 'development') {
        return next();
    }

    // Check if the client IP is in the allowed list
    // Note: includes() is used because x-forwarded-for can be a comma-separated list
    const isWhitelisted = SAFARICOM_IPS.some(ip => clientIp.includes(ip));

    if (!isWhitelisted) {
        console.warn(`[SECURITY ALERT] Blocked unauthorized callback attempt from: ${clientIp}`);
        return res.status(403).json({ error: "Access Denied" });
    }

    next();
};