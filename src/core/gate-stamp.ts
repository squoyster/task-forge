import fs from "node:fs";
import path from "node:path";
import { run } from "../util/exec.js";

/**
 * Gate stamp — binds a successful gate run to an exact commit SHA.
 *
 * The stamp is written (gitignored, local) by `taskforge gates` when all gates
 * pass on a clean tree. The pre-push hook (TF-SLIM-03) verifies the stamp's
 * commit_sha matches the SHA being pushed, so any post-gate change
 * (commit/amend/rebase) invalidates it and re-running gates is required.
 *
 * commit_sha alone binds to an exact tree, so a separate file hash is
 * redundant (see specs/taskforge-slimming-refactor.md §Gate Stamp Design).
 */

const STAMP_REL = ".taskforge/gate-stamp.json";

export interface GateStamp {
  /** Commit SHA the gates ran against (== HEAD at gate time). */
  commit_sha: string;
  /** Map of gate name -> passed. */
  gates: Record<string, boolean>;
  /** ISO timestamp of the gate run. */
  timestamp: string;
  /** Session that ran the gates (best-effort provenance). */
  runner_session: string;
}

export interface StampVerifyResult {
  valid: boolean;
  reasons: string[];
}

export function stampPath(repoRoot: string): string {
  return path.join(repoRoot, STAMP_REL);
}

/** Best-effort runner session id from env (set by agent frameworks). */
export function runnerSession(): string {
  return process.env.TASKFORGE_SESSION ?? "unknown";
}

export async function headSha(repoRoot: string): Promise<string> {
  const r = await run("git", ["rev-parse", "HEAD"], repoRoot);
  return r.stdout.trim();
}

export async function isCleanTree(
  repoRoot: string,
): Promise<{ clean: boolean; porcelain: string }> {
  const r = await run("git", ["status", "--porcelain"], repoRoot);
  const porcelain = r.stdout.trim();
  return { clean: porcelain.length === 0, porcelain };
}

export function writeGateStamp(repoRoot: string, stamp: GateStamp): void {
  const p = stampPath(repoRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(stamp, null, 2) + "\n", "utf-8");
}

export function readGateStamp(repoRoot: string): GateStamp | null {
  const p = stampPath(repoRoot);
  if (!fs.existsSync(p)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (
      typeof parsed?.commit_sha === "string" &&
      typeof parsed?.timestamp === "string" &&
      parsed?.gates !== undefined
    ) {
      return parsed as GateStamp;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Verify a stamp matches the SHA being pushed and that every expected gate
 * is recorded as passed. Used by the pre-push hook (TF-SLIM-03).
 */
export function verifyGateStamp(
  stamp: GateStamp | null,
  pushingSha: string,
  expectedGates: string[],
): StampVerifyResult {
  const reasons: string[] = [];
  if (!stamp) {
    return {
      valid: false,
      reasons: ["No gate stamp found. Run 'taskforge gates' before pushing."],
    };
  }
  if (stamp.commit_sha !== pushingSha) {
    reasons.push(
      `HEAD moved past last gate run (stamped ${stamp.commit_sha.slice(0, 8)}, pushing ${pushingSha.slice(0, 8)}). Run 'taskforge gates' then push.`,
    );
  }
  for (const g of expectedGates) {
    if (!stamp.gates[g]) {
      reasons.push(`Gate '${g}' not recorded as passed in stamp.`);
    }
  }
  return { valid: reasons.length === 0, reasons };
}
