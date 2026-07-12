# Fenrua Kernel documents

This directory is the public research record for the kernel. It separates two kinds of writing:

- [The Fenrua Primitive specification](fenrua-primitive-spec.md) defines encodings,
  invariants, evidence objects, failure behavior, and conformance gates.
- [P/N521 utility-kernel research monograph](pn521-utility-kernel-monograph.md) records
  questions, methods, experiments, limitations, and falsification criteria.

Normative language appears only in the specification. The monograph may explain motivation
and report evidence, but it cannot silently change the protocol.

## Evidence rule

Every reported experiment should identify the source revision, toolchain, command, artifact
byte length, and SHA-256 digest. A digest proves byte identity, not correctness, authorship,
security, or independent review.

## Status vocabulary

| Label | Meaning |
| --- | --- |
| Research | Reproducible exploration; interfaces and assumptions may change. |
| Candidate | Frozen format, independent vector review, cross-implementation tests, and documented setup provenance. |
| Production-approved | Explicit release decision after independent security review and operational assessment. |

The repository is currently **Research**. No document here upgrades that status by implication.

## Current implemented relation

P/N521 is Fenrua's distinct, lighter experimental primitive family. Its current circuit family
checks 521-bit shape, non-zero r/s range below n, and addition/subtraction modulo n. No message or
context input is present in these relations. A proof is evidence only for the named constraints;
it does not imply message binding, authorization, or an unclaimed property.
