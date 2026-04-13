import assert from 'assert';
import { normalizeIp, getAllowedCallbackIps } from '../src/middlewares/ipWhitelist.middleware.js';

assert.strictEqual(normalizeIp('::ffff:196.201.214.200'), '196.201.214.200');
assert.strictEqual(normalizeIp('196.201.214.206'), '196.201.214.206');
assert.deepStrictEqual(getAllowedCallbackIps('1.1.1.1, 2.2.2.2'), ['1.1.1.1', '2.2.2.2']);

console.log('whitelist.test.js passed');
