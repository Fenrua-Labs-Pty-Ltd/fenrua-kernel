import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const CANONICALIZATION_ID = 'FENRUA-CANONICAL-JSON-V1';
export const CANONICALIZATION_SPEC =
  'UTF-8 JSON; plain-object keys sorted by JavaScript UTF-16 code units; arrays retain order; primitives use JSON.stringify; undefined and non-finite numbers are rejected.';

function assertJsonNumber(value) {
  if (!Number.isFinite(value)) {
    throw new TypeError('Canonical JSON does not support non-finite numbers.');
  }
}

export function canonicalize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    assertJsonNumber(value);
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Canonical JSON accepts plain objects only.');
    }

    const members = Object.keys(value)
      .sort()
      .map((key) => {
        if (value[key] === undefined) {
          throw new TypeError(`Canonical JSON field ${key} is undefined.`);
        }
        return `${JSON.stringify(key)}:${canonicalize(value[key])}`;
      });
    return `{${members.join(',')}}`;
  }

  throw new TypeError(`Unsupported canonical JSON type: ${typeof value}.`);
}

export function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function sha256Canonical(value) {
  return sha256Bytes(Buffer.from(canonicalize(value), 'utf8'));
}

export function sha256File(file) {
  return sha256Bytes(fs.readFileSync(file));
}

export function integrityFor(record) {
  const canonical = canonicalize(record);
  return {
    algorithm: 'SHA-256',
    canonicalization: CANONICALIZATION_ID,
    scope: '$.record',
    canonicalByteLength: Buffer.byteLength(canonical, 'utf8'),
    sha256: sha256Bytes(Buffer.from(canonical, 'utf8')),
  };
}

export function assertIntegrity(envelope, label = 'evidence envelope') {
  if (!envelope || typeof envelope !== 'object' || !envelope.record || !envelope.integrity) {
    throw new Error(`${label} must contain record and integrity objects.`);
  }

  const expected = integrityFor(envelope.record);
  for (const field of ['algorithm', 'canonicalization', 'scope', 'canonicalByteLength', 'sha256']) {
    if (envelope.integrity[field] !== expected[field]) {
      throw new Error(`${label} integrity mismatch at ${field}.`);
    }
  }
  return expected;
}

export function assertSha256(value, label = 'SHA-256') {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${label} must be exactly 64 lowercase hexadecimal characters.`);
  }
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
