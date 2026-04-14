import { loginUser, registerUser } from "../services/auth/user.auth.js";

const PHONE_PATTERN = /^(?:\+?254)(?:7|1)[0-9]{8}$/;

export const register = async (req, res) => {
    try {
        const { phone, password } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ error: 'Phone and password are required.' });
        }

        if (!PHONE_PATTERN.test(phone)) {
            return res.status(400).json({ error: 'Phone number must use the Kenyan international format (e.g. +254712345678).' });
        }

        if (password.length < 10) {
            return res.status(400).json({ error: 'Password must be at least 10 characters long.' });
        }

        const newUser = await registerUser(phone, password);

        return res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: newUser.id,
                phone: newUser.phone
            }
        });
    } catch (error) {
        if (error.message.includes('already registered')) {
            return res.status(409).json({ error: error.message });
        }

        console.error('Failed to register user:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

export const login = async (req, res) => {
    try {
        const { phone, password } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ error: 'Phone and password are required.' });
        }

        const { token, user } = await loginUser(phone, password);
        return res.status(200).json({
            message: 'User logged in',
            token,
            user
        });
    } catch (error) {
        if (error.message.includes('Invalid phone number or password')) {
            return res.status(401).json({ error: 'Invalid phone number or password.' });
        }

        console.error('Failed to login user:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};