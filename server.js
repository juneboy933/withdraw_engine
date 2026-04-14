import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import withdrawalRoutes from './src/routes/payout.routes.js';
import userRoutes from './src/routes/user.routes.js';
import { validateAppEnv } from './src/config/validator.js';
import { runMigrations } from './src/database/runMigrations.js';
import { payoutQueue } from './src/queues/payout.queue.js';
import { pool } from './src/database/database.config.js';
import { requestLogger } from './src/middlewares/requestLogger.middleware.js';
import { notFoundHandler, errorHandler } from './src/middlewares/error.middleware.js';

dotenv.config();
validateAppEnv();

const app = express();
const PORT = process.env.PORT || 8000;
const trustProxy = process.env.TRUST_PROXY === 'true';

app.set('trust proxy', trustProxy);
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(requestLogger);

// Routes
app.use('/api/v1', withdrawalRoutes);
app.use('/api/user/v1', userRoutes);

// Health Check
app.get('/health', (_, res) => {
    res.status(200).json({
        app: 'Withdrawal engine',
        timestamp: new Date().toISOString(),
        status: 'OK'
    });
});

app.use(notFoundHandler);
app.use(errorHandler);

let payoutWorker;

try {
    await runMigrations();
    const workerModule = await import('./src/workers/payout.worker.js');
    payoutWorker = workerModule.payoutWorker;
    console.log('✔ Database migrations complete');
    console.log('✔ Payout worker initialized');
} catch (error) {
    console.error('Initialization failed:', error);
    process.exit(1);
}

// Assign to 'server' so the shutdown function can access it
const server = app.listen(PORT, () => {
    console.log(`Withdrawal Engine running on http://localhost:${PORT}`);
});

// --- GRACEFUL SHUTDOWN LOGIC ---
const shutdown = async (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    // 1. Stop accepting new HTTP requests
    if (server) {
        server.close(() => {
            console.log('✔ HTTP server closed.');
        });
    }

    try {
        if (payoutWorker) {
            await payoutWorker.close();
            console.log('✔ Payout worker closed.');
        }

        await payoutQueue.close();
        console.log('✔ BullMQ Queue connections closed.');

        await pool.end();
        console.log('✔ Postgres pool has ended.');

        console.log('👋 Shutdown complete. Goodbye!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during graceful shutdown:', err);
        process.exit(1);
    }
};

// CRITICAL: Register the listeners so the logic actually executes
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));