import { Worker } from "bullmq";
import { connection } from "../queues/queue.config.js";
import { pool } from "../database/database.config.js";
import { initiateB2CWithdrawal } from "../services/mpesa/mpesa.service.js";
import { logger } from "../utils/logger.utils.js";

const worker = new Worker('payout-tasks', async (job) => {
    const { phoneNumber, amount, idempotencyKey, transactionId } = job.data;
    console.log(`[Worker] Processing transaction ${transactionId} for ${phoneNumber}`);
    logger.info(`[Worker] Processing transaction ${transactionId} for ${phoneNumber}`);

    try {
        // Update transaction status from Pending to Processing
        await pool.query(`
            UPDATE transactions SET status = 'Processing' WHERE id = $1    
        `, [transactionId]);

        // Call Safaricom
        const mpesaRes = await initiateB2CWithdrawal(
            phoneNumber, 
            amount, 
            `Withdrawal processed by Withdrawal Engine`,
            idempotencyKey
        );
        console.log(`[Worker] M-Pesa Response:`, mpesaRes.ResponseDescription);

        return mpesaRes;
    } catch (error) {
        console.error(`[Worker Error] Job ${job.id}:`, error.message);
        logger.error(`[Worker Error] Job ${job.id}:`, error.message);
        // Throwing here tells BullMQ to retry based on our backoff settings
        throw error;
    }
}, { connection});

worker.on('failed', async (job, err) => {
    const { transactionId, amount, userId } = job.data;
    
    logger.error(`[CRITICAL] Job ${job.id} failed for Tx: ${transactionId}. Error: ${err.message}`);

    // Logic to auto-refund the user since the B2C request never successfully fired
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Mark transaction as Failed
        await client.query(`
            UPDATE transactions SET status = 'Failed', description = 'System Failure: Exhausted Retries' 
            WHERE id = $1 AND status != 'Success'
        `, [transactionId]);

        // 2. Refund the account balance
        await client.query(`
            UPDATE accounts SET balance = balance + $1, updated_at = NOW() 
            WHERE user_id = $2
        `, [amount, userId]);

        // 3. Log the reversal in ledger
        await client.query(`
            INSERT INTO ledger (transaction_id, amount, entry_type)
            VALUES ($1, $2, 'credit')
        `, [transactionId, amount]);

        await client.query('COMMIT');
        logger.info(`[REVERSAL] Successfully refunded ${amount} for failed Job ${job.id}`);
    } catch (reversalErr) {
        await client.query('ROLLBACK');
        logger.error(`[FATAL] Reversal failed for Job ${job.id}: ${reversalErr.message}`);
    } finally {
        client.release();
    }
});