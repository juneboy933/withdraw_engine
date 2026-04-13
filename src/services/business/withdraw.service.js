import { pool } from "../../database/database.config.js";
import { payoutQueue } from "../../queues/payout.queue.js";

export const processWithdrawal = async (userId, phoneNumber, amount, idempotencyKey) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Find user account and balance and lock it
        const accountRes = await client.query(`
            SELECT id, balance FROM accounts WHERE user_id = $1 FOR UPDATE    
        `, [userId]);
        if(accountRes.rowCount === 0){
            throw new Error('Account not found.');
        }
        const balance = accountRes.rows[0].balance;
        if(Number(balance) < amount){
            throw new Error('Insufficient Funds');
        }

        const accountId = accountRes.rows[0].id;

        // Update user accounts
        await client.query(`
            UPDATE accounts SET balance = balance - $1, updated_at = NOW() WHERE id =$2    
        `, [amount, accountId]);

        // Record the transaction and the ledger
        const txRes = await client.query(`
            INSERT INTO transactions (account_id, idempotency_key, amount, status, description)
            VALUES ($1, $2, $3, 'Pending', $4)
            RETURNING id    
        `, [accountId, idempotencyKey, amount, `WITHDRAWAL ${amount} TO ${phoneNumber}`]);
        const txId = txRes.rows[0].id;

        await client.query(`
            INSERT INTO ledger (transaction_id, amount, entry_type)
            VALUES ($1, $2, 'debit')    
        `, [txId, amount]);

        await client.query('COMMIT');

        // Push to worker queue
        await payoutQueue.add('process-B2C-payout', {
            transactionId: txId,
            phoneNumber,
            amount,
            idempotencyKey
        }, { jobId: idempotencyKey });

        return { success: true, txId };
    } catch (error) {
      await client.query('ROLLBACK');
        console.error(`[CRITICAL] Withdrawal Failed for User ${userId}:`, error.message);
        throw error; // Rethrow so the controller can handle the status code
    } finally {
        client.release();
    }
};