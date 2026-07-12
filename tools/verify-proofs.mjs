import fs from 'node:fs';
import path from 'node:path';

import { assertIntegrity, assertSha256, sha256File } from './canonical-json.mjs';
import { run } from './tooling.mjs';

const ROOT = process.cwd();
const EVIDENCE_ROOT = path.resolve('tests/proofs/evidence');
const ARTIFACT_ROOT = path.join(EVIDENCE_ROOT, 'artifacts');
const REPORT_PATH = path.join(EVIDENCE_ROOT, 'development-proof-report.json');
const SNARKJS = path.resolve('node_modules/snarkjs/build/cli.cjs');

const CASES = [
  {
    caseId: 'genesis-09-order-add-exact-wrap',
    stem: 'p521_big_add',
    constraints: 6463,
  },
  {
    caseId: 'genesis-10-order-sub-underflow',
    stem: 'p521_big_sub',
    constraints: 4711,
  },
];

function relative(file) {
  return path.relative(ROOT, path.resolve(file)).split(path.sep).join('/');
}

function exactEntries(directory, expected, label) {
  const actual = fs.readdirSync(directory, { withFileTypes: true })
    .map((entry) => `${entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other'}:${entry.name}`)
    .sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} contents differ.\nexpected=${JSON.stringify(wanted)}\nactual=${JSON.stringify(actual)}`);
  }
}

function assertArtifact(evidence, expectedPath, label) {
  if (evidence.path !== expectedPath) throw new Error(`${label} path is not canonical.`);
  assertSha256(evidence.sha256, `${label} SHA-256`);
  if (!Number.isSafeInteger(evidence.bytes) || evidence.bytes < 1) {
    throw new Error(`${label} byte length is invalid.`);
  }
  const file = path.resolve(evidence.path);
  if (fs.statSync(file).size !== evidence.bytes) throw new Error(`${label} byte length differs.`);
  if (sha256File(file) !== evidence.sha256) throw new Error(`${label} SHA-256 differs.`);
}

if (!fs.existsSync(REPORT_PATH) || !fs.existsSync(SNARKJS)) {
  throw new Error('Public proof evidence or snarkjs is missing; run pnpm install and just prove.');
}

exactEntries(
  EVIDENCE_ROOT,
  ['directory:artifacts', 'file:development-proof-report.json'],
  'proof evidence root'
);
exactEntries(
  ARTIFACT_ROOT,
  CASES.flatMap((entry) => [
    `file:${entry.stem}_verification_key.json`,
    `file:${entry.caseId}.proof.json`,
    `file:${entry.caseId}.public.json`,
    `file:${entry.caseId}.tampered-public.json`,
  ]),
  'public proof artifacts'
);

const envelope = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
assertIntegrity(envelope, 'development proof report');
assertSha256(envelope.integrity.sha256, 'development proof record SHA-256');
const report = envelope.record;
if (
  report.schemaVersion !== 'fenrua.pn521.development-proof.v2' ||
  report.status !== 'pass' ||
  report.proofSystem !== 'Groth16 over BN254 via RapidSnark'
) {
  throw new Error('Development proof report identity/status is invalid.');
}
if (!Array.isArray(report.cases) || report.cases.length !== CASES.length) {
  throw new Error('Development proof report must contain exactly two cases.');
}

for (const [index, expected] of CASES.entries()) {
  const entry = report.cases[index];
  if (entry.caseId !== expected.caseId || entry.verified !== true) {
    throw new Error(`${expected.caseId}: report identity or verification status is invalid.`);
  }
  const metrics = entry.r1csMetrics;
  if (
    metrics.constraints !== expected.constraints ||
    metrics.publicInputs !== 18 ||
    metrics.privateInputs !== 0 ||
    metrics.outputs !== 10 ||
    metrics.publicSignals !== 28
  ) {
    throw new Error(`${expected.caseId}: R1CS metrics are outside the frozen profile.`);
  }
  if (entry.tamperedPublicSignal?.rejected !== true) {
    throw new Error(`${expected.caseId}: tampered public signal was not recorded as rejected.`);
  }

  const prefix = 'tests/proofs/evidence/artifacts';
  const vkeyPath = `${prefix}/${expected.stem}_verification_key.json`;
  const proofPath = `${prefix}/${expected.caseId}.proof.json`;
  const publicPath = `${prefix}/${expected.caseId}.public.json`;
  const tamperedPath = `${prefix}/${expected.caseId}.tampered-public.json`;
  assertArtifact(entry.artifacts.verificationKey, vkeyPath, `${expected.caseId} verification key`);
  assertArtifact(entry.artifacts.proof, proofPath, `${expected.caseId} proof`);
  assertArtifact(entry.artifacts.publicSignals, publicPath, `${expected.caseId} public signals`);
  assertArtifact(
    entry.artifacts.tamperedPublicSignals,
    tamperedPath,
    `${expected.caseId} tampered public signals`
  );

  const publicSignals = JSON.parse(fs.readFileSync(publicPath, 'utf8'));
  const tamperedSignals = JSON.parse(fs.readFileSync(tamperedPath, 'utf8'));
  if (publicSignals.length !== 28 || tamperedSignals.length !== 28) {
    throw new Error(`${expected.caseId}: public signal vector length differs.`);
  }
  const differences = publicSignals
    .map((value, signalIndex) => (value === tamperedSignals[signalIndex] ? null : signalIndex))
    .filter((signalIndex) => signalIndex !== null);
  if (
    differences.length !== 1 ||
    differences[0] !== entry.tamperedPublicSignal.publicSignalIndex ||
    BigInt(tamperedSignals[differences[0]]) !== BigInt(publicSignals[differences[0]]) + 1n
  ) {
    throw new Error(`${expected.caseId}: tamper vector is not the recorded one-limb mutation.`);
  }

  const valid = run(
    process.execPath,
    [SNARKJS, 'groth16', 'verify', vkeyPath, publicPath, proofPath],
    { allowFailure: true }
  );
  if (valid.status !== 0 || !`${valid.stdout}\n${valid.stderr}`.includes('OK')) {
    throw new Error(`${expected.caseId}: published proof did not verify.`);
  }
  const tampered = run(
    process.execPath,
    [SNARKJS, 'groth16', 'verify', vkeyPath, tamperedPath, proofPath],
    { allowFailure: true }
  );
  if (`${tampered.stdout}\n${tampered.stderr}`.includes('OK')) {
    throw new Error(`${expected.caseId}: published proof accepted a tampered public operand.`);
  }
  console.log(`PASS ${expected.caseId} proof-valid tamper-rejected`);
}

for (const tool of report.tools) {
  if (tool.binarySha256) assertSha256(tool.binarySha256, `${tool.id} binary SHA-256`);
}
if (relative(REPORT_PATH) !== 'tests/proofs/evidence/development-proof-report.json') {
  throw new Error('Development proof report path is not canonical.');
}
console.log(`Development proof record SHA-256: ${envelope.integrity.sha256}`);
