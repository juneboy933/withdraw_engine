import assert from 'assert';
import { validateAppEnv } from '../src/config/validator.js';

const env = {
    PORT: '8000',
    NODE_ENV: 'production',
    DB_USER: 'testuser',
    DB_HOST: '127.0.0.1',
    DB_DATABASE: 'testdb',
    DB_PASSWORD: 'secret',
    DB_PORT: '5432',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'secret',
    MPESA_CONSUMER_KEY: 'key',
    MPESA_CONSUMER_SECRET: 'secret',
    MPESA_TOKEN_URL: 'https://example.com/token',
    MPESA_B2C_URL: 'https://example.com/b2c',
    INITIATOR_NAME: 'test',
    SECURITY_CREDENTIALS: 'secret',
    MPESA_SHORTCODE: '123456',
    CALLBACK_URL: 'https://example.com/callback'
};

assert.strictEqual(validateAppEnv(env), true);

const invalidEnv = { ...env };
delete invalidEnv.DB_HOST;

try {
    validateAppEnv(invalidEnv);
    throw new Error('Expected validation failure for missing DB_HOST');
} catch (error) {
    assert.ok(error.message.includes('DB_HOST'));
}

console.log('env.test.js passed');
