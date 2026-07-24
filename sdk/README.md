# @fenrua/sdk – Thin TypeScript Wrapper

> **Research-grade only. Not production-approved.**  
> Evidence Before Authority.

This package is a minimal TypeScript façade over the three real Fenrua Kernel
evidence pipelines. It does **not** invent a general `prove(statement)` API.

The kernel only exercises fixed Genesis cases and two development proof
relations. The SDK simply makes those existing commands easy to call from
TypeScript and returns the structured reports the tools already write.

## Real contracts exposed

| SDK function | Kernel command | Purpose |
|---|---|---|
| `runGenesis()` | `node tools/run-genesis.mjs` (`just test`) | Ten deterministic Genesis cases + permanent regressions |
| `generateDevelopmentProofs()` | `node tools/prove.mjs` (`just prove`) | Research-only local-ceremony RapidSnark proofs |
| `verifyEvidence()` | `verify-evidence` + `verify-proofs` (`just evidence`) | Re-check published SHA-256 evidence and proofs |

## Quick start

From a full `fenrua-kernel` checkout:

```bash
pnpm install          # kernel root
cd sdk
npm install           # or pnpm install
npx tsc
node --loader ts-node/esm example.ts
```

## API sketch

```ts
import {
  runGenesis,
  generateDevelopmentProofs,
  verifyEvidence,
  readGenesisReport,
  readDevelopmentProofReport,
} from "@fenrua/sdk";

// 1. Run the fixed Genesis suite (writes tests/genesis/reports/)
const genesis = runGenesis();
console.log(genesis.report?.record.status); // "pass"

// 2. Generate the two development proofs (research-only ceremony)
const proofs = generateDevelopmentProofs();
console.log(proofs.report?.record.status);

// 3. Verify everything that was published
const evidence = verifyEvidence();          // portable checks
// const evidence = verifyEvidence({ sameHost: true }); // also bind Node/OS binaries

// 4. Read structured reports without re-running
const report = readGenesisReport();
const proofReport = readDevelopmentProofReport();
```

## What this does **not** claim

- No general-purpose proving API for arbitrary statements
- No message / context binding
- No authorization or production security guarantees
- No network, key custody, or remote verifier

The development proofs use a single-machine ceremony with deliberately known
entropy. They demonstrate arithmetic-circuit plumbing only.

## Requirements

- A complete `fenrua-kernel` checkout (the SDK discovers the root by walking
  upward from the call site / `process.cwd()`).
- Node.js ≥ 20 (kernel itself pins ≥ 24 for its own CI).
- Kernel dependencies already installed (`pnpm install` at the repo root).
- For proof generation: `circom` and `rapidsnark` on `PATH`.

## License

MIT (same as the surrounding research kernel material).
