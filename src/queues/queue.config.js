import Redis from "ioredis";
import dotenv from 'dotenv';

dotenv.config();

export const connection = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null
});