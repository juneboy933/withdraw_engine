import { pool } from "./database.config.js";

export const initiateDB = async () => {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // User table: id, phone, password_hash, created_at
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            phone VARCHAR(15) NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )    
    `);

    // Accounts table: id, user_id, balance, currency, created_at, updated_at
    await pool.query(`
        CREATE TABLE IF NOT EXISTS accounts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) NOT NULL,
            balance NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
            currency TEXT NOT NULL DEFAULT 'KES',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )    
    `);

    // Transactions table: id, account_id, idempotency_key, provider_reference, amount, transaction_type, status, description, created_at
    await pool.query(`
        CREATE TABLE IF NOT EXISTS transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            account_id UUID REFERENCES accounts(id) NOT NULL,
            idempotency_key UUID NOT NULL UNIQUE,
            provider_reference TEXT UNIQUE,
            amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
            transaction_type TEXT NOT NULL DEFAULT 'Withdrawal',
            status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Processing', 'Success', 'Failed')),
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )    
    `);

    // Ledger table: id, transaction_id, amount, entry_type, created_at
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ledger (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            transaction_id UUID REFERENCES transactions(id) NOT NULL,
            amount NUMERIC (20,2) NOT NULL,
            entry_type TEXT NOT NULL CHECK (entry_type IN ('debit', 'credit')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP 
        )    
    `);

    // INDEX
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ledger_transactions_id ON ledger(transaction_id)`);
};