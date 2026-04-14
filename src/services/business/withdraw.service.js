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

        const existingTx = await client.query(
            'SELECT id, account_id FROM transactions WHERE idempotency_key = $1',
            [idempotencyKey]
        );

        if (existingTx.rowCount > 0) {
            const { id: existingId, account_id: existingAccountId } = existingTx.rows[0];
            if (existingAccountId !== accountId) {
                throw new Error('Invalid idempotency key for this account.');
            }
            await client.query('COMMIT');
            return { success: true, txId: existingId, idempotencyKey };
        }

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

        const outboxRes = await client.query(
            `INSERT INTO outbox (transaction_id, event_type, payload)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [txId, 'B2C_WITHDRAWAL', {
                transactionId: txId,
                phoneNumber,
                amount,
                idempotencyKey
            }]
        );

        const outboxId = outboxRes.rows[0].id;
        await client.query('COMMIT');

        try {
            await payoutQueue.add(
                'process-outbox-message',
                { outboxId },
                { jobId: outboxId }
            );
        } catch (queueError) {
            console.warn(`[WARN] Outbox publish failed for transaction ${txId}, leaving pending outbox row:`, queueError.message);
        }

        return { success: true, txId, outboxId };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`[CRITICAL] Withdrawal Failed for User ${userId}:`, error.message);
        throw error;
    } finally {
        client.release();
    }
};