import express from 'express';
import { handleWithdrawal } from '../controllers/withdrawFund.controller.js';
import { mpesaCallback } from '../controllers/mpesaCallback.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { withdrawalLimiter } from '../middlewares/rateLimit.middleware.js';
import { validateWithdrawal } from '../middlewares/validators.middleware.js';
import { whitelistMpesa } from '../middlewares/ipWhitelist.middleware.js';

const router = express.Router();

// User facing routes
router.post(
    '/withdraw',
    authMiddleware,
    withdrawalLimiter,
    validateWithdrawal,
    handleWithdrawal);

// Public routes
router.post(
    '/mpesa/callback', 
    whitelistMpesa, 
    mpesaCallback
);

export default router;