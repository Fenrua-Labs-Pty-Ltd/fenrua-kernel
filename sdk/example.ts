/**
 * Minimal example – prove + verify in under 20 lines.
 * Run from the sdk/ folder after pnpm install in the kernel root.
 */

import { prove, verify } from "./src/index.js";

async function main() {
  console.log("=== Fenrua Thin SDK Example ===");

  // 1. Prove a simple statement (uses the kernel's existing prove pipeline)
  const receipt = prove({
    statement: "genesis-09-order-add-exact-wrap",
  });

  console.log("Proof output (truncated):");
  console.log(receipt.slice(0, 300) + "...\n");

  // 2. Verify the receipt
  const ok = verify({
    receipt,
  });

  console.log("Verification result:", ok ? "VERIFIED ✓" : "FAILED ✗");
  console.log("\nEvidence Before Authority.");
}

main().catch(console.error);
