export const P521_BITS = 521n;
export const P521_FIELD_PRIME = (1n << P521_BITS) - 1n;
export const P521_ORDER = BigInt(
  '0x01fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa51868783bf2f966b7fcc0148f709a5d03bb5c9b8899c47aebb6fb71e91386409'
);
export const LIMB_BITS = 64n;
export const LIMB_COUNT = 9;
export const LIMB_RADIX = 1n << LIMB_BITS;
export const LIMB_MASK = LIMB_RADIX - 1n;
export const TOP_LIMB_LIMIT = 1n << 9n;
export const FIELD_ENCODING_BYTES = 66;
export const TWO_521 = 1n << P521_BITS;
export const ORDER_COMPLEMENT = TWO_521 - P521_ORDER;

export function bigintToFixedHex(value, byteLength = FIELD_ENCODING_BYTES) {
  if (typeof value !== 'bigint' || value < 0n) {
    throw new TypeError('Expected a non-negative bigint.');
  }
  const hex = value.toString(16);
  if (hex.length > byteLength * 2) {
    throw new RangeError(`Value does not fit in ${byteLength} bytes.`);
  }
  return `0x${hex.padStart(byteLength * 2, '0')}`;
}

export function fixedHexToBigint(value, byteLength = FIELD_ENCODING_BYTES) {
  if (!Number.isSafeInteger(byteLength) || byteLength <= 0) {
    throw new TypeError('byteLength must be a positive safe integer.');
  }
  const expectedCharacters = 2 + byteLength * 2;
  const body = typeof value === 'string' ? value.slice(2) : '';
  if (
    typeof value !== 'string' ||
    value.length !== expectedCharacters ||
    !value.startsWith('0x') ||
    !/^[0-9a-f]+$/.test(body)
  ) {
    throw new TypeError(`Expected a lowercase 0x-prefixed ${byteLength}-byte encoding.`);
  }
  return BigInt(value);
}

export function toLimbs9(value) {
  if (typeof value !== 'bigint' || value < 0n || value >= 1n << P521_BITS) {
    throw new RangeError('Value must fit the nine-limb 521-bit encoding.');
  }

  return Array.from({ length: LIMB_COUNT }, (_, index) =>
    ((value >> (LIMB_BITS * BigInt(index))) & LIMB_MASK).toString()
  );
}

export function fromLimbs9(limbs) {
  if (!Array.isArray(limbs) || limbs.length !== LIMB_COUNT) {
    throw new TypeError('Expected exactly nine little-endian limbs.');
  }

  let value = 0n;
  limbs.forEach((limb, index) => {
    if (typeof limb !== 'string' || !/^(0|[1-9][0-9]*)$/.test(limb)) {
      throw new TypeError(`Limb ${index} is not a canonical unsigned decimal string.`);
    }
    const parsed = BigInt(limb);
    const limit = index === LIMB_COUNT - 1 ? TOP_LIMB_LIMIT : LIMB_RADIX;
    if (parsed >= limit) {
      throw new RangeError(`Limb ${index} exceeds its encoding width.`);
    }
    value += parsed << (LIMB_BITS * BigInt(index));
  });
  return value;
}

export function isCanonicalFieldEncoding(encoded) {
  try {
    return fixedHexToBigint(encoded) < P521_FIELD_PRIME;
  } catch {
    return false;
  }
}

export function fieldAdd(left, right) {
  return (left + right) % P521_FIELD_PRIME;
}

export function fieldSubtract(left, right) {
  return (left - right + P521_FIELD_PRIME) % P521_FIELD_PRIME;
}

export function isCanonicalOrderValue(value, { nonZero = false } = {}) {
  return value >= (nonZero ? 1n : 0n) && value < P521_ORDER;
}

export function orderAdd(left, right) {
  return (left + right) % P521_ORDER;
}

export function orderAddTrace(left, right) {
  const rawSum = left + right;
  const carry521 = rawSum / TWO_521;
  const raw521 = rawSum % TWO_521;
  const folded = raw521 + carry521 * ORDER_COMPLEMENT;
  const needsSubtract = folded >= P521_ORDER;
  return {
    result: needsSubtract ? folded - P521_ORDER : folded,
    carry521,
    folded,
    needsSubtract,
  };
}

export function orderSubtract(left, right) {
  return (left - right + P521_ORDER) % P521_ORDER;
}
