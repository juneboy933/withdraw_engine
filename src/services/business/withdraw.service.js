import { pool } from "../../database/database.config.js";
import { payoutQueue } from "../../queues/payout.queue.js";

export const processWithdrawal = async (userId, phoneNumber, amount, idempotencyKey) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const accountRes = await client.query(
            'SELECT id, balance FROM accounts WHERE user_id = $1 FOR UPDATE',
            [userId]
        );

        if (accountRes.rowCount === 0) {
            throw new Error('Account not found.');
        }

        const { id: accountId, balance } = accountRes.rows[0];
        if (Number(balance) < amount) {
            throw new Error('Insufficient Funds');
        }

        const txRes = await client.query(
            `INSERT INTO transactions (account_id, idempotency_key, amount, status, description)
             VALUES ($1, $2, $3, 'Pending', $4)
             RETURNING id`,
            [accountId, idempotencyKey, amount, `WITHDRAWAL ${amount} TO ${phoneNumber}`]
        );

        const txId = txRes.rows[0].id;

        await client.query(
            'UPDATE accounts SET balance = balance - $1, updated_at = NOW() WHERE id = $2',
            [amount, accountId]
        );

        await client.query(
            'INSERT INTO ledger (transaction_id, amount, entry_type) VALUES ($1, $2, $3)',
            [txId, amount, 'debit']
        );

        await client.query('COMMIT');

        try {
            await payoutQueue.add(
                'process-B2C-payout',
                { transactionId: txId, userId, phoneNumber, amount, idempotencyKey },
                { jobId: idempotencyKey }
            );
            return { success: true, txId };
        } catch (queueError) {
            const rollbackClient = await pool.connect();
            try {
                await rollbackClient.query('BEGIN');
                await rollbackClient.query(
                    'UPDATE transactions SET status = $1, description = $2 WHERE id = $3',
                    ['Failed', `Queue enqueue failed: ${queueError.message}`, txId]
                );
                await rollbackClient.query(
                    'UPDATE accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
                    [amount, accountId]
                );
                await rollbackClient.query(
                    'INSERT INTO ledger (transaction_id, amount, entry_type) VALUES ($1, $2, $3)',
                    [txId, amount, 'credit']
                );
                await rollbackClient.query('COMMIT');
            } catch (refundError) {
                await rollbackClient.query('ROLLBACK');
                console.error(`[CRITICAL] Failed to compensate withdrawal ${txId} after queue error:`, refundError.message);
                throw new Error('Withdrawal failed due to queue error and automatic compensation failed.');
            } finally {
                rollbackClient.release();
            }

            console.error(`[CRITICAL] Failed to enqueue payout for transaction ${txId}:`, queueError.message);
            throw new Error('Unable to queue payout. Please try again later.');
        }
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`[CRITICAL] Withdrawal Failed for User ${userId}:`, error.message);
        throw error;
    } finally {
        client.release();
    }
};