import { loginUser, registerUser } from "../services/auth/user.auth.js";

export const register = async (req, res) => {
    try {
        const { phone, password } = req.body;
    
        if(!phone || !password){
            return res.status(400).json({
                error: 'Phone and password are required'
            });
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
        console.error('Failed to register user.');
        return res.status(500).json({ error: error.message });
    }
};

export const login = async (req, res) => {
    try {
        const { phone, password} = req.body;

        if(!phone || !password){
            return res.status(400).json({ error: 'Phone and password are required.'});
        }

        const {token, user} = await loginUser(phone, password);
        return res.status(200).json({
            message: 'User logged in',
            token,
            user
        });
    } catch (error) {
        console.error('Failed to login user:', error.message);
        return res.status(500).json({ error:'Internal server error'});
    }
};