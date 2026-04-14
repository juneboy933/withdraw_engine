import express from 'express';
import { pool } from '../database/database.config.js';
import { logger } from '../utils/logger.utils.js';

const router = express.Router();

// Reconciliation endpoint - requires admin auth
router.get('/reconcile', async (req, res) => {
    try {
        // Find transactions that are stuck in Processing but have callbacks
        const stuckTx = await pool.query(`
            SELECT t.id, t.idempotency_key, t.status, t.created_at,
                   ca.result_code, ca.result_desc, ca.callback_status, ca.received_at
            FROM transactions t
            LEFT JOIN callback_audit ca ON t.id = ca.transaction_id
            WHERE t.status = 'Processing'
              AND t.created_at < NOW() - INTERVAL '1 hour'
              AND ca.id IS NOT NULL
            ORDER BY t.created_at DESC
        `);

        // Find callbacks without transactions
        const orphanCallbacks = await pool.query(`
            SELECT ca.id, ca.conversation_id, ca.result_code, ca.result_desc, ca.received_at
            FROM callback_audit ca
            LEFT JOIN transactions t ON ca.conversation_id = t.idempotency_key
            WHERE t.id IS NULL
              AND ca.received_at > NOW() - INTERVAL '24 hours'
            ORDER BY ca.received_at DESC
        `);

        // Find outbox items that are stuck
        const stuckOutbox = await pool.query(`
            SELECT id, transaction_id, status, attempt_count, last_error, created_at
            FROM outbox
            WHERE status IN ('failed', 'dispatching')
              AND updated_at < NOW() - INTERVAL '1 hour'
            ORDER BY updated_at DESC
        `);

        res.json({
            stuckTransactions: stuckTx.rows,
            orphanCallbacks: orphanCallbacks.rows,
            stuckOutbox: stuckOutbox.rows,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('[Reconciliation] Error:', error);
        res.status(500).json({ error: 'Reconciliation failed' });
    }
});

// Manual transaction status update (admin only)
router.post('/resolve/:transactionId', async (req, res) => {
    const { transactionId } = req.params;
    const { action, reason } = req.body; // action: 'refund', 'mark_success', 'mark_failed'

    if (!['refund', 'mark_success', 'mark_failed'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const txRes = await client.query(
            'SELECT id, account_id, amount, status FROM transactions WHERE id = $1 FOR UPDATE',
            [transactionId]
        );

        if (txRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const tx = txRes.rows[0];

        if (action === 'refund' && tx.status !== 'Success') {
            await client.query(
                'UPDATE accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
                [tx.amount, tx.account_id]
            );
            await client.query(
                'INSERT INTO ledger (transaction_id, amount, entry_type) VALUES ($1, $2, $3)',
                [tx.id, tx.amount, 'credit']
            );
            await client.query(
                'UPDATE transactions SET status = $1, description = $2 WHERE id = $3',
                ['Refunded', `Manual refund: ${reason}`, tx.id]
            );
        } else if (action === 'mark_success') {
            await client.query(
                'UPDATE transactions SET status = $1, description = $2 WHERE id = $3',
                ['Success', `Manual resolution: ${reason}`, tx.id]
            );
        } else if (action === 'mark_failed') {
            await client.query(
                'UPDATE transactions SET status = $1, description = $2 WHERE id = $3',
                ['Failed', `Manual failure: ${reason}`, tx.id]
            );
        }

        await client.query('COMMIT');
        logger.info(`[Reconciliation] Manual resolution for transaction ${transactionId}: ${action}`);
        res.json({ success: true, action, transactionId });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('[Reconciliation] Manual resolution error:', error);
        res.status(500).json({ error: 'Resolution failed' });
    } finally {
        client.release();
    }
});

export default router;