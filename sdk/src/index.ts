/**
 * @fenrua/sdk – Thin TypeScript wrapper for the Fenrua Kernel research pipelines.
 *
 * RESEARCH-GRADE ONLY. Not production-approved.
 * Evidence Before Authority.
 *
 * This package does not invent new cryptographic surfaces. It only exposes the
 * three existing, evidence-first tool contracts that already ship in the kernel:
 *
 *   runGenesis()                → node tools/run-genesis.mjs   (just test)
 *   generateDevelopmentProofs() → node tools/prove.mjs         (just prove)
 *   verifyEvidence()            → verify-evidence + verify-proofs (just evidence)
 *
 * There is no general prove(statement) / verify(receipt) API. The kernel only
 * exercises fixed Genesis cases and two development proof relations.
 */

import { execFileSync, type ExecFileSyncOptions } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Kernel root discovery
// ---------------------------------------------------------------------------

/**
 * Locate the Fenrua Kernel repository root.
 * Walks upward from this module and from process.cwd() looking for the
 * characteristic files that identify a kernel checkout.
 */
export function findKernelRoot(start?: string): string {
  const candidates: string[] = [];

  if (start) candidates.push(path.resolve(start));
  candidates.push(process.cwd());

  // From compiled dist/ → sdk/ → repo root, or from src/ during development.
  candidates.push(path.resolve(__dirname, "../.."));
  candidates.push(path.resolve(__dirname, "../../.."));

  const seen = new Set<string>();
  for (const candidate of candidates) {
    let dir = candidate;
    for (let i = 0; i < 8; i++) {
      if (seen.has(dir)) break;
      seen.add(dir);
      if (isKernelRoot(dir)) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  throw new Error(
    "Unable to locate Fenrua Kernel root. " +
      "Run from inside a fenrua-kernel checkout or set the working directory explicitly."
  );
}

function isKernelRoot(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, "tools", "run-genesis.mjs")) &&
    fs.existsSync(path.join(dir, "tools", "prove.mjs")) &&
    fs.existsSync(path.join(dir, "package.json"))
  );
}

// ---------------------------------------------------------------------------
// Process helpers
// ---------------------------------------------------------------------------

export class KernelCommandError extends Error {
  readonly command: string;
  readonly args: string[];
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;

  constructor(
    command: string,
    args: string[],
    exitCode: number | null,
    stdout: string,
    stderr: string
  ) {
    super(
      `Kernel command failed (exit ${exitCode ?? "null"}): ${command} ${args.join(" ")}\n` +
        (stderr.trim() || stdout.trim() || "(no output)")
    );
    this.name = "KernelCommandError";
    this.command = command;
    this.args = args;
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

function runNodeTool(
  kernelRoot: string,
  toolRelativePath: string,
  extraArgs: string[] = [],
  options: { allowFailure?: boolean } = {}
): { status: number | null; stdout: string; stderr: string } {
  const tool = path.join(kernelRoot, toolRelativePath);
  if (!fs.existsSync(tool)) {
    throw new Error(`Kernel tool not found: ${tool}`);
  }

  const opts: ExecFileSyncOptions = {
    cwd: kernelRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  };

  try {
    const stdout = execFileSync(process.execPath, [tool, ...extraArgs], opts) as string;
    return { status: 0, stdout: stdout ?? "", stderr: "" };
  } catch (err: unknown) {
    const e = err as {
      status?: number | null;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
    };
    const status = e.status ?? null;
    const stdout = String(e.stdout ?? "");
    const stderr = String(e.stderr ?? "");

    if (options.allowFailure) {
      return { status, stdout, stderr };
    }
    throw new KernelCommandError(process.execPath, [tool, ...extraArgs], status, stdout, stderr);
  }
}

// ---------------------------------------------------------------------------
// Report readers (structured JSON already produced by the kernel tools)
// ---------------------------------------------------------------------------

export interface IntegrityEnvelope<T> {
  record: T;
  integrity: { sha256: string; [key: string]: unknown };
}

function readEnvelope<T>(filePath: string, label: string): IntegrityEnvelope<T> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} is missing: ${filePath}. Run the corresponding kernel command first.`);
  }
  const envelope = JSON.parse(fs.readFileSync(filePath, "utf8")) as IntegrityEnvelope<T>;
  if (!envelope?.integrity?.sha256 || !envelope.record) {
    throw new Error(`${label} is not a valid integrity envelope.`);
  }
  return envelope;
}

export function readGenesisManifest(kernelRoot?: string) {
  const root = kernelRoot ?? findKernelRoot();
  return readEnvelope(
    path.join(root, "tests/genesis/reports/manifest.json"),
    "Genesis manifest"
  );
}

export function readGenesisReport(kernelRoot?: string) {
  const root = kernelRoot ?? findKernelRoot();
  return readEnvelope(
    path.join(root, "tests/genesis/reports/genesis-report.json"),
    "Genesis aggregate report"
  );
}

export function readDevelopmentProofReport(kernelRoot?: string) {
  const root = kernelRoot ?? findKernelRoot();
  return readEnvelope(
    path.join(root, "tests/proofs/evidence/development-proof-report.json"),
    "Development proof report"
  );
}

// ---------------------------------------------------------------------------
// Public API – the three real pipelines
// ---------------------------------------------------------------------------

export interface CommandResult {
  /** Exit status of the underlying tool (0 = success). */
  status: number | null;
  stdout: string;
  stderr: string;
  /** Absolute path of the kernel root that was used. */
  kernelRoot: string;
}

export interface GenesisResult extends CommandResult {
  /** Structured aggregate report after a successful run. */
  report?: IntegrityEnvelope<Record<string, unknown>>;
  manifest?: IntegrityEnvelope<Record<string, unknown>>;
}

/**
 * Run the ten deterministic Genesis cases + permanent regressions.
 * Equivalent to `just test` / `pnpm run test` / `node tools/run-genesis.mjs`.
 *
 * Writes evidence under tests/genesis/reports/.
 */
export function runGenesis(options: { kernelRoot?: string } = {}): GenesisResult {
  const kernelRoot = options.kernelRoot ?? findKernelRoot();
  const result = runNodeTool(kernelRoot, "tools/run-genesis.mjs");

  let report: IntegrityEnvelope<Record<string, unknown>> | undefined;
  let manifest: IntegrityEnvelope<Record<string, unknown>> | undefined;
  try {
    report = readGenesisReport(kernelRoot);
    manifest = readGenesisManifest(kernelRoot);
  } catch {
    // Reports may be absent on failure; callers still get stdout/stderr.
  }

  return { ...result, kernelRoot, report, manifest };
}

export interface ProofResult extends CommandResult {
  report?: IntegrityEnvelope<Record<string, unknown>>;
}

/**
 * Generate the research-only local-ceremony development proofs for the two
 * fixed N521 add/sub relations.
 * Equivalent to `just prove` / `pnpm run prove` / `node tools/prove.mjs`.
 *
 * Writes evidence under tests/proofs/evidence/.
 * These proofs are never production trust material.
 */
export function generateDevelopmentProofs(
  options: { kernelRoot?: string } = {}
): ProofResult {
  const kernelRoot = options.kernelRoot ?? findKernelRoot();
  const result = runNodeTool(kernelRoot, "tools/prove.mjs");

  let report: IntegrityEnvelope<Record<string, unknown>> | undefined;
  try {
    report = readDevelopmentProofReport(kernelRoot);
  } catch {
    // ignore
  }

  return { ...result, kernelRoot, report };
}

export interface EvidenceResult extends CommandResult {
  genesisOk: boolean;
  proofsOk: boolean;
}

/**
 * Verify the published Genesis evidence records and the development proofs
 * (including tamper rejection).
 * Equivalent to `just evidence` / `pnpm run evidence`.
 *
 * @param options.sameHost  When true, also enforce Node/OS/tool binary identity
 *                          (maps to `--same-host` on verify-evidence.mjs).
 */
export function verifyEvidence(
  options: { kernelRoot?: string; sameHost?: boolean } = {}
): EvidenceResult {
  const kernelRoot = options.kernelRoot ?? findKernelRoot();
  const extra = options.sameHost ? ["--same-host"] : [];

  const genesis = runNodeTool(kernelRoot, "tools/verify-evidence.mjs", extra, {
    allowFailure: true,
  });
  const proofs = runNodeTool(kernelRoot, "tools/verify-proofs.mjs", [], {
    allowFailure: true,
  });

  const genesisOk = genesis.status === 0;
  const proofsOk = proofs.status === 0;
  const status = genesisOk && proofsOk ? 0 : 1;

  const stdout = [genesis.stdout, proofs.stdout].filter(Boolean).join("\n");
  const stderr = [genesis.stderr, proofs.stderr].filter(Boolean).join("\n");

  if (!genesisOk || !proofsOk) {
    throw new KernelCommandError(
      "verifyEvidence",
      options.sameHost ? ["--same-host"] : [],
      status,
      stdout,
      stderr
    );
  }

  return {
    status,
    stdout,
    stderr,
    kernelRoot,
    genesisOk,
    proofsOk,
  };
}

// ---------------------------------------------------------------------------
// Convenience aliases kept for readability
// ---------------------------------------------------------------------------

export {
  runGenesis as test,
  generateDevelopmentProofs as prove,
  verifyEvidence as evidence,
};
