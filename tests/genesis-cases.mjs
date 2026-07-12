import {
  P521_FIELD_PRIME,
  P521_ORDER,
  bigintToFixedHex,
  toLimbs9,
} from '../tools/pn521-reference.mjs';

export const GENESIS_SUITE_ID = 'fenrua-pn521-genesis-v1';
export const GENESIS_CASE_COUNT = 10;

const ZERO_HEX = bigintToFixedHex(0n);
const ONE_HEX = bigintToFixedHex(1n);
const FIELD_MAX_HEX = bigintToFixedHex(P521_FIELD_PRIME - 1n);
const ZERO_LIMBS = toLimbs9(0n);
const ONE_LIMBS = toLimbs9(1n);

export function buildGenesisCases() {
  const cases = [
    {
      ordinal: 1,
      caseId: 'genesis-01-field-zero-canonical',
      classification: 'boundary-accept',
      domain: 'P521_FIELD',
      operation: 'canonicalize',
      backend: 'native-cxx-field-element',
      input: { encodingHex: ZERO_HEX },
      expected: { accepted: true, canonicalHex: ZERO_HEX },
    },
    {
      ordinal: 2,
      caseId: 'genesis-02-field-max-canonical',
      classification: 'boundary-accept',
      domain: 'P521_FIELD',
      operation: 'canonicalize',
      backend: 'native-cxx-field-element',
      input: { encodingHex: FIELD_MAX_HEX },
      expected: { accepted: true, canonicalHex: FIELD_MAX_HEX },
    },
    {
      ordinal: 3,
      caseId: 'genesis-03-field-modulus-rejected',
      classification: 'boundary-reject',
      domain: 'P521_FIELD',
      operation: 'canonicalize',
      backend: 'native-cxx-field-element',
      input: { encodingHex: bigintToFixedHex(P521_FIELD_PRIME) },
      expected: { accepted: false, canonicalHex: null },
    },
    {
      ordinal: 4,
      caseId: 'genesis-04-field-top-bit-overflow-rejected',
      classification: 'encoding-reject',
      domain: 'P521_FIELD',
      operation: 'canonicalize',
      backend: 'native-cxx-field-element',
      input: { encodingHex: bigintToFixedHex(1n << 521n) },
      expected: { accepted: false, canonicalHex: null },
    },
    {
      ordinal: 5,
      caseId: 'genesis-05-field-add-wrap',
      classification: 'modular-boundary',
      domain: 'P521_FIELD',
      operation: 'add-mod-p',
      backend: 'native-cxx-field-element',
      input: { leftHex: FIELD_MAX_HEX, rightHex: ONE_HEX },
      expected: { accepted: true, resultHex: ZERO_HEX },
    },
    {
      ordinal: 6,
      caseId: 'genesis-06-field-sub-underflow',
      classification: 'modular-boundary',
      domain: 'P521_FIELD',
      operation: 'subtract-mod-p',
      backend: 'native-cxx-field-element',
      input: { leftHex: ZERO_HEX, rightHex: ONE_HEX },
      expected: { accepted: true, resultHex: FIELD_MAX_HEX },
    },
    {
      ordinal: 7,
      caseId: 'genesis-07-order-one-canonical',
      classification: 'boundary-accept',
      domain: 'N521_ORDER',
      operation: 'nonzero-range-check',
      backend: 'circom-p521-signature-range',
      input: { candidateLimbsLe64: ONE_LIMBS, companionLimbsLe64: ONE_LIMBS },
      expected: { valid: true },
    },
    {
      ordinal: 8,
      caseId: 'genesis-08-order-modulus-rejected',
      classification: 'boundary-reject',
      domain: 'N521_ORDER',
      operation: 'nonzero-range-check',
      backend: 'circom-p521-signature-range',
      input: { candidateLimbsLe64: toLimbs9(P521_ORDER), companionLimbsLe64: ONE_LIMBS },
      expected: { valid: false },
    },
    {
      ordinal: 9,
      caseId: 'genesis-09-order-add-exact-wrap',
      classification: 'modular-boundary',
      domain: 'N521_ORDER',
      operation: 'add-mod-n',
      backend: 'circom-p521-big-add',
      input: { leftLimbsLe64: toLimbs9(P521_ORDER - 1n), rightLimbsLe64: ONE_LIMBS },
      expected: { resultLimbsLe64: ZERO_LIMBS, needsSubtract: true },
    },
    {
      ordinal: 10,
      caseId: 'genesis-10-order-sub-underflow',
      classification: 'modular-boundary',
      domain: 'N521_ORDER',
      operation: 'subtract-mod-n',
      backend: 'circom-p521-big-sub',
      input: { leftLimbsLe64: ZERO_LIMBS, rightLimbsLe64: ONE_LIMBS },
      expected: { resultLimbsLe64: toLimbs9(P521_ORDER - 1n), needsAdd: true },
    },
  ];

  if (cases.length !== GENESIS_CASE_COUNT) {
    throw new Error(`Expected exactly ${GENESIS_CASE_COUNT} Genesis cases.`);
  }
  return cases;
}
