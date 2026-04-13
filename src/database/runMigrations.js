import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './database.config.js';
import { logger } from '../utils/logger.utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../migrations');

export const runMigrations = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    if (!fs.existsSync(migrationsDir)) {
        throw new Error(`Migrations directory not found: ${migrationsDir}`);
    }

    const files = (await fs.promises.readdir(migrationsDir))
        .filter(file => file.endsWith('.sql'))
        .sort();

    for (const file of files) {
        const existing = await pool.query(`SELECT 1 FROM migrations WHERE name = $1`, [file]);
        if (existing.rowCount > 0) {
            continue;
        }

        const migrationPath = path.join(migrationsDir, file);
        const script = await fs.promises.readFile(migrationPath, 'utf8');

        try {
            await pool.query('BEGIN');
            await pool.query(script);
            await pool.query(`INSERT INTO migrations (name) VALUES ($1)`, [file]);
            await pool.query('COMMIT');
            logger.info(`Migration applied: ${file}`);
        } catch (error) {
            await pool.query('ROLLBACK');
            logger.error(`Migration failed: ${file}`, error);
            throw error;
        }
    }
};
