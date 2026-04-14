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

const extractTransactionId = (result) => {
    return result?.ResultParameters?.ResultParameter.find(p => p.Key === 'TransactionID')?.Value || null;
};

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
    const clientIp = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress;
    const callbackPayload = req.body;

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
            await client.query(
                `INSERT INTO callback_audit (conversation_id, request_ip, callback_secret_valid, ip_whitelist_valid, result_code, result_desc, callback_status, payload)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [conversationId, clientIp, true, true, resultCode, resultDesc, 'not_found', callbackPayload]
            );

            await client.query('ROLLBACK');
            logger.warn(`[Callback] Transaction ${conversationId} not found`);
            return res.status(404).end();
        }

        const tx = txRes.rows[0];
        const mpesaReceipt = extractTransactionId(Result);
        let callbackStatus = 'processed';

        if (tx.status === 'Success') {
            callbackStatus = 'duplicate';
            await client.query(
                `INSERT INTO callback_audit (transaction_id, request_ip, callback_secret_valid, ip_whitelist_valid, result_code, result_desc, callback_status, payload)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [tx.id, clientIp, true, true, resultCode, resultDesc, callbackStatus, callbackPayload]
            );
            await client.query('ROLLBACK');
            return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
        }

        if (resultCode === 0) {
            const targetStatus = tx.status === 'Failed' ? 'Review' : 'Success';
            const description = tx.status === 'Failed'
                ? `Success callback after failed state: ${resultDesc}`
                : 'Transaction completed successfully';

            await client.query(
                'UPDATE transactions SET status = $1, provider_reference = $2, description = $3 WHERE id = $4',
                [targetStatus, mpesaReceipt, description, tx.id]
            );
            callbackStatus = tx.status === 'Failed' ? 'review' : 'processed';
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
            callbackStatus = 'failed';
        }

        await client.query(
            `INSERT INTO callback_audit (transaction_id, request_ip, callback_secret_valid, ip_whitelist_valid, result_code, result_desc, callback_status, payload)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [tx.id, clientIp, true, true, resultCode, resultDesc, callbackStatus, callbackPayload]
        );

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