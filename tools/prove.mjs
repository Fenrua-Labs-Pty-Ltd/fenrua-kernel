import fs from 'node:fs';
import path from 'node:path';

import {
  integrityFor,
  sha256Bytes,
  sha256Canonical,
  sha256File,
  writeJson,
} from './canonical-json.mjs';
import { relative, resolveExecutable, run } from './tooling.mjs';

const SNARKJS = path.resolve('node_modules/snarkjs/build/cli.cjs');
const GENESIS_ARTIFACTS = path.resolve('artifacts/pn521-genesis');
const PROOF_ROOT = path.resolve('artifacts/pn521-development-proofs');
const PUBLIC_EVIDENCE_ROOT = path.resolve('tests/proofs/evidence');
const PUBLIC_ARTIFACT_ROOT = path.join(PUBLIC_EVIDENCE_ROOT, 'artifacts');
const POWER = '14';
const CASES = [
  { caseId: 'genesis-09-order-add-exact-wrap', stem: 'p521_big_add', tamperSignal: 'main.a[0]' },
  { caseId: 'genesis-10-order-sub-underflow', stem: 'p521_big_sub', tamperSignal: 'main.a[0]' },
];

const rapidSnark = resolveExecutable('rapidsnark');
const circom = resolveExecutable('circom');
if (!rapidSnark) throw new Error('rapidsnark is required for the development proof pipeline.');
if (!circom) throw new Error('circom is required for the development proof pipeline.');
if (!fs.existsSync(SNARKJS)) throw new Error('snarkjs is not installed; run pnpm install first.');

const transcript = [];
const normalizedCommand = (command) => {
  const absolute = path.resolve(command);
  return absolute.startsWith(`${process.cwd()}${path.sep}`) ? relative(absolute) : path.basename(command);
};
const normalizedArgument = (argument) => {
  if (typeof argument !== 'string' || !path.isAbsolute(argument)) return argument;
  return argument.startsWith(`${process.cwd()}${path.sep}`) ? relative(argument) : argument;
};
function recordedRun(step, command, args, options = {}) {
  const result = run(command, args, options);
  transcript.push({
    step,
    command: normalizedCommand(command),
    arguments: args.map(normalizedArgument),
    exitCode: result.status,
    stdoutSha256: sha256Bytes(Buffer.from(result.stdout ?? '', 'utf8')),
    stderrSha256: sha256Bytes(Buffer.from(result.stderr ?? '', 'utf8')),
  });
  return result;
}

function artifactEvidence(file) {
  return {
    path: relative(file),
    bytes: fs.statSync(file).size,
    sha256: sha256File(file),
  };
}

function executableEvidence(id, executable, version) {
  return {
    id,
    version,
    binaryPath: normalizedCommand(executable),
    binarySha256: sha256File(executable),
  };
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

function r1csMetrics(result, caseId) {
  const output = stripAnsi(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  const metrics = new Map();
  for (const match of output.matchAll(
    /# of (Wires|Constraints|Private Inputs|Public Inputs|Outputs):\s*(\d+)/gi
  )) {
    metrics.set(match[1].toLowerCase(), Number(match[2]));
  }
  const read = (label) => {
    const value = metrics.get(label.toLowerCase());
    if (!Number.isSafeInteger(value)) throw new Error(`${caseId}: r1cs info omitted ${label}.`);
    return value;
  };
  return {
    wires: read('Wires'),
    constraints: read('Constraints'),
    privateInputs: read('Private Inputs'),
    publicInputs: read('Public Inputs'),
    outputs: read('Outputs'),
    publicSignals: read('Public Inputs') + read('Outputs'),
  };
}

function publicSignalIndex(symPath, signalName, publicSignalCount) {
  for (const line of fs.readFileSync(symPath, 'utf8').split(/\r?\n/)) {
    const parts = line.split(',');
    if (parts[3] === signalName) {
      const index = Number(parts[1]) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= publicSignalCount) {
        throw new Error(`${signalName} is not a public signal in ${relative(symPath)}.`);
      }
      return index;
    }
  }
  throw new Error(`Signal ${signalName} was not found in ${relative(symPath)}.`);
}

console.log('RESEARCH-ONLY: generating a local single-machine ceremony and development proofs.');
console.log('These proofs demonstrate arithmetic-circuit plumbing only and must never be treated as production trust material.');

recordedRun('regenerate-genesis-witnesses', process.execPath, ['tools/run-genesis.mjs']);
fs.rmSync(PROOF_ROOT, { recursive: true, force: true });
fs.rmSync(PUBLIC_EVIDENCE_ROOT, { recursive: true, force: true });
fs.mkdirSync(PROOF_ROOT, { recursive: true });
fs.mkdirSync(PUBLIC_ARTIFACT_ROOT, { recursive: true });

const pot0 = path.join(PROOF_ROOT, 'pn521_pot_0000.ptau');
const pot1 = path.join(PROOF_ROOT, 'pn521_pot_0001.ptau');
const potFinal = path.join(PROOF_ROOT, 'pn521_pot_final.ptau');
recordedRun('powers-of-tau-new', process.execPath, [SNARKJS, 'powersoftau', 'new', 'bn128', POWER, pot0]);
recordedRun('powers-of-tau-contribute', process.execPath, [
  SNARKJS,
  'powersoftau',
  'contribute',
  pot0,
  pot1,
  '--name=Fenrua P/N521 local research only',
  '-e=fenrua-pn521-known-development-entropy-not-secure',
]);
recordedRun('powers-of-tau-phase2', process.execPath, [
  SNARKJS,
  'powersoftau',
  'prepare',
  'phase2',
  pot1,
  potFinal,
]);

const proofCases = [];
for (const entry of CASES) {
  const r1cs = path.join(GENESIS_ARTIFACTS, 'circom', `${entry.stem}.r1cs`);
  const sym = path.join(GENESIS_ARTIFACTS, 'circom', `${entry.stem}.sym`);
  const witness = path.join(GENESIS_ARTIFACTS, 'witnesses', `${entry.caseId}.wtns`);
  const zkey0 = path.join(PROOF_ROOT, `${entry.stem}_0000.zkey`);
  const zkey = path.join(PROOF_ROOT, `${entry.stem}_development.zkey`);
  const vkey = path.join(PUBLIC_ARTIFACT_ROOT, `${entry.stem}_verification_key.json`);
  const proof = path.join(PUBLIC_ARTIFACT_ROOT, `${entry.caseId}.proof.json`);
  const publicSignals = path.join(PUBLIC_ARTIFACT_ROOT, `${entry.caseId}.public.json`);
  const tamperedPublicSignals = path.join(
    PUBLIC_ARTIFACT_ROOT,
    `${entry.caseId}.tampered-public.json`
  );

  const info = recordedRun(`${entry.caseId}:r1cs-info`, process.execPath, [
    SNARKJS,
    'r1cs',
    'info',
    r1cs,
  ]);
  const metrics = r1csMetrics(info, entry.caseId);
  if (metrics.publicInputs !== 18) {
    throw new Error(`${entry.caseId}: expected 18 public operand limbs, received ${metrics.publicInputs}.`);
  }

  recordedRun(`${entry.caseId}:groth16-setup`, process.execPath, [
    SNARKJS,
    'groth16',
    'setup',
    r1cs,
    potFinal,
    zkey0,
  ]);
  recordedRun(`${entry.caseId}:zkey-contribute`, process.execPath, [
    SNARKJS,
    'zkey',
    'contribute',
    zkey0,
    zkey,
    `--name=${entry.caseId} local research only`,
    `-e=${entry.caseId}-known-development-entropy-not-secure`,
  ]);
  recordedRun(`${entry.caseId}:zkey-verify`, process.execPath, [
    SNARKJS,
    'zkey',
    'verify',
    r1cs,
    potFinal,
    zkey,
  ]);
  recordedRun(`${entry.caseId}:export-vkey`, process.execPath, [
    SNARKJS,
    'zkey',
    'export',
    'verificationkey',
    zkey,
    vkey,
  ]);
  recordedRun(`${entry.caseId}:rapidsnark-prove`, rapidSnark, [
    zkey,
    witness,
    proof,
    publicSignals,
  ]);
  const verification = recordedRun(`${entry.caseId}:verify`, process.execPath, [
    SNARKJS,
    'groth16',
    'verify',
    vkey,
    publicSignals,
    proof,
  ]);
  if (!`${verification.stdout}\n${verification.stderr}`.includes('OK')) {
    throw new Error(`${entry.caseId}: snarkjs did not confirm the RapidSnark proof.`);
  }

  const publicValues = JSON.parse(fs.readFileSync(publicSignals, 'utf8'));
  if (publicValues.length !== metrics.publicSignals) {
    throw new Error(`${entry.caseId}: public signal count does not match R1CS metadata.`);
  }
  const tamperIndex = publicSignalIndex(sym, entry.tamperSignal, publicValues.length);
  const tamperedValues = [...publicValues];
  tamperedValues[tamperIndex] = (BigInt(tamperedValues[tamperIndex]) + 1n).toString();
  writeJson(tamperedPublicSignals, tamperedValues);
  const tamperVerification = recordedRun(
    `${entry.caseId}:tampered-public-rejection`,
    process.execPath,
    [SNARKJS, 'groth16', 'verify', vkey, tamperedPublicSignals, proof],
    { allowFailure: true }
  );
  const tamperedRejected =
    tamperVerification.status !== 0 ||
    !`${tamperVerification.stdout}\n${tamperVerification.stderr}`.includes('OK');
  if (!tamperedRejected) throw new Error(`${entry.caseId}: tampered public limb was accepted.`);

  proofCases.push({
    caseId: entry.caseId,
    circuit: `kernel/circuits/${entry.stem}.circom`,
    r1csMetrics: metrics,
    verified: true,
    tamperedPublicSignal: {
      signal: entry.tamperSignal,
      publicSignalIndex: tamperIndex,
      originalValue: publicValues[tamperIndex],
      tamperedValue: tamperedValues[tamperIndex],
      rejected: true,
    },
    artifacts: {
      r1cs: artifactEvidence(r1cs),
      witness: artifactEvidence(witness),
      setupZkey: artifactEvidence(zkey0),
      finalZkey: artifactEvidence(zkey),
      verificationKey: artifactEvidence(vkey),
      proof: artifactEvidence(proof),
      publicSignals: artifactEvidence(publicSignals),
      tamperedPublicSignals: artifactEvidence(tamperedPublicSignals),
    },
  });
  console.log(`PASS RapidSnark ${entry.caseId} tamper-rejected=true`);
}

const circomVersion = recordedRun('tool-version:circom', circom, ['--version']);
const snarkjsPackage = JSON.parse(fs.readFileSync('node_modules/snarkjs/package.json', 'utf8'));
const genesisManifest = path.resolve('tests/genesis/reports/manifest.json');
const record = {
  schemaVersion: 'fenrua.pn521.development-proof.v2',
  primitive: 'P/N521',
  status:
    proofCases.every((entry) => entry.verified && entry.tamperedPublicSignal.rejected)
      ? 'pass'
      : 'fail',
  proofSystem: 'Groth16 over BN254 via RapidSnark',
  exactCommand: 'node tools/prove.mjs',
  tools: [
    executableEvidence('node', fs.realpathSync(process.execPath), process.version),
    executableEvidence('circom', circom, stripAnsi(circomVersion.stdout).trim()),
    executableEvidence('snarkjs-cli', SNARKJS, snarkjsPackage.version),
    executableEvidence('rapidsnark', rapidSnark, 'no-version-flag'),
  ],
  ceremony: {
    classification: 'local-research-only',
    contributionModel: 'single machine with deliberately known development entropy',
    powerOfTau: Number(POWER),
    productionTrusted: false,
    reusableForSecurity: false,
    artifacts: {
      initialPtau: artifactEvidence(pot0),
      contributedPtau: artifactEvidence(pot1),
      finalPhase2Ptau: artifactEvidence(potFinal),
    },
  },
  provenance: {
    workingDirectory: '.',
    genesisManifest: artifactEvidence(genesisManifest),
    transcript,
    transcriptSha256: sha256Canonical(transcript),
    entropyDisclosure: 'All local ceremony entropy strings are fixed in this source and provide no production trust.',
  },
  scopeStatement: 'Proofs cover the N521 modular add/sub Circom development circuits only; each proof binds 18 public operand limbs.',
  publicArtifactPolicy: 'Only verification keys, proofs, public signals, tampered public signals, and this report are published. Witnesses, proving keys and ceremony artifacts remain excluded.',
  cases: proofCases,
};
const report = { record, integrity: integrityFor(record) };
const reportPath = path.join(PUBLIC_EVIDENCE_ROOT, 'development-proof-report.json');
writeJson(reportPath, report);
console.log(`Development proof report: ${relative(reportPath)}`);
console.log(`Development proof report bytes: ${fs.statSync(reportPath).size}`);
console.log(`Development proof record SHA-256: ${report.integrity.sha256}`);
