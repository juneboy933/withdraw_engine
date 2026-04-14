import { env } from './env.js';

export const requiredEnvKeys = [
    'DB_USER',
    'DB_HOST',
    'DB_DATABASE',
    'DB_PASSWORD',
    'DB_PORT',
    'REDIS_URL',
    'JWT_SECRET',
    'MPESA_CONSUMER_KEY',
    'MPESA_CONSUMER_SECRET',
    'MPESA_TOKEN_URL',
    'MPESA_B2C_URL',
    'INITIATOR_NAME',
    'SECURITY_CREDENTIALS',
    'MPESA_SHORTCODE',
    'CALLBACK_URL',
    'MPESA_CALLBACK_SECRET'
];

export const validateAppEnv = (inputEnv = env) => {
    const missing = requiredEnvKeys.filter(key => !inputEnv[key]);
    const invalid = [];

    if (inputEnv.DB_PORT && Number.isNaN(Number(inputEnv.DB_PORT))) {
        invalid.push('DB_PORT must be a number');
    }
    if (inputEnv.PORT && Number.isNaN(Number(inputEnv.PORT))) {
        invalid.push('PORT must be a number');
    }

    if (missing.length || invalid.length) {
        const reasons = [];
        if (missing.length) reasons.push(`Missing required environment variables: ${missing.join(', ')}`);
        if (invalid.length) reasons.push(invalid.join('; '));
        throw new Error(reasons.join(' | '));
    }

    return true;
};

export const parseAllowedIpList = (ipList) => {
    if (!ipList || typeof ipList !== 'string') {
        return [];
    }

    return ipList
        .split(',')
        .map(ip => ip.trim())
        .filter(Boolean)
        .map(ip => ip.replace(/^::ffff:/, ''));
};
