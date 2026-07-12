# Fenrua Kernel Security Audit Log

This append-only public-safe log records assurance findings against the exact
P/N521 behavior implemented by this repository. It does not convert research
software into an audited production release.

## Initial independent review — 2026-07-12

### GA-001 — Evidence artifact binding

- **Severity:** Medium assurance risk
- **Status:** Resolved in source commit
  `85ecc97c026b01b576d735501795951dd293b3ca`.
- **Finding:** The initial `EvidenceArtifact` data structure allowed callers to
  pair arbitrary canonical bytes with an unrelated caller-supplied SHA-256.
- **Impact:** A backend that trusted the field could persist an internally
  inconsistent evidence record.
- **Resolution:** `EvidenceArtifact` now has a private constructor and a checked
  factory. The factory computes SHA-256 over the exact bytes through OpenSSL and
  rejects an empty media type. `valid()` recomputes the digest for boundary
  verification.
- **Evidence:** `tests/native_kernel_test.cpp` covers a SHA-256 known-answer
  vector, checked artifact creation and empty-media rejection.
- **Not claimed:** This finding was not a proof/public-input, agent-passport or
  execution-context commitment flaw. Those bindings are not present in the
  current relation and remain a separate future design gate.

### GA-002 — Mesh transition lost causal audit evidence

- **Severity:** Medium integrity/assurance risk
- **Status:** Resolved in source commit
  `85ecc97c026b01b576d735501795951dd293b3ca`.
- **Finding:** `NodeStateMachine::apply` validated evidence presence but the
  returned `Transition` omitted both the event type and evidence digest. Two
  different evidenced events could therefore produce indistinguishable
  persisted transition fields.
- **Impact:** A consumer following the instruction to persist returned
  transitions could not reconstruct which event and digest caused a state
  change.
- **Resolution:** Every accepted and rejected transition now retains its exact
  `EventType` and optional SHA-256 evidence value atomically with sequence,
  source state, destination state and decision.
- **Evidence:** Native tests assert that an evidenced sync transition returns
  the causal event and exact digest.
- **Not claimed:** The current `mesh/` layer is a deterministic local reducer.
  It does not yet implement a network, validator quorum, Merkle audit tree or
  global checkpoint anchoring.

### GA-003 — SHA-256 text canonicalization accepted uppercase aliases

- **Severity:** Low-to-medium canonicalization risk
- **Status:** Resolved in source commit
  `85ecc97c026b01b576d735501795951dd293b3ca`.
- **Finding:** `Sha256Digest::from_hex` accepted uppercase `A-F` while the
  evidence specification requires one lowercase 64-character representation.
- **Impact:** Multiple textual encodings could enter a receipt boundary and
  normalize to the same in-memory value.
- **Resolution:** The first C++ parsing gate now accepts exactly 64 lowercase
  hexadecimal characters. Serialization remains lowercase.
- **Evidence:** Native and differential tests require uppercase, malformed and
  wrong-length digest strings to fail closed.

### GA-004 — Installed CMake target was not discoverable

- **Severity:** Medium portability/reproducibility risk
- **Status:** Resolved in source commit
  `85ecc97c026b01b576d735501795951dd293b3ca`.
- **Finding:** Installation exported target files but omitted
  `fenrua_kernelConfig.cmake`, so a clean downstream
  `find_package(fenrua_kernel CONFIG REQUIRED)` failed.
- **Impact:** Consumers required undocumented path knowledge and could not use
  a standard reproducible CMake integration.
- **Resolution:** The install now exports package config and compatible-version
  files, declares its OpenSSL dependency and exposes `fenrua::kernel` through a
  standard config package.
- **Evidence:** `tests/cmake_consumer/` configures, links and runs against a
  clean temporary install prefix.

### GA-005 — N-order subtraction false rejection at borrow/carry boundary

- **Severity:** High correctness and availability risk
- **Status:** Resolved in source commit
  `85ecc97c026b01b576d735501795951dd293b3ca`; the permanent regression and
  broader post-fix circuit campaign passed.
- **Finding:** The first subtraction circuit added the modulus inside a
  borrow-only recurrence. For valid normalized operands `A = 2^64 - 1` and
  `B = 2^64`, a limb overflow produced a signed intermediate borrow of `-1`
  while the circuit constrained every borrow to `{0,1}`. Witness generation
  therefore rejected a valid subtraction.
- **Impact:** A valid P/N521 input could be falsely rejected, creating a
  deterministic denial-of-service or state-divergence trigger for any consumer
  that treated circuit acceptance as authoritative.
- **Resolution:** Replaced the mixed recurrence with two constrained phases:
  (1) ordinary borrowed subtraction modulo `2^521`; and (2) conditional
  addition of `n` with an independent carry chain. The final carry is
  constrained to equal `needsAdd`.
- **Reproducibility:** The exact public input is preserved at
  `regressions/regression_001_p521_sub_overflow.bin` as `A[66] || B[66]`.
  It is 132 bytes with SHA-256
  `7d11e62691085056fde7193c23cc7b3ffbfde2171807f820fc94cecf6f19ee5e`.
- **Verification:** The fixed circuit compiled to 4,711 constraints; the exact
  regression produced `n - 1`, `needsAdd = 1`, and passed `snarkjs wtns check`.
  An independent BigInt differential campaign then passed 852 addition and
  852 subtraction pairs: selected cross-products around radix, top-limb and
  order boundaries; explicit carry/borrow chains at every 64-bit limb; the
  original failure; and 500 deterministic random pairs from seed
  `0x46454e525541`. Its harness is
  `tests/audit/independent_circuit_differential.cjs` with SHA-256
  `5ca0cd257093b5ae7f2b61f7c8b120d11a0b3c9964deaaeb7d24c41da754f955`.
  Independent R1CS witness checks passed for the original subtraction
  counterexample and an addition fold boundary. These results remain separate
  from both the ten-case Genesis corpus and the 500,000-pair native P-field
  campaign.

The independent range-relation campaign separately passed 1,081 operand pairs
against the exact `1 <= r,s < n` predicate. Its harness is
`tests/audit/independent_range_differential.cjs` with SHA-256
`71e841bf3c0ca4ec45d347640b90a3e5e2ac84f1f2bec499e71c71a744dd34bd`.

### GA-006 — Proof statement did not bind arithmetic operands

- **Severity:** High statement-integrity risk
- **Status:** Resolved in source commit
  `85ecc97c026b01b576d735501795951dd293b3ca`; final proof evidence was
  regenerated from that clean source state.
- **Finding:** The initial add, subtract and range top-level circuits exposed
  outputs but declared no public inputs. Their R1CS files therefore had zero
  public inputs, so a Groth16 proof established the existence of some private
  operands rather than binding the exact operands named in a report.
- **Impact:** A valid proof/result pair could be replayed or substituted beside
  different reported operands without the verifier detecting the mismatch.
- **Resolution:** The top-level add/sub circuits now declare all nine limbs of
  `a` and `b` public; the range circuit declares all nine limbs of `r` and `s`
  public. Context/message inputs remain absent from this profile.
- **Verification:** Fresh R1CS data records 18 public inputs and zero private
  inputs for each arithmetic relation. Both published development proofs
  verified for their recorded public signals and failed after a one-limb
  mutation of `main.a[0]`. The proof record SHA-256 is
  `18dd205d46186ab6e1aa650eb24d24284df44164abf67cd57d94ececdb83c972`.

### GA-007 — Vulnerable transitive development dependency

- **Severity:** Medium supply-chain/tooling risk; upstream advisory severity High
- **Status:** Resolved in source commit
  `85ecc97c026b01b576d735501795951dd293b3ca`.
- **Finding:** `snarkjs -> bfj -> jsonpath` resolved `underscore` 1.13.6,
  affected by `GHSA-qpx9-hpmf-5gmw` (unbounded recursion and potential denial
  of service). This is development proof tooling, not Fenrua kernel runtime
  code.
- **Impact:** Processing adversarially structured data through the affected
  helper could exhaust the proof-tool process. Publishing the vulnerable
  lockfile would also leave a known High advisory in the reproducible build.
- **Resolution:** The root pnpm policy overrides the entire dependency graph to
  `underscore` 1.13.8 and declares that patched version directly for stable
  evidence discovery. The lockfile is committed and supply-chain policy checks
  remain enabled.
- **Verification:** `pnpm why underscore` resolves only 1.13.8 and
  `pnpm audit --audit-level high` reports zero vulnerabilities at every
  severity.

## Independent arithmetic campaign

The initial reviewer used deterministic `std::mt19937_64` seed
`0x46454e525541` and a Boost.Multiprecision oracle. The campaign covered:

- 500,000 randomized P-field pairs across add, subtract and negate;
- 200,000 arbitrary fixed-width 66-byte canonical parse decisions;
- 100,000 SHA-256 value parse/serialize round trips;
- field boundaries including zero, `p - 1`, rejection of `p`, and high-bit
  rejection; and
- selected evidence-gated mesh lifecycle transitions.

The original pre-fix harness is preserved byte-for-byte at
`tests/audit/independent_review_initial.cpp`. Its SHA-256 is
`7d30bbc334e7a8c553da27431e4ca12ed2822ce303ac4dae7c54de29a341d981`.
The original ASan/UBSan run passed. The post-fix harness SHA-256 is
`d97ef9fd501ba0459fecf80ba735725a9d31d3d7e312a6d49b4876b2b30fae44`;
its instrumented binary SHA-256 was
`e07b05cfbf95a4a521371bb541fc52a40440e8d1dafdc0b17c35ce02cf47001e`.
The post-fix ASan/UBSan rerun completed the same campaign with no sanitizer or
oracle failure.

## Frozen release evidence

- Frozen source commit:
  `85ecc97c026b01b576d735501795951dd293b3ca`
- Genesis manifest record SHA-256:
  `bd9ec111888ec32e87a5b60776f0118973848e5c096bbed8f25246e7fd3008cd`
- Genesis manifest file SHA-256:
  `5888bc67ab9ea7008e52fbdea3ce5f6bb0177b8ac52528cc7a5fcc7c8dc5ab6c`
- Aggregate Genesis record SHA-256:
  `a25a9e1c53b5554fb0b518d0ea54810dcdc7252b8742fe5ca76060f41c4f7960`
- Tool/source record SHA-256:
  `62a5b9406dffc5228e15317d2f27f7534709a05080ae7946584dddbb869974bd`
- Development-proof record SHA-256:
  `18dd205d46186ab6e1aa650eb24d24284df44164abf67cd57d94ececdb83c972`
- Regression fixture SHA-256:
  `7d11e62691085056fde7193c23cc7b3ffbfde2171807f820fc94cecf6f19ee5e`
- Independent review report file SHA-256:
  `9d9eeffceda4478356229bc2f3686aca3cf69744838b887b3bbc403639dff0d5`
- Final build-validation report file SHA-256:
  `e74a0ad32730f5129f3f691eb3c9caab31a98596212594d218056e50a1a26c93`
- Final security-scan report file SHA-256:
  `f79eecba651c976a72e485c2557cc327f1f620fa37f6b108eed219f37ce733d0`

The final portable verifier and same-host binary verifier both passed. A
second detached clean checkout of the frozen source regenerated all 14 Genesis
evidence files byte-for-byte with `SOURCE_DATE_EPOCH=1783855096`. Semgrep ran
240 applicable community rules with zero findings; Circomspect reported no
issues in the add, subtract and range relations; the Trivy secret scan reported
zero secrets; and the final dependency audit reported zero known advisories.

## Explicit future security gates

These are not implemented and must not be presented as resolved findings:

1. Define any future context/passport commitment as a versioned P/N521 public
   input and add substitution/replay tests.
2. Define mesh message identity, replay control and conflict semantics before
   adding validator communication.
3. Evaluate a Merkle or other append-only authenticated audit structure only
   after the local event schema is frozen.
4. Complete side-channel review before claiming constant-time behavior.
5. Obtain independent circuit, proving-system and setup review before any
   production promotion.
