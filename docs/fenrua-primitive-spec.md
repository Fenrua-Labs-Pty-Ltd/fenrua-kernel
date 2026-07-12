# The Fenrua Primitive

**Document:** FKP-001

**Version:** 0.1.0-draft

**Status:** Research draft; not production-approved

**Target:** Fenrua P/N521 research primitive family

**Normative terms:** MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be read as requirement levels.

## 1. Abstract

The Fenrua Primitive specification describes P/N521, Fenrua's lighter experimental primitive
family for utility-kernel workloads, together with its versioned evidence protocol. It binds an
input statement, an exact experimental relation, a result, and reproducible artifact hashes into
one fail-closed receipt.

P/N521 is built around an explicitly versioned 521-bit arithmetic domain. Its claims are defined
only by this specification and the exact evidence profile cited by a result. SHA-256, Groth16,
Circom, RapidSnark, and other components retain their own specifications and assumptions.

## 2. Scope

The draft covers:

1. versioned P/N521 relations and their 521-bit value encodings;
2. native multi-precision arithmetic;
3. witness and circuit boundaries;
4. proof-pipeline and trusted-setup identification;
5. result receipts and SHA-256 evidence logs; and
6. validator-mesh messages that transport, but do not redefine, relation results.

It does not define consensus, asset custody, a token, key generation, wallet recovery, remote
attestation, or production authorization.

The intended data plane uses fixed-width canonical P/N521 encodings and a future compact,
versioned binary frame. ASN.1/DER objects, variable-length integers, and certificate envelopes are
outside that primitive hot path. JSON evidence envelopes in this draft are an audit/control-plane
format and MUST NOT be presented as the final high-performance mesh wire format.

## 3. Security status

All implementations conforming to this draft are research-grade unless an explicit later release
profile says otherwise. Passing the Genesis corpus is necessary evidence, not proof of security.

The current profile MUST NOT be used to:

- authorize transactions, releases, upgrades, validator membership, or identity;
- secure funds, production keys, or safety-critical state;
- claim constant-time behavior without measurement and review; or
- claim zero knowledge merely because a zk proof system is present.

Unknown versions, malformed encodings, missing evidence, arithmetic disagreement, constraint
failure, proof failure, and mesh ambiguity MUST fail closed.

### 3.1 Current implemented relation

The current P/N521 circuit family contains intentionally narrow research relations:

1. a three-limb 521-bit shape relation using widths 192, 192, and 137;
2. a nine-limb arithmetic shape using eight 64-bit limbs and one 9-bit top limb;
3. a range relation requiring both r and s to be non-zero and less than n;
4. addition modulo n for normalized operands; and
5. subtraction modulo n for normalized operands.

No current public relation has a message or context input. A conforming report MUST NOT claim
message binding, authorization, identity, or any property not enumerated above.

Every report MUST name the exact relation and circuit revision. Future relations that bind context
or add arithmetic MUST use a new version and must not silently strengthen the meaning of old
receipts.

## 4. Terms

**Statement** — Versioned public claim whose truth is evaluated.

**Witness** — Private or intermediate values supplied to a circuit. A witness is sensitive unless
its profile explicitly states otherwise.

**Computation profile** — Exact relation, numeric domain, encoding, circuit, proof-system, and
policy versions.

**Evidence receipt** — Machine-readable record binding a statement to its evaluation artifacts.

**Artifact digest** — Lowercase hexadecimal SHA-256 of the exact artifact bytes.

**Genesis corpus** — Ten deterministic positive, boundary, and adversarial P/N521 cases. The
checked-in test manifest is authoritative for case identifiers, implemented path, and expectations.

**Accepted** — The selected profile completed and returned its documented positive relation result.
It does not mean production-authorized.

## 5. Canonical data model

### 5.1 Relation and numeric-domain identity

A P/N521 computation profile MUST name its relation and numeric domain independently. A relation
identifier describes what is constrained; a numeric-domain identifier describes the modulus,
limb layout, and canonical external encoding. Implementations MUST reject unknown or ambiguous
identifiers.

P/N521 external fixed-width values are up to 521 bits and MUST use 66-byte unsigned big-endian
encoding. The unused high seven bits of the first byte MUST be zero. Variable-width, signed,
negative-zero, and redundant encodings MUST be rejected at a protocol boundary.

The current research numeric domain is:

    p = 2^521 - 1
    n = 0x01fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa51868783bf2f966b7fcc0148f709a5d03bb5c9b8899c47aebb6fb71e91386409

Host field values MUST be in [0, p - 1]. Range-relation operands r and s MUST be in [1, n - 1].
Modular add/subtract operands and results MUST be normalized into [0, n - 1].

### 5.2 Baseline operands

At the host boundary, a canonical field value is a fixed 66-byte big-endian value. At the
arithmetic-circuit boundary, a value is represented as nine little-endian limbs:

    L[0..7]: 64 bits each
    L[8]:     9 bits

The separate shape circuit uses three limbs with widths 192, 192, and 137. A profile MUST NOT mix
these layouts without an explicit, constrained conversion.

The selected relation MUST state the accepted interval for every operand and the exact modulus.
The range relation names its operands r and s; the modular operations name theirs a and b. These
names do not, by themselves, assert an authorization property.

### 5.3 Context inputs

A P/N521 relation MUST explicitly classify every context-like input as bound, unbound, reserved,
or absent. An unbound or reserved value MUST NOT appear in the relation result.

Every current public relation classifies message and context input as absent. A future
context-bound relation MUST use a new identifier and specify its encoding and binding semantics.

### 5.4 Domain separation

Every statement MUST include a non-empty ASCII domain and protocol version. A recommended draft
domain is:

    fenrua.kernel.pn521.experiment/v1

Changing relation, numeric domain, input binding, encoding, privacy mode, circuit, or proof system
requires a distinguishable computation-profile identifier.

## 6. Statement and receipt

The logical statement contains at least:

| Field | Requirement |
| --- | --- |
| protocol_version | Exact Fenrua evidence protocol version. |
| domain | Purpose-specific domain separator. |
| computation_profile | Identifier for relation, numeric domain, bindings, encoding, circuit, and proof rules. |
| relation_inputs | Ordered inputs or commitments, including an explicit bound/unbound classification. |

The evidence receipt contains at least:

| Field | Requirement |
| --- | --- |
| schema_version | Receipt schema version. |
| case_id | Stable test or operation identifier. |
| statement_sha256 | Digest of the exact serialized statement bytes. |
| result | satisfied or rejected for a named relation; no truthy aliases. |
| implementation_revision | Source commit or immutable source identifier. |
| computation_profile | Exact profile used. |
| artifact list | Relative name, media type, byte length, and SHA-256 for each report artifact. |
| environment | Architecture and pinned tool versions required to reproduce the run. |
| timestamp | Informational UTC time; not a source of consensus or ordering. |

Serialization used for statement hashing MUST be specified and deterministic. Until a canonical
serialization is frozen, the receipt MUST say which serializer and version produced the bytes.

The digest of an artifact is:

    SHA-256(exact file bytes)

Line-ending conversion, whitespace normalization, archive repacking, or JSON reformatting changes
the artifact and therefore MUST produce a new digest.

## 7. Layer invariants

### 7.1 Native arithmetic

- Field operations MUST reduce modulo the modulus named by the numeric-domain profile.
- Operations using the profile's order n MUST NOT accidentally use its field modulus.
- Carry, borrow, overflow, and final reduction behavior MUST be explicit for the selected limb layout.
- Conversion between limb arrays and canonical 66-byte values MUST round-trip.
- No ignored high limb, truncated carry, or implicit host integer conversion is permitted.

### 7.2 Witness generation

- Witness generation MUST validate canonical external inputs before deriving intermediates.
- It MUST NOT convert malformed input into a valid field element by reduction.
- Every derived witness field MUST map to a documented constraint or be explicitly marked
  diagnostic and excluded from the relation claim.
- Witness files MUST be treated as sensitive and excluded from public reports unless a test profile
  proves that every value is intentionally public.

### 7.3 Circuit

- The circuit MUST range-constrain each limb and every value whose host representation is wider
  than the circuit field.
- Non-native modular operations MUST constrain carries, reductions, and equality; host-calculated
  hints are not proof.
- The circuit MUST bind every input that its named relation classifies as bound.
- Changing a bound input MUST make proof verification or constraint satisfaction fail.
- Unbound and reserved inputs MUST be visible in the profile and MUST NOT appear in the result
  claim.

The current circuit family is limited to the documented shape, r/s range, add-mod-n, and
subtract-mod-n relations. It has no message or context input.

### 7.4 Proof pipeline

- Circuit source digest, compiler version, constraint count, proving-key digest, verification-key
  digest, prover version, and verifier result MUST be recorded.
- A proof MUST NOT be accepted under a verification key other than the one named by the profile.
- Groth16 setup provenance and contribution verification MUST be public before any candidate status.
- A successful proof demonstrates satisfaction of that circuit and setup. It does not independently
  prove that the P/N521 relation is suitable for a use beyond its explicitly reviewed profile.

### 7.5 Mesh

- Mesh messages MUST bind protocol version, network/domain, statement digest, result, sender
  identity, and replay-control data.
- Transport quorum MUST NOT expand a limited relation result into a stronger cryptographic claim.
- Conflicting receipts for the same statement MUST enter a deterministic fault state.
- Unknown message kinds, versions, or profiles MUST be rejected.
- Logs MUST avoid raw witnesses, private keys, and unredacted secret-bearing inputs.

## 8. Genesis evidence gate

The first research baseline consists of exactly ten deterministic P/N521 cases declared in the
test manifest. The set MUST contain positive, boundary, and adversarial coverage for the
implemented host and circuit paths. The manifest MUST identify which path each case exercises and
MUST NOT imply circuit coverage when only a host-side path ran.

For every case, the runner MUST:

1. start from checked-in or generated deterministic inputs;
2. record the expected result and observed result;
3. produce a report without secret material;
4. hash the exact report bytes with SHA-256;
5. record byte length, revision, command, and toolchain; and
6. exit non-zero if the expectation, artifact count, or digest verification fails.

The aggregate index MUST itself be hashed. Regenerating a report is evidence only when the
regenerated bytes match the recorded digest or the update is intentionally reviewed.

This gate establishes reproducible behavior only for the named implemented paths. It does not
establish exhaustive coverage, relation usefulness, circuit completeness, or production security.
Circuit reports MUST name the exact shape, range, add, or subtract relation. No current relation
claims message binding.

## 9. Privacy profiles

A proof is not automatically private. If all relation inputs are public, the proof primarily
attests computation. If a value is private, the statement MUST bind a commitment to it and
document information leaked by public inputs, proof shape, timing, logs, and mesh metadata.

No privacy claim is conformant until the exact public-input vector and commitment construction are
documented and reviewed.

## 10. Conformance and promotion

A P/N521 experiment MAY claim FKP-001 research-record conformance only when it:

- implements the canonical boundary checks;
- names the exact relation and every bound, unbound, reserved, and absent input;
- publishes per-report SHA-256 values and the aggregate index digest;
- pins enough of the toolchain to reproduce the run; and
- makes this research-only boundary visible to callers.

Passing a host-side Genesis case MUST NOT be substituted for circuit-relation evidence.

Promotion to Candidate requires frozen P/N521 semantics and wire format, a documented use and
security model, independent analysis, at least two implementations or a justified alternative,
differential or metamorphic tests appropriate to the custom relation, circuit review, setup
provenance, side-channel assessment, and a documented threat model.

Production-approved status requires an explicit release profile, independent security audits,
resolved critical findings, operational key and incident plans, and a governance decision naming
the exact source and artifact hashes. Time, test count, or a green CI run cannot promote status.

## 11. Open decisions

- Intended P/N521 relation beyond the current arithmetic scaffold.
- Whether a future P/N521 profile binds a message, commitment, work record, or no message at all.
- Security property and application utility claimed for each relation.
- Limb width and limb count for native and circuit representations.
- Canonical input-pair serialization beyond the fixed-width research baseline.
- Public-input and privacy profiles.
- Canonical statement and receipt serialization.
- Proof-system version and setup lifecycle.
- Validator identity binding, quorum, replay window, and equivocation policy.
- Performance targets and supported architectures.

Until resolved in a versioned revision, these decisions MUST NOT be inferred from one
implementation.
