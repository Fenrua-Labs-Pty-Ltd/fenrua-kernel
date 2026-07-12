# Fenrua Kernel

> **Research-grade P/N521 utility kernel. Not audited. Not production-approved.**
> Do not use this repository to secure funds, identity, consensus, validators, or authorization.

Fenrua Kernel is a small, evidence-first substrate for P/N521 research. It connects native
multi-precision arithmetic, witness generation, circuit constraints, proof tooling, and validator
transport to reports whose exact bytes are recorded with SHA-256.

The aim is utility, not spectacle: make one difficult cryptographic path understandable,
reproducible, and falsifiable before asking anyone to trust it.

P/N521 is Fenrua's own lighter experimental primitive family for utility-kernel workloads. Its
semantics and present assurance boundary are defined solely by the versioned Fenrua specification
and the evidence published in this repository.

## North star: an AI-agent security Layer-0

Fenrua Kernel is intended to become a small, high-performance security substrate for AI agents.
Its hot path uses fixed-width canonical values and compact versioned binary frames, avoiding
ASN.1/DER parsing, variable-length integer encodings, and certificate-envelope machinery in the
primitive data path. Deterministic JSON is retained for public audit receipts, not as the intended
high-throughput wire format.

The current release implements and tests the arithmetic foundation only. It does not yet bind an
agent identity, execution context, work record, or authorization decision. Those bindings require
a new versioned relation, a frozen binary frame, substitution/replay tests, and measured size and
latency evidence before this repository can claim the broader Layer-0 role.

## Current implemented scope

- The ten Genesis cases exercise canonical field encoding, field add/subtract, order range,
  and order add/subtract boundaries.
- The current Circom relation family checks 521-bit shape, non-zero r/s range below n, and
  add/subtract modulo n.
- No message or context input is present in the current public relations. Message binding is not
  part of their claim.
- A proof establishes only satisfaction of the named P/N521 relation under the recorded circuit
  and verification key. It does not establish authorization or a broader security property.

## Manifesto

**Evidence before authority.** A green result is useful only when another person can identify the
source, rerun the case, and match the artifact bytes.

**Small kernels are easier to question.** Arithmetic, witness generation, circuits, proof keys,
input adapters, and mesh policy have different assumptions. Fenrua keeps those boundaries
visible.

**Failure is data.** Malformed encodings, bad carries, invalid limbs, altered statements, failed
proofs, and conflicting receipts must be explicit outcomes. Nothing ambiguous becomes true.

**Transport is not truth.** Validators can carry and agree on receipts; they cannot turn an
unsatisfied relation or unsound circuit into a valid result.

**Research is a status, not a disclaimer pasted on production.** Ten Genesis cases and their
SHA-256 logs form a reproducible baseline. They are not an audit, a proof of completeness, or
permission to protect value.

**Promotion must be deliberate.** Candidate and production profiles require frozen formats,
independent vectors, differential testing, circuit and implementation review, setup provenance,
side-channel assessment, and an explicit release decision tied to exact source and artifact hashes.

## What the kernel contains

    fenrua-kernel/
    ├── .github/   issue forms for bugs, public-safe security concerns, and features
    ├── docs/      the Fenrua Primitive specification and research monograph
    ├── include/   public P/N521 primitive interfaces
    ├── kernel/    circuits, witness generation, and core verification logic
    ├── mesh/      validator communication and node state machine
    ├── lib/       native limb-based arithmetic
    ├── tests/     ten Genesis cases, reports, and SHA-256 evidence
    ├── tools/     Circom, RapidSnark, and evidence-pipeline helpers
    └── justfile   reproducible command entry points

Each layer has a narrow job:

| Layer | Responsibility | Must not imply |
| --- | --- | --- |
| Native | P/N521 limb arithmetic and canonical encoding | Constant-time or audited behavior |
| Kernel | Witnesses, versioned P/N521 relations, proofs, and receipts | Authorization from relation satisfaction |
| Mesh | Versioned receipt transport and deterministic state | Cryptographic validity from quorum |
| Tests | Positive, boundary, and adversarial P/N521 evidence | Exhaustive security coverage |
| Tools | Pinned orchestration and artifact hashing | Trust in an unrecorded local environment |

## The Fenrua Primitive

The [Fenrua Primitive](docs/fenrua-primitive-spec.md) specifies the P/N521 research family and its
versioned evidence envelope. Claims are limited to the exact relations and evidence named by that
specification.

The baseline binds:

1. a domain-separated statement;
2. an exact computation profile;
3. a relation result with an exact claim label;
4. source and toolchain identity; and
5. the byte length and SHA-256 of every public report artifact.

Canonical host-side field values use a fixed 66-byte big-endian form with seven unused high bits.
Arithmetic circuits use nine little-endian limbs: eight 64-bit limbs and one 9-bit top limb.
A separate shape experiment uses three limbs of 192, 192, and 137 bits. The range relation accepts
r and s only when both are non-zero and below n. Malformed or ambiguous encodings fail closed.

## Genesis evidence

The first gate is ten deterministic positive, boundary, and adversarial P/N521 cases. The
checked-in test manifest defines the exact case identifiers, implemented path, and expected
outcomes. Every run must produce:

- one public-safe report per case;
- expected and observed results;
- exact report byte lengths;
- a lowercase SHA-256 digest for every report;
- an aggregate evidence index and its digest; and
- revision, command, architecture, and pinned tool versions.

A digest establishes artifact identity. It does not establish correctness, authorship,
independence, or security.

Circuit reports must name the exact shape, range, modular-add, or modular-subtract relation they
exercise. No current relation claims message binding.

## Commands

The repository exposes a small command surface:

    just build
    just test
    just prove

Use the command descriptions in the justfile as the executable contract. A skipped dependency or
proof stage must be reported as skipped or failed, never passed.

## Read the research record

- [Document index](docs/README.md)
- [Fenrua Primitive specification](docs/fenrua-primitive-spec.md)
- [P/N521 utility-kernel monograph](docs/pn521-utility-kernel-monograph.md)

The specification owns normative protocol requirements. The monograph owns research questions,
methods, limitations, and results. Generated test reports own run-specific SHA-256 values.

## Security boundary

Treat all inputs as adversarial. Never commit private keys, production messages, secret witnesses,
ceremony secrets, validator credentials, or live infrastructure identifiers.

Potentially exploitable findings must not be filed as public issues. Use private vulnerability
reporting through the repository Security tab. The public security issue form is only for
non-sensitive hardening and documentation concerns.

No downstream system should accept a Fenrua result for production authorization until a later,
explicitly versioned release profile names the audited source, circuit, setup, verification key,
test evidence, operational controls, and governance approval.

## Contributing

Changes should be small enough to review and must state the invariant they preserve or revise.
Protocol-format changes need a versioning plan. Arithmetic and circuit changes need positive,
negative, boundary, and differential evidence. Generated reports must carry byte lengths and
SHA-256 digests.

Use the repository issue forms to report a reproducible bug, propose a feature, or raise a
public-safe security concern.
