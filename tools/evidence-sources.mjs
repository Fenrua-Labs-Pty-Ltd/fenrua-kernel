export const EVIDENCE_SOURCE_FILES = Object.freeze([
  'package.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'justfile',
  'include/fenrua/p521/field_element.hpp',
  'lib/p521_field_element.cpp',
  'kernel/circuits/p521_params.circom',
  'kernel/circuits/big_limb.circom',
  'kernel/circuits/big_compare.circom',
  'kernel/circuits/big_add.circom',
  'kernel/circuits/big_sub.circom',
  'kernel/circuits/p521_signature_range.circom',
  'kernel/circuits/p521_big_add.circom',
  'kernel/circuits/p521_big_sub.circom',
  'regressions/README.md',
  'regressions/regression_001_p521_sub_overflow.bin',
  'tests/genesis-cases.mjs',
  'tests/regression-cases.mjs',
  'tests/native/pn521_probe.cpp',
  'tools/canonical-json.mjs',
  'tools/pn521-reference.mjs',
  'tools/evidence-sources.mjs',
  'tools/generate-regression-fixtures.mjs',
  'tools/tooling.mjs',
  'tools/build.mjs',
  'tools/run-genesis.mjs',
  'tools/prove.mjs',
  'tools/verify-evidence.mjs',
  'tools/verify-proofs.mjs',
]);

export function assertExactUniqueSourcePaths(paths, label = 'source paths') {
  if (!Array.isArray(paths)) throw new TypeError(`${label} must be an array.`);
  if (new Set(paths).size !== paths.length) throw new Error(`${label} contains duplicate paths.`);
  if (paths.length !== EVIDENCE_SOURCE_FILES.length) {
    throw new Error(`${label} must contain exactly ${EVIDENCE_SOURCE_FILES.length} entries.`);
  }
  EVIDENCE_SOURCE_FILES.forEach((expected, index) => {
    if (paths[index] !== expected) {
      throw new Error(`${label}[${index}] must be ${expected}, received ${paths[index]}.`);
    }
  });
}
