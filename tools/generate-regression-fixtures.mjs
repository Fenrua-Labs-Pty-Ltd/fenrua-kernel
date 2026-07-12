import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'regressions', 'regression_001_p521_sub_overflow.bin');
const expectedSha256 = '7d11e62691085056fde7193c23cc7b3ffbfde2171807f820fc94cecf6f19ee5e';

// Canonical regression encoding: A[66] || B[66], unsigned big-endian.
// A = 2^64 - 1; B = 2^64. No private or production material is present.
const payload = Buffer.alloc(132);
payload.fill(0xff, 58, 66);
payload[66 + 57] = 0x01;

const actualSha256 = crypto.createHash('sha256').update(payload).digest('hex');
if (payload.length !== 132 || actualSha256 !== expectedSha256) {
  throw new Error(`Regression fixture invariant failed: bytes=${payload.length} sha256=${actualSha256}`);
}

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, payload);
console.log(`${path.relative(root, output)} ${payload.length} ${actualSha256}`);
