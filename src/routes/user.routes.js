import express from 'express';
import { login, register } from '../controllers/user.controller.js';
import { authLimiter } from '../middlewares/rateLimit.middleware.js';

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

export default router;