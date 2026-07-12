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
  integrityFor,
  sha256Canonical,
  sha256Bytes,
  sha256File,
  writeJson,
} from './canonical-json.mjs';
import { EVIDENCE_SOURCE_FILES, assertExactUniqueSourcePaths } from './evidence-sources.mjs';
import {
  P521_FIELD_PRIME,
  P521_ORDER,
  fieldAdd,
  fieldSubtract,
  fixedHexToBigint,
  fromLimbs9,
  isCanonicalFieldEncoding,
  isCanonicalOrderValue,
  orderAddTrace,
  orderSubtract,
  toLimbs9,
  bigintToFixedHex,
} from './pn521-reference.mjs';
import { firstNonEmptyLine, relative, resolveExecutable, run } from './tooling.mjs';

const ROOT = process.cwd();
const REPORT_ROOT = path.resolve('tests/genesis/reports');
const CASE_REPORT_ROOT = path.join(REPORT_ROOT, 'cases');
const REGRESSION_REPORT_ROOT = path.join(REPORT_ROOT, 'regressions');
const ARTIFACT_ROOT = path.resolve('artifacts/pn521-genesis');
const NATIVE_ROOT = path.join(ARTIFACT_ROOT, 'native');
const CIRCOM_ROOT = path.join(ARTIFACT_ROOT, 'circom');
const WITNESS_ROOT = path.join(ARTIFACT_ROOT, 'witnesses');
const SNARKJS = path.resolve('node_modules/snarkjs/build/cli.cjs');
const UNDERSCORE_SECURITY_OVERRIDE = '1.13.8';

const CIRCUITS = {
  'circom-p521-signature-range': {
    stem: 'p521_signature_range',
    source: 'kernel/circuits/p521_signature_range.circom',
  },
  'circom-p521-big-add': {
    stem: 'p521_big_add',
    source: 'kernel/circuits/p521_big_add.circom',
  },
  'circom-p521-big-sub': {
    stem: 'p521_big_sub',
    source: 'kernel/circuits/p521_big_sub.circom',
  },
};

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cleanAndPrepare() {
  fs.rmSync(REPORT_ROOT, { recursive: true, force: true });
  fs.rmSync(ARTIFACT_ROOT, { recursive: true, force: true });
  for (const directory of [CASE_REPORT_ROOT, REGRESSION_REPORT_ROOT, NATIVE_ROOT, CIRCOM_ROOT, WITNESS_ROOT]) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function compileNativeProbe() {
  const compiler = process.env.CXX || resolveExecutable('c++');
  if (!compiler) throw new Error('A C++20 compiler is required for native P-field cases.');
  const binary = path.join(NATIVE_ROOT, process.platform === 'win32' ? 'pn521_probe.exe' : 'pn521_probe');
  run(compiler, [
    '-std=c++20',
    '-O2',
    '-Wall',
    '-Wextra',
    '-Wpedantic',
    '-Iinclude',
    'tests/native/pn521_probe.cpp',
    'lib/p521_field_element.cpp',
    '-o',
    binary,
  ]);
  return { binary, compiler };
}

function compileCircuits() {
  if (!fs.existsSync(SNARKJS)) {
    throw new Error('snarkjs is not installed; run pnpm install first.');
  }
  const circom = resolveExecutable('circom');
  if (!circom) throw new Error('circom is required for N-order witness cases.');

  const compiled = {};
  for (const [backend, config] of Object.entries(CIRCUITS)) {
    run(circom, [config.source, '--r1cs', '--wasm', '--sym', '-o', CIRCOM_ROOT, '-l', 'node_modules']);
    writeJson(path.join(CIRCOM_ROOT, `${config.stem}_js`, 'package.json'), { type: 'commonjs' });
    compiled[backend] = {
      ...config,
      r1cs: path.join(CIRCOM_ROOT, `${config.stem}.r1cs`),
      sym: path.join(CIRCOM_ROOT, `${config.stem}.sym`),
      wasm: path.join(CIRCOM_ROOT, `${config.stem}_js`, `${config.stem}.wasm`),
      generator: path.join(CIRCOM_ROOT, `${config.stem}_js`, 'generate_witness.js'),
    };
  }
  return { circom, compiled };
}

function runNativeCase(testCase, native) {
  let args;
  if (testCase.operation === 'canonicalize') {
    args = ['canonicalize', testCase.input.encodingHex];
  } else if (testCase.operation === 'add-mod-p') {
    args = ['add', testCase.input.leftHex, testCase.input.rightHex];
  } else if (testCase.operation === 'subtract-mod-p') {
    args = ['sub', testCase.input.leftHex, testCase.input.rightHex];
  } else {
    throw new Error(`Unsupported native operation ${testCase.operation}.`);
  }

  const execution = run(native.binary, args);
  const observed = JSON.parse(execution.stdout);
  return {
    backend: testCase.backend,
    implementation: 'fenrua::p521::FieldElement',
    source: 'lib/p521_field_element.cpp',
    executableSha256: sha256File(native.binary),
    observed,
  };
}

function readSignalIndices(symPath) {
  const indices = new Map();
  for (const line of fs.readFileSync(symPath, 'utf8').split(/\r?\n/)) {
    const parts = line.split(',');
    if (parts.length >= 4) indices.set(parts[3], Number(parts[1]));
  }
  return indices;
}

function witnessInput(testCase) {
  if (testCase.operation === 'nonzero-range-check') {
    return {
      r: testCase.input.candidateLimbsLe64,
      s: testCase.input.companionLimbsLe64,
    };
  }
  return {
    a: testCase.input.leftLimbsLe64,
    b: testCase.input.rightLimbsLe64,
  };
}

function observedSignals(testCase, witness, indices) {
  const read = (name) => {
    const index = indices.get(name);
    if (!Number.isInteger(index) || witness[index] === undefined) {
      throw new Error(`${testCase.caseId}: missing witness signal ${name}.`);
    }
    return witness[index].toString();
  };

  if (testCase.operation === 'nonzero-range-check') {
    return { valid: read('main.valid') === '1' };
  }

  const limbs = Array.from({ length: 9 }, (_, index) => read(`main.result[${index}]`));
  if (testCase.operation === 'add-mod-n') {
    return { resultLimbsLe64: limbs, needsSubtract: read('main.needsSubtract') === '1' };
  }
  return { resultLimbsLe64: limbs, needsAdd: read('main.needsAdd') === '1' };
}

function runCircomCase(testCase, compiledCircuits) {
  const circuit = compiledCircuits[testCase.backend];
  if (!circuit) throw new Error(`No circuit configured for ${testCase.backend}.`);

  const inputPath = path.join(WITNESS_ROOT, `${testCase.caseId}.input.json`);
  const witnessPath = path.join(WITNESS_ROOT, `${testCase.caseId}.wtns`);
  const witnessJsonPath = path.join(WITNESS_ROOT, `${testCase.caseId}.witness.json`);
  writeJson(inputPath, witnessInput(testCase));
  run(process.execPath, [circuit.generator, circuit.wasm, inputPath, witnessPath]);
  run(process.execPath, [SNARKJS, 'wtns', 'check', circuit.r1cs, witnessPath]);
  run(process.execPath, [SNARKJS, 'wtns', 'export', 'json', witnessPath, witnessJsonPath]);

  const witness = JSON.parse(fs.readFileSync(witnessJsonPath, 'utf8'));
  const indices = readSignalIndices(circuit.sym);
  return {
    backend: testCase.backend,
    implementation: circuit.stem,
    source: circuit.source,
    constraintCheck: 'pass',
    observed: observedSignals(testCase, witness, indices),
    artifacts: {
      inputSha256: sha256File(inputPath),
      r1csSha256: sha256File(circuit.r1cs),
      wasmSha256: sha256File(circuit.wasm),
      witnessSha256: sha256File(witnessPath),
    },
  };
}

function referenceExpected(testCase) {
  if (testCase.operation === 'canonicalize') {
    const accepted = isCanonicalFieldEncoding(testCase.input.encodingHex);
    return {
      accepted,
      canonicalHex: accepted ? testCase.input.encodingHex : null,
    };
  }
  if (testCase.operation === 'add-mod-p' || testCase.operation === 'subtract-mod-p') {
    const left = fixedHexToBigint(testCase.input.leftHex);
    const right = fixedHexToBigint(testCase.input.rightHex);
    const result = testCase.operation === 'add-mod-p' ? fieldAdd(left, right) : fieldSubtract(left, right);
    return { accepted: true, resultHex: bigintToFixedHex(result) };
  }
  if (testCase.operation === 'nonzero-range-check') {
    return { valid: isCanonicalOrderValue(fromLimbs9(testCase.input.candidateLimbsLe64), { nonZero: true }) };
  }
  if (testCase.operation === 'add-mod-n') {
    const trace = orderAddTrace(
      fromLimbs9(testCase.input.leftLimbsLe64),
      fromLimbs9(testCase.input.rightLimbsLe64)
    );
    return { resultLimbsLe64: toLimbs9(trace.result), needsSubtract: trace.needsSubtract };
  }
  const left = fromLimbs9(testCase.input.leftLimbsLe64);
  const right = fromLimbs9(testCase.input.rightLimbsLe64);
  return { resultLimbsLe64: toLimbs9(orderSubtract(left, right)), needsAdd: left < right };
}

function caseRecord(testCase, actual) {
  const reference = referenceExpected(testCase);
  if (!sameJson(reference, testCase.expected)) {
    throw new Error(`${testCase.caseId}: declared expectation disagrees with the P/N521 reference invariant.`);
  }
  const passed = sameJson(actual.observed, testCase.expected) && actual.constraintCheck !== 'fail';
  return {
    schemaVersion: 'fenrua.pn521.genesis.case.v1',
    suiteId: GENESIS_SUITE_ID,
    ordinal: testCase.ordinal,
    caseId: testCase.caseId,
    classification: testCase.classification,
    primitive: 'P/N521',
    scopeStatement: 'P/N521 is tested only against its declared encodings, moduli, arithmetic, and constraint invariants.',
    domain: testCase.domain,
    operation: testCase.operation,
    input: testCase.input,
    expected: testCase.expected,
    actual,
    passed,
  };
}

function regressionRecord(regression, actual) {
  const reference = referenceExpected(regression);
  if (!sameJson(reference, regression.expected)) {
    throw new Error(`${regression.regressionId}: expectation disagrees with the P/N521 reference invariant.`);
  }
  const passed = sameJson(actual.observed, regression.expected) && actual.constraintCheck === 'pass';
  return {
    schemaVersion: 'fenrua.pn521.regression.v1',
    regressionId: regression.regressionId,
    classification: regression.classification,
    primitive: 'P/N521',
    scopeStatement: 'This permanent regression is separate from the exactly ten Genesis cases.',
    domain: regression.domain,
    operation: regression.operation,
    input: regression.input,
    expected: regression.expected,
    actual,
    passed,
  };
}

function envelope(record) {
  return { record, integrity: integrityFor(record) };
}

function dependencyVersion(packageName) {
  const packageFile = path.resolve('node_modules', packageName, 'package.json');
  return JSON.parse(fs.readFileSync(packageFile, 'utf8')).version;
}

function toolRecord(id, executable, versionArgs, explicitVersion = null) {
  if (!executable) return { id, available: false, version: null, sha256: null };
  const versionResult = versionArgs
    ? run(executable, versionArgs, { allowFailure: true })
    : { stdout: explicitVersion ?? 'unreported', stderr: '' };
  return {
    id,
    available: true,
    version: firstNonEmptyLine(`${versionResult.stdout}\n${versionResult.stderr}`),
    sha256: sha256File(executable),
  };
}

function buildToolSourceRecord(native, circom) {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const workspacePolicy = fs.readFileSync('pnpm-workspace.yaml', 'utf8').replace(/\r\n/g, '\n');
  if (workspacePolicy !== `overrides:\n  underscore: ${UNDERSCORE_SECURITY_OVERRIDE}\n`) {
    throw new Error('pnpm-workspace.yaml must retain the reviewed underscore security override.');
  }
  const rapidSnark = resolveExecutable('rapidsnark');
  assertExactUniqueSourcePaths([...EVIDENCE_SOURCE_FILES], 'configured evidence sources');
  const sources = EVIDENCE_SOURCE_FILES.map((file) => {
    if (!fs.existsSync(file)) throw new Error(`Evidence source is missing: ${file}`);
    return { path: file, sha256: sha256File(file) };
  });

  return {
    schemaVersion: 'fenrua.pn521.tool-source-hashes.v1',
    suiteId: GENESIS_SUITE_ID,
    canonicalization: CANONICALIZATION_ID,
    canonicalizationSpecification: CANONICALIZATION_SPEC,
    dependencies: [
      {
        package: 'circomlib',
        declaredVersion: packageJson.devDependencies.circomlib,
        installedVersion: dependencyVersion('circomlib'),
      },
      {
        package: 'snarkjs',
        declaredVersion: packageJson.devDependencies.snarkjs,
        installedVersion: dependencyVersion('snarkjs'),
        cliSha256: sha256File(SNARKJS),
      },
      {
        package: 'underscore',
        declaredVersion: UNDERSCORE_SECURITY_OVERRIDE,
        installedVersion: dependencyVersion('underscore'),
        resolutionPolicy: 'root security override for the snarkjs development dependency graph',
      },
    ],
    tools: [
      toolRecord('node', fs.realpathSync(process.execPath), ['--version']),
      toolRecord('cxx', native.compiler, ['--version']),
      toolRecord('circom', circom, ['--version']),
      toolRecord('rapidsnark', rapidSnark, null, 'no-version-flag'),
    ],
    sources,
  };
}

function gitMetadata() {
  const revisionResult = run('git', ['rev-parse', 'HEAD'], { allowFailure: true });
  const statusResult = run('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    allowFailure: true,
  });
  const status = statusResult.stdout.replace(/\r\n/g, '\n');
  return {
    revision: revisionResult.status === 0 ? revisionResult.stdout.trim().toLowerCase() : 'unborn',
    dirty: status.length > 0,
    statusSha256: sha256Bytes(Buffer.from(status, 'utf8')),
  };
}

function generatedAtUtc() {
  const sourceDateEpoch = process.env.SOURCE_DATE_EPOCH;
  if (sourceDateEpoch === undefined) {
    return { timestamp: new Date().toISOString(), source: 'wall-clock', sourceDateEpoch: null };
  }
  if (!/^(0|[1-9][0-9]*)$/.test(sourceDateEpoch)) {
    throw new Error('SOURCE_DATE_EPOCH must be a non-negative integer number of seconds.');
  }
  const milliseconds = Number(sourceDateEpoch) * 1000;
  if (!Number.isSafeInteger(milliseconds)) throw new Error('SOURCE_DATE_EPOCH is too large.');
  return {
    timestamp: new Date(milliseconds).toISOString(),
    source: 'SOURCE_DATE_EPOCH',
    sourceDateEpoch,
  };
}

const sourceGitMetadata = gitMetadata();
cleanAndPrepare();
const cases = buildGenesisCases();
const native = compileNativeProbe();
const { circom, compiled } = compileCircuits();
const summaries = [];

for (const testCase of cases) {
  const actual = testCase.domain === 'P521_FIELD'
    ? runNativeCase(testCase, native)
    : runCircomCase(testCase, compiled);
  const record = caseRecord(testCase, actual);
  const report = envelope(record);
  const reportPath = path.join(CASE_REPORT_ROOT, `${String(testCase.ordinal).padStart(2, '0')}-${testCase.caseId}.json`);
  writeJson(reportPath, report);
  summaries.push({
    ordinal: record.ordinal,
    caseId: record.caseId,
    classification: record.classification,
    domain: record.domain,
    operation: record.operation,
    passed: record.passed,
    recordSha256: report.integrity.sha256,
    reportPath: relative(reportPath),
    reportFileSha256: sha256File(reportPath),
    reportFileBytes: fs.statSync(reportPath).size,
  });
  console.log(`${record.passed ? 'PASS' : 'FAIL'} ${record.caseId} ${report.integrity.sha256}`);
}


const regressionSummaries = [];
for (const regression of buildPn521Regressions()) {
  const actual = runCircomCase(
    { ...regression, caseId: regression.regressionId },
    compiled
  );
  const record = regressionRecord(regression, actual);
  const report = envelope(record);
  const reportPath = path.join(REGRESSION_REPORT_ROOT, `${regression.regressionId}.json`);
  writeJson(reportPath, report);
  regressionSummaries.push({
    regressionId: record.regressionId,
    classification: record.classification,
    domain: record.domain,
    operation: record.operation,
    passed: record.passed,
    recordSha256: report.integrity.sha256,
    reportPath: relative(reportPath),
    reportFileSha256: sha256File(reportPath),
    reportFileBytes: fs.statSync(reportPath).size,
  });
  console.log(`${record.passed ? 'PASS' : 'FAIL'} ${record.regressionId} ${report.integrity.sha256}`);
}
if (regressionSummaries.length !== PN521_REGRESSION_COUNT) {
  throw new Error(`Expected exactly ${PN521_REGRESSION_COUNT} permanent non-Genesis regression.`);
}
const fixtureSummaries = PN521_REGRESSION_FIXTURES.map((fixture) => {
  const actualBytes = fs.statSync(fixture.path).size;
  const actualSha256 = sha256File(fixture.path);
  if (actualBytes !== fixture.bytes || actualSha256 !== fixture.sha256) {
    throw new Error(`Regression fixture evidence mismatch: ${fixture.path}`);
  }
  return { ...fixture, fileBytes: actualBytes, fileSha256: actualSha256 };
});

const toolSourceReportPath = path.join(REPORT_ROOT, 'tool-source-hashes.json');
const toolSourceReport = envelope(buildToolSourceRecord(native, circom));
writeJson(toolSourceReportPath, toolSourceReport);

const passedCount = summaries.filter((item) => item.passed).length;
const regressionPassedCount = regressionSummaries.filter((item) => item.passed).length;
const timestamp = generatedAtUtc();
const runMetadata = {
  runId: sha256Canonical({
    suiteId: GENESIS_SUITE_ID,
    cases: summaries.map(({ caseId, recordSha256 }) => ({ caseId, recordSha256 })),
    regressions: regressionSummaries.map(({ regressionId, recordSha256 }) => ({
      regressionId,
      recordSha256,
    })),
    fixtures: fixtureSummaries,
    toolSourceRecordSha256: toolSourceReport.integrity.sha256,
  }),
  generatedAtUtc: timestamp.timestamp,
  timestampSource: timestamp.source,
  sourceDateEpoch: timestamp.sourceDateEpoch,
  exactCommand: 'node tools/run-genesis.mjs',
  commandAliases: ['pnpm run test', 'just test'],
  nodeVersion: process.version,
  operatingSystem: {
    platform: process.platform,
    architecture: process.arch,
    release: os.release(),
  },
  git: sourceGitMetadata,
};
const aggregateRecord = {
  schemaVersion: 'fenrua.pn521.genesis.report.v1',
  suiteId: GENESIS_SUITE_ID,
  primitive: 'P/N521',
  status:
    passedCount === GENESIS_CASE_COUNT && regressionPassedCount === PN521_REGRESSION_COUNT
      ? 'pass'
      : 'fail',
  scopeStatement: 'This report covers P/N521 field/order encodings, modular arithmetic, and Circom constraint witnesses only.',
  invariants: {
    pFieldPrimeHex: `0x${P521_FIELD_PRIME.toString(16)}`,
    nOrderHex: `0x${P521_ORDER.toString(16)}`,
    fieldEncoding: '66-byte fixed-width big-endian; accepted iff 0 <= x < p',
    orderEncoding: 'nine little-endian limbs; limbs 0..7 are 64-bit and limb 8 is 9-bit',
    needsSubtractSemantics: 'After folding any 2^521 carry through (2^521 - n), needsSubtract is true exactly when the folded candidate is greater than or equal to n; it is not the raw carry bit.',
  },
  caseCount: GENESIS_CASE_COUNT,
  passedCount,
  failedCount: GENESIS_CASE_COUNT - passedCount,
  nativeCaseCount: summaries.filter((item) => item.domain === 'P521_FIELD').length,
  circomWitnessCaseCount: summaries.filter((item) => item.domain === 'N521_ORDER').length,
  nonGenesisRegressionCount: regressionSummaries.length,
  nonGenesisRegressionPassedCount: regressionPassedCount,
  nonGenesisRegressionFailedCount: regressionSummaries.length - regressionPassedCount,
  regressions: regressionSummaries,
  regressionFixtures: fixtureSummaries,
  developmentProofBoundary: 'RapidSnark proofs use a local research-only ceremony and are never an acceptance oracle for these cases.',
  runMetadata,
  toolSourceRecordSha256: toolSourceReport.integrity.sha256,
  cases: summaries,
};
const aggregatePath = path.join(REPORT_ROOT, 'genesis-report.json');
const aggregateReport = envelope(aggregateRecord);
writeJson(aggregatePath, aggregateReport);

const manifestRecord = {
  schemaVersion: 'fenrua.pn521.genesis.manifest.v1',
  suiteId: GENESIS_SUITE_ID,
  canonicalization: CANONICALIZATION_ID,
  canonicalizationSpecification: CANONICALIZATION_SPEC,
  caseCount: GENESIS_CASE_COUNT,
  aggregate: {
    path: relative(aggregatePath),
    recordSha256: aggregateReport.integrity.sha256,
    fileSha256: sha256File(aggregatePath),
    fileBytes: fs.statSync(aggregatePath).size,
  },
  toolSourceHashes: {
    path: relative(toolSourceReportPath),
    recordSha256: toolSourceReport.integrity.sha256,
    fileSha256: sha256File(toolSourceReportPath),
    fileBytes: fs.statSync(toolSourceReportPath).size,
  },
  cases: summaries.map(({ caseId, reportPath, recordSha256, reportFileSha256, reportFileBytes }) => ({
    caseId,
    path: reportPath,
    recordSha256,
    fileSha256: reportFileSha256,
    fileBytes: reportFileBytes,
  })),
  regressions: regressionSummaries.map(
    ({ regressionId, reportPath, recordSha256, reportFileSha256, reportFileBytes }) => ({
      regressionId,
      path: reportPath,
      recordSha256,
      fileSha256: reportFileSha256,
      fileBytes: reportFileBytes,
    })
  ),
  fixtures: fixtureSummaries,
};
const manifestPath = path.join(REPORT_ROOT, 'manifest.json');
writeJson(manifestPath, envelope(manifestRecord));

console.log(`Genesis status: ${aggregateRecord.status} (${passedCount}/${GENESIS_CASE_COUNT})`);
console.log(`Manifest: ${relative(manifestPath)}`);
if (aggregateRecord.status !== 'pass') process.exitCode = 1;
