import { Queue } from "bullmq";
import { connection } from "./queue.config.js";

export const payoutQueue = new Queue('payout-tasks', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 10000
        },
        removeOnComplete: true,
        removeOnFail: true
    }
});