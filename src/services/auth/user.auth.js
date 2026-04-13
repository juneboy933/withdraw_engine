import bcrypt from 'bcrypt';
import { pool } from '../../database/database.config.js';
import { getToken } from './token.auth.js';

export const registerUser = async (phoneNumber, password) => {
    const passwordHash = await bcrypt.hash(password, 12);
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const userExists = await client.query(`
            SELECT 1 FROM users WHERE phone = $1    
        `, [phoneNumber]);

        if(userExists.rowCount > 0){
            throw new Error('User phone already registered.');
        }

        const newUser = await client.query(`
            INSERT INTO users (phone, password_hash)
            VALUES ($1, $2)
            RETURNING id, phone    
        `, [phoneNumber, passwordHash]);
        const userId = newUser.rows[0].id;

        await client.query(`
            INSERT INTO accounts (user_id)
            VALUES ($1)
            RETURNING id, user_id, balance, currency, created_at    
        `, [userId]);

        await client.query('COMMIT');
        return newUser.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error
    } finally {
        client.release();
    }
};

export const loginUser = async (phoneNumber, password) => {
    try {
        const userRes = await pool.query(`
            SELECT id, phone, password_hash, created_at
            FROM users
            WHERE phone = $1    
        `, [phoneNumber]);

        if(userRes.rowCount === 0) throw new Error('Invalid phone number or password.')

        const user = userRes.rows[0];
        const passwordHash = user.password_hash;
        const isMatch = await bcrypt.compare(password, passwordHash);

        if(!isMatch) throw new Error('Invalid phone number or password');

        const token = getToken(user);
        return {
            token,
            user: {
                userId: user.id,
                phone: user.phone
            }
        };
    } catch (error) {
        throw error;
    }
};