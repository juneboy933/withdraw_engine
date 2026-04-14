import { Worker } from "bullmq";
import { connection } from "../queues/queue.config.js";
import { pool } from "../database/database.config.js";
import { initiateB2CWithdrawal } from "../services/mpesa/mpesa.service.js";
import { logger } from "../utils/logger.utils.js";

const worker = new Worker('payout-tasks', async (job) => {
    const { phoneNumber, amount, idempotencyKey, transactionId, userId } = job.data;
    logger.info(`[Worker] Processing transaction ${transactionId} for ${phoneNumber}-${userId}`);

    try {
        const updateRes = await pool.query(
            'UPDATE transactions SET status = $1 WHERE id = $2 AND status = $3',
            ['Processing', transactionId, 'Pending']
        );

        if (updateRes.rowCount === 0) {
            logger.warn(`[Worker] Transaction ${transactionId} is not pending and will still be attempted.`);
        }

        const mpesaRes = await initiateB2CWithdrawal(
            phoneNumber,
            amount,
            'Withdrawal processed by Withdrawal Engine',
            idempotencyKey
        );

        logger.info(`[Worker] M-Pesa Response: ${mpesaRes.ResponseDescription}`);
        return mpesaRes;
    } catch (error) {
        logger.error(`[Worker Error] Job ${job.id}: ${error.message}`);
        throw error;
    }
}, { connection });

export const payoutWorker = worker;

worker.on('failed', async (job, err) => {
    const { transactionId } = job.data;

    logger.error(`[CRITICAL] Job ${job.id} failed after retries for Tx: ${transactionId}. Error: ${err.message}`);

    try {
        await pool.query(
            'UPDATE transactions SET status = $1, description = $2 WHERE id = $3 AND status != $4',
            ['Failed', `Worker execution failed: ${err.message}`, transactionId, 'Success']
        );
    } catch (updateErr) {
        logger.error(`[FATAL] Failed to update transaction status for failed job ${job.id}: ${updateErr.message}`);
    }
});

worker.on('error', (error) => {
    logger.error(`[Worker] Unexpected worker error: ${error.message}`, {
        stack: error.stack
    });
});

const shutdownWorker = async () => {
    try {
        await worker.close();
        logger.info('✔ Payout worker closed cleanly');
        process.exit(0);
    } catch (error) {
        logger.error('❌ Failed to close payout worker gracefully', error);
        process.exit(1);
    }
};

process.on('SIGTERM', shutdownWorker);
process.on('SIGINT', shutdownWorker);
