import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildGenesisCases, GENESIS_CASE_COUNT, GENESIS_SUITE_ID } from '../tests/genesis-cases.mjs';
import {
  buildPn521Regressions,
  PN521_REGRESSION_COUNT,
  PN521_REGRESSION_FIXTURES,
} from '../tests/regression-cases.mjs';
import {
  CANONICALIZATION_ID,
  CANONICALIZATION_SPEC,
  assertIntegrity,
  assertSha256,
  sha256Canonical,
  sha256File,
} from './canonical-json.mjs';
import { EVIDENCE_SOURCE_FILES, assertExactUniqueSourcePaths } from './evidence-sources.mjs';
import {
  bigintToFixedHex,
  fieldAdd,
  fieldSubtract,
  fixedHexToBigint,
  fromLimbs9,
  isCanonicalFieldEncoding,
  isCanonicalOrderValue,
  orderAddTrace,
  orderSubtract,
  toLimbs9,
} from './pn521-reference.mjs';
import { resolveExecutable } from './tooling.mjs';

const REPORT_ROOT = path.resolve('tests/genesis/reports');
const SNARKJS = path.resolve('node_modules/snarkjs/build/cli.cjs');
const UNDERSCORE_SECURITY_OVERRIDE = '1.13.8';
const sameHost = process.argv.includes('--same-host');

function readEnvelope(file, label) {
  const envelope = JSON.parse(fs.readFileSync(file, 'utf8'));
  assertIntegrity(envelope, label);
  assertSha256(envelope.integrity.sha256, `${label} record SHA-256`);
  return envelope;
}

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} mismatch.\nexpected=${JSON.stringify(expected)}\nactual=${JSON.stringify(actual)}`);
  }
}

function assertFileEvidence(file, expectedSha256, expectedBytes, label) {
  assertSha256(expectedSha256, `${label} file SHA-256`);
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 0) {
    throw new Error(`${label} file byte length is invalid.`);
  }
  const stat = fs.statSync(file);
  if (stat.size !== expectedBytes) {
    throw new Error(`${label} file byte length mismatch: expected ${expectedBytes}, received ${stat.size}.`);
  }
  if (sha256File(file) !== expectedSha256) throw new Error(`${label} file SHA-256 mismatch.`);
}

function assertExactDirectoryEntries(directory, expectedNames, label) {
  const actual = fs.readdirSync(directory, { withFileTypes: true })
    .map((entry) => ({ name: entry.name, type: entry.isFile() ? 'file' : entry.isDirectory() ? 'directory' : 'other' }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const expected = [...expectedNames]
    .sort((left, right) => left.name.localeCompare(right.name));
  assertEqual(actual, expected, `${label} exact directory contents`);
}

function dependencyVersion(packageName) {
  const packageFile = path.resolve('node_modules', packageName, 'package.json');
  return JSON.parse(fs.readFileSync(packageFile, 'utf8')).version;
}

function expectedFor(testCase) {
  if (testCase.operation === 'canonicalize') {
    const accepted = isCanonicalFieldEncoding(testCase.input.encodingHex);
    return { accepted, canonicalHex: accepted ? testCase.input.encodingHex : null };
  }
  if (testCase.operation === 'add-mod-p' || testCase.operation === 'subtract-mod-p') {
    const left = fixedHexToBigint(testCase.input.leftHex);
    const right = fixedHexToBigint(testCase.input.rightHex);
    const result = testCase.operation === 'add-mod-p' ? fieldAdd(left, right) : fieldSubtract(left, right);
    return { accepted: true, resultHex: bigintToFixedHex(result) };
  }
  if (testCase.operation === 'nonzero-range-check') {
    const value = fromLimbs9(testCase.input.candidateLimbsLe64);
    return { valid: isCanonicalOrderValue(value, { nonZero: true }) };
  }
  if (testCase.operation === 'add-mod-n') {
    const left = fromLimbs9(testCase.input.leftLimbsLe64);
    const right = fromLimbs9(testCase.input.rightLimbsLe64);
    const trace = orderAddTrace(left, right);
    return {
      resultLimbsLe64: toLimbs9(trace.result),
      needsSubtract: trace.needsSubtract,
    };
  }
  const left = fromLimbs9(testCase.input.leftLimbsLe64);
  const right = fromLimbs9(testCase.input.rightLimbsLe64);
  return { resultLimbsLe64: toLimbs9(orderSubtract(left, right)), needsAdd: left < right };
}

if (!fs.existsSync(path.join(REPORT_ROOT, 'manifest.json'))) {
  throw new Error('Genesis evidence is missing; run just test first.');
}

const manifestEnvelope = readEnvelope(path.join(REPORT_ROOT, 'manifest.json'), 'manifest');
const manifest = manifestEnvelope.record;
if (
  manifest.canonicalization !== CANONICALIZATION_ID ||
  manifest.canonicalizationSpecification !== CANONICALIZATION_SPEC
) {
  throw new Error('Manifest canonicalization declaration is invalid.');
}
if (manifest.suiteId !== GENESIS_SUITE_ID || manifest.caseCount !== GENESIS_CASE_COUNT) {
  throw new Error('Manifest suite identity or case count is invalid.');
}
if (manifest.cases.length !== GENESIS_CASE_COUNT) throw new Error('Manifest must enumerate exactly ten cases.');

const definitions = buildGenesisCases();
assertExactDirectoryEntries(
  REPORT_ROOT,
  [
    { name: 'cases', type: 'directory' },
    { name: 'regressions', type: 'directory' },
    { name: 'genesis-report.json', type: 'file' },
    { name: 'manifest.json', type: 'file' },
    { name: 'tool-source-hashes.json', type: 'file' },
  ],
  'evidence root'
);
assertExactDirectoryEntries(
  path.join(REPORT_ROOT, 'cases'),
  definitions.map((definition) => ({
    name: `${String(definition.ordinal).padStart(2, '0')}-${definition.caseId}.json`,
    type: 'file',
  })),
  'Genesis case reports'
);
const definitionById = new Map(definitions.map((entry) => [entry.caseId, entry]));
const seen = new Set();
const aggregateCaseSummaries = [];
for (const [manifestIndex, entry] of manifest.cases.entries()) {
  if (seen.has(entry.caseId)) throw new Error(`Duplicate manifest case ${entry.caseId}.`);
  seen.add(entry.caseId);
  const definition = definitionById.get(entry.caseId);
  if (!definition) throw new Error(`Unknown manifest case ${entry.caseId}.`);
  if (definition.ordinal !== manifestIndex + 1) {
    throw new Error(`${entry.caseId}: manifest order does not match the exact ten-case definition.`);
  }
  const expectedPath = `tests/genesis/reports/cases/${String(definition.ordinal).padStart(2, '0')}-${definition.caseId}.json`;
  if (entry.path !== expectedPath) throw new Error(`${entry.caseId}: unexpected report path.`);

  const reportPath = path.resolve(entry.path);
  assertFileEvidence(reportPath, entry.fileSha256, entry.fileBytes, entry.caseId);
  assertSha256(entry.recordSha256, `${entry.caseId} record SHA-256`);
  const report = readEnvelope(reportPath, entry.caseId);
  if (report.integrity.sha256 !== entry.recordSha256) throw new Error(`${entry.caseId}: record SHA-256 mismatch.`);
  const record = report.record;
  if (record.caseId !== entry.caseId || record.suiteId !== GENESIS_SUITE_ID) {
    throw new Error(`${entry.caseId}: identity mismatch.`);
  }
  assertEqual(record.input, definition.input, `${entry.caseId} input`);
  assertEqual(record.expected, expectedFor(definition), `${entry.caseId} expected invariant`);
  assertEqual(record.actual.observed, record.expected, `${entry.caseId} backend observation`);
  if (record.passed !== true) throw new Error(`${entry.caseId}: case did not pass.`);
  aggregateCaseSummaries.push({
    ordinal: record.ordinal,
    caseId: record.caseId,
    classification: record.classification,
    domain: record.domain,
    operation: record.operation,
    passed: record.passed,
    recordSha256: report.integrity.sha256,
    reportPath: entry.path,
    reportFileSha256: entry.fileSha256,
    reportFileBytes: entry.fileBytes,
  });
  console.log(`PASS ${entry.caseId} ${entry.recordSha256}`);
}

if (!Array.isArray(manifest.regressions) || manifest.regressions.length !== PN521_REGRESSION_COUNT) {
  throw new Error(`Manifest must enumerate exactly ${PN521_REGRESSION_COUNT} non-Genesis regression.`);
}
const regressionDefinitions = buildPn521Regressions();
assertExactDirectoryEntries(
  path.join(REPORT_ROOT, 'regressions'),
  regressionDefinitions.map((definition) => ({
    name: `${definition.regressionId}.json`,
    type: 'file',
  })),
  'non-Genesis regression reports'
);
const aggregateRegressionSummaries = [];
for (const [index, entry] of manifest.regressions.entries()) {
  const definition = regressionDefinitions[index];
  if (!definition || entry.regressionId !== definition.regressionId) {
    throw new Error('Manifest regression identity/order is invalid.');
  }
  const expectedPath = `tests/genesis/reports/regressions/${definition.regressionId}.json`;
  if (entry.path !== expectedPath) throw new Error(`${entry.regressionId}: unexpected report path.`);
  const reportPath = path.resolve(entry.path);
  assertFileEvidence(reportPath, entry.fileSha256, entry.fileBytes, entry.regressionId);
  assertSha256(entry.recordSha256, `${entry.regressionId} record SHA-256`);
  const report = readEnvelope(reportPath, entry.regressionId);
  if (report.integrity.sha256 !== entry.recordSha256) {
    throw new Error(`${entry.regressionId}: record SHA-256 mismatch.`);
  }
  const record = report.record;
  assertEqual(record.input, definition.input, `${entry.regressionId} input`);
  assertEqual(record.expected, expectedFor(definition), `${entry.regressionId} expected invariant`);
  assertEqual(record.actual.observed, record.expected, `${entry.regressionId} backend observation`);
  if (record.passed !== true) throw new Error(`${entry.regressionId}: regression did not pass.`);
  aggregateRegressionSummaries.push({
    regressionId: record.regressionId,
    classification: record.classification,
    domain: record.domain,
    operation: record.operation,
    passed: record.passed,
    recordSha256: report.integrity.sha256,
    reportPath: entry.path,
    reportFileSha256: entry.fileSha256,
    reportFileBytes: entry.fileBytes,
  });
  console.log(`PASS ${entry.regressionId} ${entry.recordSha256}`);
}

if (!Array.isArray(manifest.fixtures) || manifest.fixtures.length !== PN521_REGRESSION_FIXTURES.length) {
  throw new Error('Manifest regression fixture set is incomplete.');
}
const exactFixtureSummaries = PN521_REGRESSION_FIXTURES.map((fixture, index) => {
  const entry = manifest.fixtures[index];
  const expected = {
    ...fixture,
    fileBytes: fixture.bytes,
    fileSha256: fixture.sha256,
  };
  assertEqual(entry, expected, `${fixture.path} manifest fixture evidence`);
  assertFileEvidence(fixture.path, entry.fileSha256, entry.fileBytes, fixture.path);
  return entry;
});

const aggregatePath = path.resolve(manifest.aggregate.path);
if (manifest.aggregate.path !== 'tests/genesis/reports/genesis-report.json') {
  throw new Error('Aggregate path is not canonical.');
}
assertFileEvidence(
  aggregatePath,
  manifest.aggregate.fileSha256,
  manifest.aggregate.fileBytes,
  'aggregate report'
);
assertSha256(manifest.aggregate.recordSha256, 'aggregate record SHA-256');
const aggregate = readEnvelope(aggregatePath, 'aggregate report');
if (aggregate.integrity.sha256 !== manifest.aggregate.recordSha256) throw new Error('Aggregate record SHA-256 mismatch.');
if (
  aggregate.record.status !== 'pass' ||
  aggregate.record.caseCount !== GENESIS_CASE_COUNT ||
  aggregate.record.passedCount !== GENESIS_CASE_COUNT ||
  aggregate.record.failedCount !== 0
) {
  throw new Error('Aggregate result counts are invalid.');
}
assertEqual(aggregate.record.cases, aggregateCaseSummaries, 'aggregate exact case summaries');
assertEqual(
  aggregate.record.regressions,
  aggregateRegressionSummaries,
  'aggregate exact regression summaries'
);
assertEqual(
  aggregate.record.regressionFixtures,
  exactFixtureSummaries,
  'aggregate exact regression fixtures'
);
if (aggregate.record.nativeCaseCount !== 6 || aggregate.record.circomWitnessCaseCount !== 4) {
  throw new Error('Aggregate backend case counts are invalid.');
}
if (
  aggregate.record.nonGenesisRegressionCount !== PN521_REGRESSION_COUNT ||
  aggregate.record.nonGenesisRegressionPassedCount !== PN521_REGRESSION_COUNT ||
  aggregate.record.nonGenesisRegressionFailedCount !== 0
) {
  throw new Error('Aggregate non-Genesis regression counts are invalid.');
}

const toolSourcePath = path.resolve(manifest.toolSourceHashes.path);
if (manifest.toolSourceHashes.path !== 'tests/genesis/reports/tool-source-hashes.json') {
  throw new Error('Tool/source path is not canonical.');
}
assertFileEvidence(
  toolSourcePath,
  manifest.toolSourceHashes.fileSha256,
  manifest.toolSourceHashes.fileBytes,
  'tool/source report'
);
assertSha256(manifest.toolSourceHashes.recordSha256, 'tool/source record SHA-256');
const toolSources = readEnvelope(toolSourcePath, 'tool/source hashes');
if (
  toolSources.record.canonicalization !== CANONICALIZATION_ID ||
  toolSources.record.canonicalizationSpecification !== CANONICALIZATION_SPEC
) {
  throw new Error('Tool/source canonicalization declaration is invalid.');
}
if (toolSources.integrity.sha256 !== manifest.toolSourceHashes.recordSha256) {
  throw new Error('Tool/source record SHA-256 mismatch.');
}
if (aggregate.record.toolSourceRecordSha256 !== toolSources.integrity.sha256) {
  throw new Error('Aggregate does not bind the exact tool/source record.');
}
const recordedSourcePaths = toolSources.record.sources.map((source) => source.path);
assertExactUniqueSourcePaths(recordedSourcePaths, 'recorded evidence sources');
assertEqual(recordedSourcePaths, [...EVIDENCE_SOURCE_FILES], 'exact evidence source paths');
for (const source of toolSources.record.sources) {
  assertSha256(source.sha256, `${source.path} source SHA-256`);
  if (sha256File(source.path) !== source.sha256) throw new Error(`Source changed: ${source.path}`);
}
assertEqual(
  toolSources.record.tools.map((tool) => tool.id),
  ['node', 'cxx', 'circom', 'rapidsnark'],
  'exact recorded tool identifiers'
);
for (const tool of toolSources.record.tools) {
  if (typeof tool.available !== 'boolean') throw new Error(`${tool.id} availability is invalid.`);
  if (tool.available) assertSha256(tool.sha256, `${tool.id} tool SHA-256`);
}
const rapidSnarkTool = toolSources.record.tools.find((tool) => tool.id === 'rapidsnark');
if (rapidSnarkTool?.available && rapidSnarkTool.version !== 'no-version-flag') {
  throw new Error('RapidSnark must use the explicit no-version-flag version marker.');
}
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const expectedDependencies = [
  { package: 'circomlib', declaredVersion: packageJson.devDependencies.circomlib },
  { package: 'snarkjs', declaredVersion: packageJson.devDependencies.snarkjs },
  { package: 'underscore', declaredVersion: UNDERSCORE_SECURITY_OVERRIDE },
];
assertEqual(
  toolSources.record.dependencies.map(({ package: packageName, declaredVersion }) => ({
    package: packageName,
    declaredVersion,
  })),
  expectedDependencies,
  'exact dependency declarations'
);
for (const dependency of toolSources.record.dependencies) {
  if (dependency.installedVersion !== dependencyVersion(dependency.package)) {
    throw new Error(`${dependency.package} installed version differs from the evidence record.`);
  }
  if (dependency.cliSha256) assertSha256(dependency.cliSha256, `${dependency.package} CLI SHA-256`);
}
if (sha256File(SNARKJS) !== toolSources.record.dependencies[1].cliSha256) {
  throw new Error('snarkjs CLI differs from the evidence record.');
}

const runMetadata = aggregate.record.runMetadata;
if (runMetadata.exactCommand !== 'node tools/run-genesis.mjs') {
  throw new Error('Aggregate exact command is invalid.');
}
assertEqual(runMetadata.commandAliases, ['pnpm run test', 'just test'], 'aggregate command aliases');
if (!/^v[0-9]+\.[0-9]+\.[0-9]+(?:[-+].+)?$/.test(runMetadata.nodeVersion)) {
  throw new Error('Run metadata Node.js version has an invalid shape.');
}
for (const field of ['platform', 'architecture', 'release']) {
  if (typeof runMetadata.operatingSystem?.[field] !== 'string' || !runMetadata.operatingSystem[field]) {
    throw new Error(`Run metadata operatingSystem.${field} is invalid.`);
  }
}
if (sameHost) {
  if (runMetadata.nodeVersion !== process.version) {
    throw new Error('Evidence Node.js version differs under --same-host verification.');
  }
  assertEqual(
    runMetadata.operatingSystem,
    { platform: process.platform, architecture: process.arch, release: os.release() },
    'same-host OS/architecture metadata'
  );
  const currentExecutables = new Map([
    ['node', fs.realpathSync(process.execPath)],
    ['cxx', process.env.CXX || resolveExecutable('c++')],
    ['circom', resolveExecutable('circom')],
    ['rapidsnark', resolveExecutable('rapidsnark')],
  ]);
  for (const tool of toolSources.record.tools) {
    const executable = currentExecutables.get(tool.id);
    if (tool.available !== Boolean(executable)) {
      throw new Error(`${tool.id} availability differs under --same-host verification.`);
    }
    if (executable && sha256File(executable) !== tool.sha256) {
      throw new Error(`${tool.id} binary differs under --same-host verification.`);
    }
  }
}
const parsedTimestamp = Date.parse(runMetadata.generatedAtUtc);
if (Number.isNaN(parsedTimestamp) || new Date(parsedTimestamp).toISOString() !== runMetadata.generatedAtUtc) {
  throw new Error('Run timestamp is not canonical ISO-8601 UTC.');
}
if (runMetadata.timestampSource === 'SOURCE_DATE_EPOCH') {
  if (!/^(0|[1-9][0-9]*)$/.test(runMetadata.sourceDateEpoch ?? '')) {
    throw new Error('SOURCE_DATE_EPOCH metadata is invalid.');
  }
  if (new Date(Number(runMetadata.sourceDateEpoch) * 1000).toISOString() !== runMetadata.generatedAtUtc) {
    throw new Error('Run timestamp does not match SOURCE_DATE_EPOCH.');
  }
} else if (runMetadata.timestampSource !== 'wall-clock' || runMetadata.sourceDateEpoch !== null) {
  throw new Error('Run timestamp source metadata is invalid.');
}
if (typeof runMetadata.git?.dirty !== 'boolean') throw new Error('Git dirty state is missing.');
if (
  runMetadata.git.revision !== 'unborn' &&
  !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(runMetadata.git.revision)
) {
  throw new Error('Git revision must be a lowercase SHA-1/SHA-256 object ID or unborn.');
}
assertSha256(runMetadata.git.statusSha256, 'Git status SHA-256');
const expectedRunId = sha256Canonical({
  suiteId: GENESIS_SUITE_ID,
  cases: aggregateCaseSummaries.map(({ caseId, recordSha256 }) => ({ caseId, recordSha256 })),
  regressions: aggregateRegressionSummaries.map(({ regressionId, recordSha256 }) => ({
    regressionId,
    recordSha256,
  })),
  fixtures: exactFixtureSummaries,
  toolSourceRecordSha256: toolSources.integrity.sha256,
});
if (runMetadata.runId !== expectedRunId) throw new Error('Run ID does not bind the exact cases and tool/source record.');

console.log(`Evidence status: pass (${GENESIS_CASE_COUNT}/${GENESIS_CASE_COUNT})`);
console.log(`Host policy: ${sameHost ? 'same-host enforced' : 'portable metadata-shape verification'}`);
console.log(`Manifest record SHA-256: ${manifestEnvelope.integrity.sha256}`);
