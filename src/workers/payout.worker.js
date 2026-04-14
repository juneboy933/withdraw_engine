import { Worker, Queue, QueueScheduler } from "bullmq";
import { connection } from "../queues/queue.config.js";
import { pool } from "../database/database.config.js";
import { initiateB2CWithdrawal } from "../services/mpesa/mpesa.service.js";
import { logger } from "../utils/logger.utils.js";
import { payoutQueue } from "../queues/payout.queue.js";

const queueName = 'payout-tasks';
new QueueScheduler(queueName, { connection });

const publishPendingOutbox = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const pending = await client.query(
            `SELECT id FROM outbox
             WHERE (status = 'pending' OR (status = 'dispatching' AND updated_at < NOW() - INTERVAL '10 minutes'))
               AND next_attempt_at <= NOW()
             ORDER BY created_at
             FOR UPDATE SKIP LOCKED
             LIMIT 5`
        );

        await client.query('COMMIT');

        for (const row of pending.rows) {
            try {
                await payoutQueue.add('process-outbox-message', { outboxId: row.id }, { jobId: row.id });
                logger.info(`[Outbox] Published pending outbox row ${row.id}`);
            } catch (publishError) {
                logger.warn(`[Outbox] Failed to publish outbox row ${row.id}: ${publishError.message}`);
            }
        }
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('[Outbox] Failed to fetch pending outbox items:', { error });
    } finally {
        client.release();
    }
};

const worker = new Worker(queueName, async (job) => {
    const { outboxId } = job.data;
    logger.info(`[Worker] Processing outbox ${outboxId}`);

    const client = await pool.connect();
    let outbox;

    try {
        await client.query('BEGIN');

        const outboxRes = await client.query(
            'SELECT id, transaction_id, payload, status FROM outbox WHERE id = $1 FOR UPDATE',
            [outboxId]
        );

        if (outboxRes.rowCount === 0) {
            throw new Error(`Outbox record not found for ${outboxId}`);
        }

        outbox = outboxRes.rows[0];

        if (outbox.status === 'completed') {
            await client.query('COMMIT');
            return;
        }

        await client.query(
            'UPDATE outbox SET status = $1, updated_at = NOW() WHERE id = $2',
            ['dispatching', outboxId]
        );

        const txRes = await client.query(
            'SELECT id, status FROM transactions WHERE id = $1 FOR UPDATE',
            [outbox.transaction_id]
        );

        if (txRes.rowCount === 0) {
            throw new Error(`Transaction not found for outbox ${outboxId}`);
        }

        const tx = txRes.rows[0];
        if (tx.status === 'Pending') {
            await client.query(
                'UPDATE transactions SET status = $1 WHERE id = $2',
                ['Processing', tx.id]
            );
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

    try {
        const payload = outbox.payload;
        const mpesaRes = await initiateB2CWithdrawal(
            payload.phoneNumber,
            payload.amount,
            'Withdrawal processed by Withdrawal Engine',
            payload.idempotencyKey
        );

        const providerReference = mpesaRes?.Response?.ConversationID || mpesaRes?.TransactionID || null;
        const client2 = await pool.connect();

        try {
            await client2.query('BEGIN');
            await client2.query(
                'UPDATE outbox SET status = $1, updated_at = NOW() WHERE id = $2',
                ['completed', outboxId]
            );
            await client2.query(
                'UPDATE transactions SET provider_reference = $1, description = $2 WHERE id = $3',
                [providerReference, 'B2C payout submitted', payload.transactionId]
            );
            await client2.query('COMMIT');
        } catch (updateError) {
            await client2.query('ROLLBACK');
            throw updateError;
        } finally {
            client2.release();
        }

        logger.info(`[Worker] Outbox ${outboxId} submitted to M-Pesa successfully`);
        return mpesaRes;
    } catch (error) {
        const client3 = await pool.connect();
        try {
            await client3.query('BEGIN');
            await client3.query(
                `UPDATE outbox
                 SET status = $1,
                     attempt_count = attempt_count + 1,
                     last_error = $2,
                     next_attempt_at = NOW() + INTERVAL '1 minute' * $3,
                     updated_at = NOW()
                 WHERE id = $4`,
                ['failed', error.message, job.attemptsMade + 1, outboxId]
            );
            await client3.query(
                'UPDATE transactions SET status = $1, description = $2 WHERE id = $3 AND status != $4',
                ['Review', `Worker execution failed: ${error.message}`, outbox.transaction_id, 'Success']
            );
            await client3.query('COMMIT');
        } catch (updateError) {
            await client3.query('ROLLBACK');
            logger.error('[Worker] Failed to update outbox or transaction after error:', { updateError });
        } finally {
            client3.release();
        }

        logger.error(`[Worker Error] Outbox ${outboxId} failed: ${error.message}`);
        throw error;
    }
}, { connection });

export const payoutWorker = worker;

worker.on('failed', async (job, err) => {
    const outboxId = job.data?.outboxId;
    const maxAttempts = job.opts?.attempts ?? 0;

    if (!outboxId) {
        logger.error(`[Worker] Failed job without outboxId: ${job.id}`);
        return;
    }

    if (job.attemptsMade >= maxAttempts) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(
                'UPDATE outbox SET status = $1, updated_at = NOW() WHERE id = $2',
                ['failed', outboxId]
            );
            await client.query(
                `UPDATE transactions
                 SET status = $1,
                     description = $2
                 WHERE id = (SELECT transaction_id FROM outbox WHERE id = $3)`,
                ['Review', `Worker retry limit reached: ${err.message}`, outboxId]
            );
            await client.query('COMMIT');
        } catch (updateErr) {
            await client.query('ROLLBACK');
            logger.error('[Worker] Failed to update final failed state:', { updateErr });
        } finally {
            client.release();
        }
    }
});

worker.on('error', (error) => {
    logger.error(`[Worker] Unexpected worker error: ${error.message}`, {
        stack: error.stack
    });
});

const startPublisher = () => {
    publishPendingOutbox().catch((error) => {
        logger.error('[Outbox] Publisher loop error:', { error });
    });
    setInterval(() => publishPendingOutbox().catch((error) => {
        logger.error('[Outbox] Publisher loop error:', { error });
    }), 15000);
};

startPublisher();

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
