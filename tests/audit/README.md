# Independent review artifacts

These sources preserve the exact review harnesses used before the initial
public release. They are evidence artifacts, not production library code.

## Native P-field differential campaign

- Original pre-fix harness: `independent_review_initial.cpp`
- Original SHA-256:
  `7d30bbc334e7a8c553da27431e4ca12ed2822ce303ac4dae7c54de29a341d981`
- Post-fix active harness: `../independent_pn521_differential.cpp`
- Post-fix SHA-256:
  `d97ef9fd501ba0459fecf80ba735725a9d31d3d7e312a6d49b4876b2b30fae44`
- Seed: `0x46454e525541`
- Coverage: 500,000 field pairs, 200,000 fixed-width encodings and 100,000
  SHA-256 value round trips.

The post-fix harness was compiled with ASan and UBSan and completed without a
sanitizer or oracle failure. Normal CMake/CTest execution does not claim that
sanitizers are enabled.

- Instrumented binary SHA-256:
  `e07b05cfbf95a4a521371bb541fc52a40440e8d1dafdc0b17c35ce02cf47001e`

## N-order circuit differential campaign

- Harness: `independent_circuit_differential.cjs`
- Harness SHA-256:
  `5ca0cd257093b5ae7f2b61f7c8b120d11a0b3c9964deaaeb7d24c41da754f955`
- Seed: `0x46454e525541`
- Coverage: 852 addition and 852 subtraction pairs, including explicit limb
  carry/borrow boundaries and 500 deterministic random pairs.

The preserved harness consumes Circom witness calculators compiled into
`/tmp/pn521-circuit-review`. Reproduce its environment with:

```bash
rm -rf /tmp/pn521-circuit-review
mkdir -p /tmp/pn521-circuit-review
circom kernel/circuits/p521_big_add.circom --r1cs --wasm --sym \
  -o /tmp/pn521-circuit-review -l node_modules
circom kernel/circuits/p521_big_sub.circom --r1cs --wasm --sym \
  -o /tmp/pn521-circuit-review -l node_modules
node tests/audit/independent_circuit_differential.cjs
```

Circomspect also completed at warning level with `No issues found.`:

```bash
circomspect --level WARNING --library node_modules \
  kernel/circuits/p521_big_add.circom \
  kernel/circuits/p521_big_sub.circom \
  kernel/circuits/p521_signature_range.circom
```

Current reviewed circuit source hashes:

- `big_add.circom`:
  `64266ead4c131610186f362abc6b1ac889af17cd1b29dee8d7a32382a6d46844`
- `big_sub.circom`:
  `67bacafee6427c50b2059306848a331fa15ffb8e3b9945c4b90df0ecdb903d1e`

## N-order range relation campaign

- Harness: `independent_range_differential.cjs`
- Harness SHA-256:
  `71e841bf3c0ca4ec45d347640b90a3e5e2ac84f1f2bec499e71c71a744dd34bd`
- Seed: `0x46454e525541`
- Coverage: 1,081 operand pairs: the full cross-product of selected zero,
  order, top-bit and adjacent boundaries plus 1,000 deterministic random
  521-bit pairs.
- Result: witness output matched `1 <= r,s < n` for every sampled pair.
