import express from 'express';
import dotenv from 'dotenv';
import withdrawalRoutes from './src/routes/payout.routes.js';
import { initiateDB } from './src/database/database.tables.js';
import { payoutQueue } from './src/queues/payout.queue.js';
import { pool } from './src/database/database.config.js';
import userRoutes from './src/routes/user.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Initiate Database
initiateDB()
    .then(() => console.log('Database Tables Verified'))
    .catch(err => {
        console.error('DB Initialization Failed:', err);
        process.exit(1);
    });

// Middleware
app.use(express.json());

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
        // 2. Close BullMQ Queue connections
        await payoutQueue.close();
        console.log('✔ BullMQ Queue connections closed.');

        // 3. Drain the Postgres Pool
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