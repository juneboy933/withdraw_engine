import { processWithdrawal } from '../services/business/withdraw.service.js';

export const handleWithdrawal = async (req, res) => {
    const userId = req.user?.userId;
    const { phoneNumber, amount } = req.body;
    const idempotencyKey = req.headers['idempotency-key'];

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: Missing user credentials.' });
    }

    if (!idempotencyKey) {
        return res.status(400).json({ error: 'Idempotency-Key header is required.' });
    }

    try {
        const result = await processWithdrawal(userId, phoneNumber, amount, idempotencyKey);

        return res.status(202).json({
            success: true,
            message: 'Withdrawal request accepted and is being processed.',
            transactionId: result.txId,
            idempotencyKey
        });
    } catch (error) {
        if (error.message === 'Account not found.') {
            return res.status(404).json({ error: error.message });
        }
        if (error.message === 'Insufficient Funds') {
            return res.status(400).json({ error: 'You do not have enough balance for this transaction.' });
        }
        if (error.message.includes('Invalid idempotency key')) {
            return res.status(409).json({ error: error.message });
        }
        if (error.message.includes('queue') || error.message.includes('Unable to queue payout')) {
            return res.status(202).json({
                success: true,
                message: 'Withdrawal accepted and will be queued for processing shortly.',
                transactionId: error.transactionId || null,
                idempotencyKey
            });
        }

        console.error('[Withdrawal Controller Error]:', error);
        return res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
};