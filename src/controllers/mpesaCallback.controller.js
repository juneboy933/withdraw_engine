import { pool } from "../database/database.config.js";

export const mpesaCallback = async (req, res) => {
    const { Result } = req.body;
    const conversationId = Result.OriginatorConversationID;
    const resultCode = Result.ResultCode;
    const resultDesc = Result.ResultDesc;

    console.log(`[Callback] Received result for ${conversationId}:${resultDesc}`);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Find the transaction and lock it for update
        const txRes = await client.query(`
            SELECT id, account_id, amount, status FROM transactions
            WHERE idempotency_key = $1
            FOR UPDATE    
        `, [conversationId]);

        if(txRes.rowCount === 0){
            console.error(`[ALERT] Transaction ${conversationId} not found on DB`);
            await client.query('ROLLBACK');
            return res.status(404).end();
        }

        const tx = txRes.rows[0];

        if(tx.status === 'Success' || tx.status === 'Failed'){
            await client.query('ROLLBACK');
            return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
        }

        if(resultCode === 0){
            const mpesaReceipt = Result.ResultParameters?.ResultParameter.find(p => p.Key === 'TransactionID')?.Value;
            
            await client.query(`
                UPDATE transactions SET status = 'Success', provider_reference = $1 WHERE id = $2   
            `, [mpesaReceipt, tx.id]);
        }else {
            await client.query(`
                UPDATE transactions SET status = 'Failed', description = $1 WHERE id = $2    
            `, [resultDesc, tx.id]);

            await client.query(`
                UPDATE accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2    
            `, [tx.amount, tx.account_id]);

            await client.query(`
                INSERT INTO ledger (transaction_id, amount, entry_type)
                VALUES ($1, $2, 'credit')    
            `, [tx.id, tx.amount]);
        }
        await client.query('COMMIT');
        return res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Critical] Callback processing error:', error);
        res.status(500).end();
    } finally {
        client.release();
    }
};