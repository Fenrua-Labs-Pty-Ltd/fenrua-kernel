/**
 * Minimal example of the real Fenrua Kernel pipelines via the thin SDK.
 *
 * Research-grade only. Not production-approved.
 * Evidence Before Authority.
 *
 * Run from the sdk/ directory after:
 *   pnpm install          (kernel root)
 *   cd sdk && npm install && npx tsc
 */

import {
  runGenesis,
  generateDevelopmentProofs,
  verifyEvidence,
  KernelCommandError,
} from "./src/index.js";

function main() {
  console.log("=== Fenrua Thin SDK – real tool contracts ===\n");

  try {
    // 1. Genesis suite (ten fixed cases + permanent regressions)
    console.log("→ runGenesis()  (just test)");
    const genesis = runGenesis();
    const status = (genesis.report?.record as { status?: string } | undefined)?.status;
    console.log(`  Genesis status: ${status ?? "(no report)"}`);
    console.log(`  stdout tail: ${genesis.stdout.trim().split("\n").slice(-3).join(" | ")}\n`);

    // 2. Development proofs (research-only local ceremony)
    //    Requires circom + rapidsnark. Comment out if those tools are absent.
    console.log("→ generateDevelopmentProofs()  (just prove)");
    try {
      const proofs = generateDevelopmentProofs();
      const proofStatus = (proofs.report?.record as { status?: string } | undefined)?.status;
      console.log(`  Proof status: ${proofStatus ?? "(no report)"}\n`);
    } catch (err) {
      if (err instanceof KernelCommandError) {
        console.log("  Skipped or failed (circom/rapidsnark may be missing):");
        console.log(`  ${err.message.split("\n")[0]}\n`);
      } else {
        throw err;
      }
    }

    // 3. Verify published evidence + proofs
    console.log("→ verifyEvidence()  (just evidence)");
    const evidence = verifyEvidence();
    console.log(`  genesisOk=${evidence.genesisOk}  proofsOk=${evidence.proofsOk}`);
    console.log("\nEvidence Before Authority.");
  } catch (err) {
    if (err instanceof KernelCommandError) {
      console.error("Command failed:");
      console.error(err.message);
      process.exitCode = err.exitCode ?? 1;
      return;
    }
    throw err;
  }
}

main();
