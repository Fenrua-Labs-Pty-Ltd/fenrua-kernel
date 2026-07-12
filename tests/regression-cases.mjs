import crypto from 'node:crypto';
import fs from 'node:fs';

import { LIMB_RADIX, P521_ORDER, toLimbs9 } from '../tools/pn521-reference.mjs';

export const PN521_REGRESSION_COUNT = 1;
export const PN521_REGRESSION_FIXTURES = Object.freeze([
  {
    path: 'regressions/regression_001_p521_sub_overflow.bin',
    bytes: 132,
    sha256: '7d11e62691085056fde7193c23cc7b3ffbfde2171807f820fc94cecf6f19ee5e',
    encoding: 'A[66] || B[66], fixed-width unsigned big-endian',
    usedByRegressionId: 'regression-order-sub-cross-limb-borrow',
  },
]);

function readFixture() {
  const fixture = PN521_REGRESSION_FIXTURES[0];
  const payload = fs.readFileSync(fixture.path);
  const sha256 = crypto.createHash('sha256').update(payload).digest('hex');
  if (payload.length !== fixture.bytes || sha256 !== fixture.sha256) {
    throw new Error(
      `Regression fixture mismatch: bytes=${payload.length} sha256=${sha256}`
    );
  }
  const left = BigInt(`0x${payload.subarray(0, 66).toString('hex')}`);
  const right = BigInt(`0x${payload.subarray(66).toString('hex')}`);
  if (left !== LIMB_RADIX - 1n || right !== LIMB_RADIX) {
    throw new Error('Regression fixture does not encode the declared cross-limb operands.');
  }
  return { fixture, left, right };
}

export function buildPn521Regressions() {
  const { fixture, left, right } = readFixture();
  return [
    {
      regressionId: 'regression-order-sub-cross-limb-borrow',
      classification: 'permanent-borrow-chain-regression',
      domain: 'N521_ORDER',
      operation: 'subtract-mod-n',
      backend: 'circom-p521-big-sub',
      input: {
        fixture,
        leftLimbsLe64: toLimbs9(left),
        rightLimbsLe64: toLimbs9(right),
      },
      expected: {
        resultLimbsLe64: toLimbs9(P521_ORDER - 1n),
        needsAdd: true,
      },
    },
  ];
}
