import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const getMpesaToken = async () => {
    const key = process.env.MPESA_CONSUMER_KEY;
    const secret = process.env.MPESA_CONSUMER_SECRET;
    const tokenUrl = process.env.MPESA_TOKEN_URL;

    const auth = Buffer.from(`${key}:${secret}`).toString('base64');

    try {
        const mpesaRes = await axios.get(tokenUrl, {
            headers: { Authorization: `Basic ${auth}` }
        });

        return mpesaRes.data.access_token;
    } catch (error) {
        console.error('Mpesa Token Error:', error.response?.data || error.message);
        throw new Error('Failed to authenticate with Safaricom.');
    }
};

export const initiateB2CWithdrawal = async (phoneNumber, amount, remarks, idempotencyKey) => {
    const token = await getMpesaToken();
    const B2C_URL = process.env.MPESA_B2C_URL;

    const data = {
        InitiatorName: process.env.INITIATOR_NAME,
        SecurityCredential: process.env.SECURITY_CREDENTIALS,
        CommandID: 'BusinessPayment',
        Amount: amount,
        PartyA: process.env.MPESA_SHORTCODE,
        PartyB: phoneNumber,
        Remarks: remarks || 'Withdrawal from WITHDRAWAL ENGINE',
        QueueTimeOutURL: process.env.CALLBACK_URL,
        ResultURL: process.env.CALLBACK_URL,
        Occasion: 'Withdrawal',
        OriginatorConversationID: idempotencyKey
    };

    const res = await axios.post(B2C_URL, data, {
        headers: { Authorization: `Bearer ${token}` }
    });

    return res.data;
};