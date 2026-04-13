import { verifyToken } from "../services/auth/token.auth.js";

export const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if(!authHeader || !authHeader.startsWith('Bearer ')){
        return res.status(401).json({
            error: 'Unauthprized: Missing or malformed token.'
        })
    }

    const token = authHeader.split(' ')[1];
    if(!token) return res.status(401).json({ error: 'Unauthorized: Token not provided.'})
    
    try {
        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            error: 'Unauthorized: Invalid or expired token'
        });
    }
};