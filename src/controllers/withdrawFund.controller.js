import { v4 as uuidv4 } from 'uuid';
import { processWithdrawal } from '../services/business/withdraw.service.js';


export const handleWithdrawal = async (req, res) => {
    const { userId, phoneNumber, amount } = req.body;

    if(!userId || !phoneNumber || !amount){
        return res.status(400).json({ error: "Missing required fields: userId, phonenumber or amount"});
    }

    if(isNaN(amount) || amount <= 0){
        return res.status(400).json({ error: "Amount must be positive number."});
    }

    const idempotencyKey = uuidv4();

    try {
        const result = await processWithdrawal(userId, phoneNumber, amount, idempotencyKey);

        return res.status(202).json({
            success: true,
            message: "Withdrawal request accepted and is being processed.",
            transactionId: result.txId,
            idempotencyKey
        });
    } catch (error) {
        if (error.message === 'Account not found.') {
            return res.status(404).json({ error: error.message });
        }
        if (error.message === 'Insufficient Funds') {
            return res.status(400).json({ error: "You do not have enough balance for this transaction." });
        }

        console.error(`[Withdrawal Controller Error]:`, error);
        return res.status(500).json({ error: "Internal server error. Please try again later." });
    }
};