/**
 * Task-state mutation commands — fill gaps identified by TASK-261.
 *
 * Provides supported CLI operations for every routine task-state mutation,
 * so agents never need to edit files directly or import internal build chunks.
 */
import { loadTaskById } from "../core/task-store.js";
import { withTaskStateTransaction } from "../core/task-state-transaction.js";
import { getRepoRoot } from "../util/paths.js";
import { run } from "../util/exec.js";
import { logSuccess, logInfo, logHeader, logDivider, logSub, logError } from "../util/logging.js";
import { printJson, jsonOk, jsonError } from "../util/json-result.js";
import { TaskNotFoundError } from "../core/errors.js";
import { STATUS } from "../util/status-constants.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadTaskOrThrow(taskId: string) {
  const task = loadTaskById(taskId);
  if (!task) throw new TaskNotFoundError(taskId);
  return task;
}

// ---------------------------------------------------------------------------
// 1. taskforge block <taskId> --reason "<text>" [--category "<cat>"]
// ---------------------------------------------------------------------------

export interface BlockOptions {
  reason: string;
  category?: string;
  json?: boolean;
}

export async function cmdBlockTask(taskId: string, options: BlockOptions): Promise<void> {
  const repoRoot = getRepoRoot();
  const json = options.json ?? false;
  await loadTaskOrThrow(taskId);

  try {
    await withTaskStateTransaction(
      { command: `block ${taskId}`, maxRetries: 3 },
      (tx) => {
        const fresh = tx.loadTask(taskId);
        if (!fresh) throw new Error(`Task ${taskId} not found during transaction`);

        fresh.status = STATUS.BLOCKED;
        fresh.blocked_reason = options.reason;
        fresh.blocked_by = (repoRoot.split("/").pop() ?? "unknown") as "unspecified" | "human" | "agent" | "bot";
        fresh.blocked_since = new Date().toISOString();
        if (options.category) fresh.block_category = options.category as "human_decision" | "test_failure" | "merge_conflict" | "missing_secret" | "unsafe_operation" | "ambiguous_spec" | "unspecified";

        tx.updateTask(fresh);
        tx.appendNote(taskId, "System", [
          `Task blocked: ${options.reason}`,
          options.category ? `Category: ${options.category}` : "",
        ].filter(Boolean));
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (json) { printJson(jsonError(msg, "BLOCK_FAILED")); return; }
    throw err;
  }

  if (json) {
    printJson(jsonOk({ message: `Task ${taskId} blocked.`, reason: options.reason } as never));
    return;
  }
  logSuccess(`Task ${taskId} blocked.`);
  logSub(`Reason: ${options.reason}`);
  if (options.category) logSub(`Category: ${options.category}`);
}

// ---------------------------------------------------------------------------
// 2. taskforge record-gates <taskId> --report <file>
// ---------------------------------------------------------------------------

export interface RecordGatesOptions {
  report?: string;
  passed?: boolean;
  json?: boolean;
}

export async function cmdRecordGates(taskId: string, options: RecordGatesOptions): Promise<void> {
  const repoRoot = getRepoRoot();
  const json = options.json ?? false;
  const task = await loadTaskOrThrow(taskId);

  let reportContent = options.report
    ? await readFileSafe(options.report)
    : "No report file specified.";

  try {
    await withTaskStateTransaction(
      { command: `record-gates ${taskId}`, maxRetries: 3 },
      (tx) => {
        const fresh = tx.loadTask(taskId);
        if (!fresh) throw new Error(`Task ${taskId} not found during transaction`);

        tx.appendNote(taskId, "System", [
          `## Gate Results`,
          ``,
          `**Timestamp:** ${new Date().toISOString()}`,
          `**Passed:** ${options.passed ?? true}`,
          ``,
          reportContent,
        ]);
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (json) { printJson(jsonError(msg, "GATES_RECORD_FAILED")); return; }
    throw err;
  }

  if (json) {
    printJson(jsonOk({ message: `Gate results recorded for ${taskId}.` }));
    return;
  }
  logSuccess(`Gate results recorded for ${taskId}.`);
}

async function readFileSafe(filePath: string): Promise<string> {
  try {
    const result = await run("cat", [filePath], process.cwd());
    return result.stdout;
  } catch {
    try {
      const fs = await import("node:fs");
      return fs.readFileSync(filePath, "utf-8");
    } catch {
      return `(Could not read ${filePath})`;
    }
  }
}

// ---------------------------------------------------------------------------
// 3. taskforge evidence <taskId> add --type <type> [--file <path>] [--summary <text>]
// ---------------------------------------------------------------------------

export interface EvidenceAddOptions {
  type: string;
  file?: string;
  summary?: string;
  json?: boolean;
}

export async function cmdEvidenceAdd(taskId: string, options: EvidenceAddOptions): Promise<void> {
  const json = options.json ?? false;
  await loadTaskOrThrow(taskId);

  let fileContent = "";
  if (options.file) {
    fileContent = await readFileSafe(options.file);
  }

  try {
    await withTaskStateTransaction(
      { command: `evidence add ${taskId}`, maxRetries: 3 },
      (tx) => {
        const fresh = tx.loadTask(taskId);
        if (!fresh) throw new Error(`Task ${taskId} not found during transaction`);

        tx.appendNote(taskId, "System", [
          `## Completion Evidence: ${options.type}`,
          ``,
          `**Timestamp:** ${new Date().toISOString()}`,
          options.summary ? `**Summary:** ${options.summary}` : "",
          options.file ? `**File:** ${options.file}` : "",
          ``,
          fileContent ? `\`\`\`\n${fileContent}\n\`\`\`` : "",
        ].filter(Boolean));
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (json) { printJson(jsonError(msg, "EVIDENCE_FAILED")); return; }
    throw err;
  }

  if (json) {
    printJson(jsonOk({ message: `Evidence recorded for ${taskId}.`, type: options.type } as never));
    return;
  }
  logSuccess(`Evidence recorded for ${taskId}.`);
  logSub(`Type: ${options.type}`);
  if (options.summary) logSub(`Summary: ${options.summary}`);
}

// ---------------------------------------------------------------------------
// 4. taskforge reconcile <taskId>
// ---------------------------------------------------------------------------

export interface ReconcileOptions {
  json?: boolean;
}

export async function cmdReconcile(taskId: string, options: ReconcileOptions = {}): Promise<void> {
  const repoRoot = getRepoRoot();
  const json = options.json ?? false;
  await loadTaskOrThrow(taskId);

  // Check if the worktree still exists
  let worktreeExists = false;
  let branchAhead = 0;
  let hasPR = false;

  try {
    const wtResult = await run("git", ["worktree", "list"], repoRoot);
    worktreeExists = wtResult.stdout.includes(taskId);
  } catch { /* ignore */ }

  try {
    // Check if branch has unpushed commits
    const aheadResult = await run("git", ["rev-list", "--count", "@{u}..HEAD"], repoRoot);
    branchAhead = parseInt(aheadResult.stdout.trim(), 10) || 0;
  } catch { /* ignore */ }

  try {
    // Reconcile status based on state
    await withTaskStateTransaction(
      { command: `reconcile ${taskId}`, maxRetries: 3 },
      (tx) => {
        const fresh = tx.loadTask(taskId);
        if (!fresh) throw new Error(`Task ${taskId} not found during transaction`);

        const changes: string[] = [];

        // If status is In Progress but no worktree exists, note it
        if (fresh.status === STATUS.IN_PROGRESS && !worktreeExists) {
          changes.push("Status is In Progress but worktree is missing.");
        }

        // If branch has unpushed commits, suggest submit
        if (branchAhead > 0 && fresh.status !== STATUS.SUBMITTED) {
          changes.push(`Branch is ${branchAhead} commit(s) ahead of remote. Run 'taskforge submit'.`);
        }

        if (changes.length > 0) {
          tx.appendNote(taskId, "System", [
            `## Reconciliation (${new Date().toISOString()})`,
            ...changes,
          ]);
        }

        tx.updateTask(fresh);
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (json) { printJson(jsonError(msg, "RECONCILE_FAILED")); return; }
    throw err;
  }

  if (json) {
    printJson(jsonOk({ message: `Reconciliation complete for ${taskId}.` }));
    return;
  }
  logSuccess(`Reconciliation complete for ${taskId}.`);
}
