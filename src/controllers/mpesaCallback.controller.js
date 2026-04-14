import Joi from 'joi';
import { pool } from '../database/database.config.js';
import { logger } from '../utils/logger.utils.js';

const callbackSchema = Joi.object({
    Result: Joi.object({
        OriginatorConversationID: Joi.string().uuid().required(),
        ResultCode: Joi.number().required(),
        ResultDesc: Joi.string().required(),
        ResultParameters: Joi.object({
            ResultParameter: Joi.array().items(
                Joi.object({
                    Key: Joi.string().required(),
                    Value: Joi.any().required()
                })
            )
        }).optional()
    }).required()
});

export const mpesaCallback = async (req, res) => {
    const { error } = callbackSchema.validate(req.body);
    if (error) {
        logger.warn('[Callback] Invalid payload received', { error: error.message });
        return res.status(400).json({ error: 'Invalid callback payload.' });
    }

    const { Result } = req.body;
    const conversationId = Result.OriginatorConversationID;
    const resultCode = Result.ResultCode;
    const resultDesc = Result.ResultDesc;

    logger.info(`[Callback] Received result for ${conversationId}: ${resultDesc}`);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const txRes = await client.query(
            `SELECT id, account_id, amount, status FROM transactions
             WHERE idempotency_key = $1
             FOR UPDATE`,
            [conversationId]
        );

        if (txRes.rowCount === 0) {
            logger.warn(`[Callback] Transaction ${conversationId} not found`);
            await client.query('ROLLBACK');
            return res.status(404).end();
        }

        const tx = txRes.rows[0];

        if (tx.status === 'Success') {
            await client.query('ROLLBACK');
            return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
        }

        if (resultCode === 0) {
            const mpesaReceipt = Result.ResultParameters?.ResultParameter.find(p => p.Key === 'TransactionID')?.Value || null;

            await client.query(
                'UPDATE transactions SET status = $1, provider_reference = $2 WHERE id = $3',
                ['Success', mpesaReceipt, tx.id]
            );
        } else {
            await client.query(
                'UPDATE transactions SET status = $1, description = $2 WHERE id = $3',
                ['Failed', resultDesc, tx.id]
            );

            await client.query(
                'UPDATE accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
                [tx.amount, tx.account_id]
            );

            await client.query(
                'INSERT INTO ledger (transaction_id, amount, entry_type) VALUES ($1, $2, $3)',
                [tx.id, tx.amount, 'credit']
            );
        }

        await client.query('COMMIT');
        return res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('[Critical] Callback processing error:', { error });
        res.status(500).end();
    } finally {
        client.release();
    }
};