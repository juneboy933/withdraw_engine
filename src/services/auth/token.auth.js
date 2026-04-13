import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export const getToken = (user) => {
    const payload = {
        userId: user.id,
        phone: user.phone
    };
    const jwtSecret = process.env.JWT_SECRET;
    try {
        const token = jwt.sign(payload, jwtSecret, {expiresIn: '1h'});
        return token;
    } catch (error) {
        throw new Error('Error generating token');
    }
};


export const verifyToken = (token) => {
    const jwtSecret = process.env.JWT_SECRET;
    try {
        const decoded = jwt.verify(token, jwtSecret);
        return decoded;
    } catch (error) {
        throw new Error('MIssing or invalid token');
    }
};