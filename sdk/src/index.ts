/**
 * Fenrua Thin SDK
 * Research-grade wrapper around the Fenrua Kernel.
 * Evidence Before Authority.
 *
 * This SDK does NOT claim production security. It only wraps the existing
 * research kernel so developers can call prove() and verify() with one-liners.
 */

import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Point at the kernel root (one level up from /sdk)
const KERNEL_ROOT = resolve(__dirname, "../..");

export interface ProveOptions {
  /** Human-readable statement or case name */
  statement: string;
  /** Optional private witness data */
  privateInput?: Record<string, unknown>;
}

export interface VerifyOptions {
  /** Path or content of the receipt / proof report */
  receipt: string;
  /** Optional public inputs for verification */
  publicInput?: Record<string, unknown>;
}

/**
 * Run a proof against the kernel.
 * Returns the raw stdout from the prove pipeline.
 */
export function prove(opts: ProveOptions): string {
  const args = ["tools/prove.mjs", JSON.stringify(opts)];
  const out = execFileSync("node", args, {
    cwd: KERNEL_ROOT,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return out.trim();
}

/**
 * Verify a receipt / proof report.
 * Returns true if the kernel reports VERIFIED.
 */
export function verify(opts: VerifyOptions): boolean {
  const args = ["tools/verify-proofs.mjs", JSON.stringify(opts)];
  const out = execFileSync("node", args, {
    cwd: KERNEL_ROOT,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return out.includes("VERIFIED") || out.includes(""verified": true");
}

export { prove as proveStatement, verify as verifyReceipt };
