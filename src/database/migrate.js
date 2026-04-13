import { runMigrations } from './runMigrations.js';
import { logger } from '../utils/logger.utils.js';

try {
    await runMigrations();
    logger.info('Database migrations completed successfully');
    process.exit(0);
} catch (error) {
    logger.error('Database migration failed', error);
    process.exit(1);
}
