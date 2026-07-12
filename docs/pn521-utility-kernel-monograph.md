# A utility kernel for reproducible P/N521 evidence

**Fenrua P/N521 research monograph — working skeleton**

**Revision:** 0.1

**Status:** Research programme; results require independent reproduction

## Abstract

This monograph studies whether P/N521, Fenrua's distinct lightweight 521-bit research primitive,
can make utility-kernel computations inspectable across native arithmetic, non-native circuits,
proof generation, and validator transport. The intended contribution is a narrow, versioned
relation whose claims connect to deterministic cases, byte-identical reports, and a SHA-256
evidence trail.

The current repository is experimental. It is not approved to secure assets, consensus,
production identity, or authorization.

The current implemented relation family covers 521-bit input shape, non-zero ranges below n for
r and s, and addition/subtraction modulo n. No current relation accepts a message or context input.
This is the defined scope of the present P/N521 experiment, not a claim of message authentication.

## 1. Motivation

AI and protocol teams often inherit a gap between high-level trust claims and the artifacts that
could falsify them. Fenrua's utility-kernel thesis is that the smallest useful substrate should:

- perform one bounded verifiable-arithmetic job;
- expose its encodings and failure modes;
- separate native computation from circuit claims;
- carry evidence without turning transport quorum into cryptographic truth; and
- let another researcher reproduce the exact reports before trusting a conclusion.

P/N521 is an instructive utility-kernel target because its 521-bit arithmetic does not fit ordinary
256-bit execution paths. That forces limb representation, carry handling, reduction, range
discipline, context binding, and non-native circuit constraints into the open.

The architectural target is a Layer-0 security kernel for AI agents. Its primitive data path uses
fixed-width values and compact versioned framing rather than ASN.1/DER or variable-length integer
envelopes. Public JSON receipts remain useful as an inspection layer, but they are not the target
mesh data plane. Any performance claim must measure the exact binary frame, implementation,
hardware, corpus, and comparison boundary; avoiding a legacy encoding is a design property, not by
itself proof of lower end-to-end latency.

## 2. Research questions

**RQ1 — Representation.** Which limb layout gives the clearest correct native arithmetic while
remaining practical for witness generation and circuit constraints?

**RQ2 — Layer agreement.** Can native, host, witness, and circuit implementations agree on the
same versioned P/N521 relation and adversarial boundary cases?

**RQ3 — Constraint soundness.** Are the declared carries, reductions, ranges, and modular
relations constrained rather than merely calculated by the witness generator?

**RQ4 — Evidence.** Can every experimental conclusion be traced to immutable input, report, build,
and proof artifacts using SHA-256 and byte lengths?

**RQ5 — Transport.** Can a validator mesh disseminate a relation receipt with deterministic
replay and conflict handling without treating quorum as a substitute for verification?

**RQ6 — Utility.** What cost and latency boundaries would make this kernel useful for verifiable
AI work records or protocol evidence while preserving fail-closed behavior?

## 3. Hypotheses

| ID | Falsifiable hypothesis | Evidence needed |
| --- | --- | --- |
| H1 | Canonical 66-byte values round-trip through the chosen limb form without loss. | Boundary and randomized differential tests. |
| H2 | Native modular addition agrees with an independent big-integer arithmetic oracle. | Seeded corpus, edge cases, and mismatch log. |
| H3 | Every satisfied circuit witness corresponds exactly to the documented P/N521 relation. | Constraint audit, mutation tests, and independent arithmetic vectors. |
| H4 | Each Genesis run can be reproduced byte-for-byte in a pinned environment. | Ten reports, SHA-256 index, clean-room rerun. |
| H5 | Altering any input classified as bound causes proof verification to fail. | One-factor tamper matrix across bound inputs and confirmation that absent inputs are not represented. |
| H6 | Mesh nodes converge or enter a defined fault state for duplicates, replays, and conflicts. | Deterministic state-machine traces and property tests. |

A failed hypothesis is a result to document, not an outcome to hide.

## 4. System boundary

The kernel has five evidence-bearing layers:

    canonical input
          |
          v
    native P/N521 arithmetic
          |
          v
    witness generation -> circuit constraints -> proof and verification
          |                                      |
          +------------ evidence receipt --------+
                                                 |
                                                 v
                                          validator mesh

The native layer is an implementation, not an oracle by authority. The circuit must be reviewed
independently of witness generation. The mesh transports versioned receipts; it cannot repair a
false statement, expand a narrow claim, or correct an unsound circuit.

Outside scope are key custody, production entropy and key generation, chain consensus, token
economics, production validator admission, and user-facing authorization.

## 5. Method

### 5.1 Reproducible environment

Record:

- source commit and dirty-worktree status;
- OS, architecture, compiler, runtime, and dependency versions;
- Circom, snarkjs or equivalent tooling, and RapidSnark revisions;
- circuit source, constraint system, proving key, and verification key digests;
- exact command and environment flags; and
- UTC run time as metadata, never as proof of ordering.

### 5.2 Vector provenance

For each vector, record its author or generator, upstream reference, license, generation procedure,
original digest, local transformed digest, and every transformation. Generated private keys and
witnesses must not be published merely to make a test convenient.

At least one arithmetic corpus should be generated by an independent method. Self-generated
vectors alone can reproduce the same misunderstanding across every layer.

### 5.3 Genesis experiment

Run the ten checked-in Genesis cases from a clean build. The suite must include positive, boundary,
and adversarial cases for every implemented path. Its manifest must identify whether each case
exercises host logic, native arithmetic, the circuit, or more than one layer.

For each case collect:

- stable case identifier and description;
- public-safe input references;
- expected and observed result;
- host, native, witness, circuit, prover, and verifier outcomes where applicable;
- duration and peak-memory observations;
- report byte length and SHA-256; and
- any deviation, skipped layer, or environmental warning.

No skipped step may be represented as passed.

### 5.4 Differential testing

Compare native arithmetic with an independent arbitrary-precision calculation of the exact
P/N521 relation. Generate deterministic boundary and randomized cases from a recorded seed.
Shrink mismatches to a minimal counterexample and retain the mismatch report even after a fix.

### 5.5 Circuit challenge plan

For the current relation, attempt to satisfy the circuit with:

- operands outside each declared interval;
- incorrect carries, unreduced values, and aliased limb encodings;
- an incorrect claimed addition or subtraction result modulo n;
- a host hint changed without a corresponding constraint;
- altered public inputs after proof generation; and
- the wrong verification key or computation profile.

Confirm that no current public-input schema contains a message or context field. The experiment
succeeds only when each bound-input mutation fails for the intended reason and the public-input
schema matches the specification.

### 5.6 Mesh experiment

Model duplicate delivery, delay, reordering, replay, conflicting receipts, unknown versions,
validator churn, and partial connectivity. Record deterministic state transitions. Separate:

1. P/N521 relation evaluation;
2. validator identity and admission;
3. transport delivery;
4. quorum policy; and
5. application authorization.

Conflating these stages is a security finding.

## 6. Metrics

| Dimension | Measures |
| --- | --- |
| Correctness | Oracle agreement, mutation rejection, invariant coverage, mismatch count. |
| Circuit | Constraints, non-linear constraints, witness size, compile time. |
| Proving | Proving time, verification time, proof size, peak memory. |
| Evidence | Artifact count, hash coverage, byte-identical rerun rate. |
| Mesh | Convergence steps, replay rejection, conflict detection, message size. |
| Maintainability | Pinned dependencies, specification coverage, cross-platform agreement. |

Performance measurements must name hardware, power mode, sample count, warm-up, and summary
statistics. A single timing is an observation, not a benchmark.

## 7. Threat model

Assume an adversary may provide malformed encodings, extreme limb values, out-of-range operands,
incorrect modular results, crafted witnesses, stale proofs, wrong verification keys, replayed
receipts, conflicting mesh messages, and resource-exhaustion inputs. Also assume that a developer,
test-vector generator, dependency, or ceremony can be wrong without malice.

This research does not yet claim resistance to:

- cache, branch, power, electromagnetic, or fault-injection side channels;
- compromised build hosts or dependency registries;
- toxic-waste retention or a flawed trusted setup;
- compiler, prover, verifier, or circuit bugs;
- validator-key compromise or Sybil control; or
- metadata leakage from timing and mesh topology.

## 8. Evidence interpretation

SHA-256 digests establish that two byte strings match with the hash function's collision-resistance
assumption. They do not establish that a report is true, that a binary came from reviewed source,
that a setup was honest, or that an experiment was independent.

Likewise:

- a satisfied P/N521 relation does not identify or authorize a validator;
- a valid proof attests one circuit under one verification key;
- ten passing cases do not exhaust a 521-bit domain;
- a quorum does not correct unsound cryptography; and
- research-grade means suitable for disciplined study, not suitable for production custody.

## 9. Results ledger

Populate this section from generated, checked-in evidence. Do not hand-copy digests.

| Case | Expected | Observed | Report bytes | Report SHA-256 | Notes |
| --- | --- | --- | ---: | --- | --- |
| See tests manifest | pending | pending | pending | pending | Generated evidence is authoritative. |

Aggregate index SHA-256: **pending generated run**

Source revision: **pending generated run**

Toolchain fingerprint: **pending generated run**

## 10. Promotion and stop conditions

Remain at Research status if any of the following holds:

- a Genesis expectation fails or an evidence digest is missing;
- native and independent arithmetic calculations disagree without resolution;
- an input claimed as bound or a security-relevant witness value is unconstrained;
- setup provenance or verification-key binding is ambiguous;
- malformed or unknown versions do not fail closed;
- secret material enters public reports; or
- claimed reproduction requires undocumented local state.

Candidate evaluation begins only after the specification format is frozen, the corpus is
independently reviewed, differential and mutation campaigns pass, setup assumptions are published,
and at least one external reviewer reproduces the evidence.

Production use requires a separate decision and evidence set. It cannot be inferred from this
monograph.

## 11. Planned chapters

1. P/N521 numeric domain, encodings, and versioned relation semantics.
2. Limb selection and modular arithmetic proofs.
3. Extended modular operations and exceptional cases.
4. Circuit field mismatch and non-native constraint design.
5. Witness construction and independent oracle strategy.
6. Proof-system assumptions and ceremony provenance.
7. Receipt serialization and content-addressed evidence.
8. Validator mesh safety and liveness.
9. Genesis results and differential campaigns.
10. Independent review, limitations, and future work.

## 12. Research log template

For each experiment append:

- date and researcher;
- question and pre-registered expectation;
- source revision and environment;
- exact command;
- artifact manifest and SHA-256 values;
- observed result;
- deviations and possible confounders;
- conclusion and confidence; and
- follow-up falsification test.

Negative results and abandoned approaches belong in the record when they affect the interpretation
of later work.
