import { execa } from "execa";
import simpleGit from "simple-git";
import { loadAllTasks, writeTaskFile, appendAgentNote } from "./task-store.js";
import { getTaskStateDir, getRepoRoot } from "../util/paths.js";
import { eventLogEvent } from "./event-log.js";
import { appendAuditEvent } from "./audit.js";
import { validateTransition } from "./status-transition.js";
import { STATUS } from "../util/status-constants.js";
import { logWarn } from "../util/logging.js";
import type { ParsedTask } from "./task-store.js";

export interface TaskStateTransaction {
  loadTask(id: string): ParsedTask | null;
  loadAllTasks(): ParsedTask[];
  updateTask(task: ParsedTask): void;
  appendNote(taskId: string, role: string, notes: string[]): void;
  appendEvent(taskId: string, event: string, data?: Record<string, unknown>): void;
  assertCanTransition(task: ParsedTask, targetStatus: string): void;
  claimTask(taskId: string, sessionId: string): void;
  clearClaim(taskId: string): void;
  getModifiedTaskIds(): string[];
}

export interface TransactionOptions {
  repoRoot?: string;
  actor?: string;
  command?: string;
  maxRetries?: number;
  jitterMinMs?: number;
  jitterMaxMs?: number;
}

class TransactionImpl implements TaskStateTransaction {
  private tasks: Map<string, ParsedTask> = new Map();
  private notesAppended: Map<string, string[]> = new Map();
  private modified = false;
  private modifiedTaskIds: Set<string> = new Set();

  constructor(tasks: ParsedTask[]) {
    for (const t of tasks) {
      this.tasks.set(t.id, t);
    }
  }

  getModifiedTaskIds(): string[] {
    return [...this.modifiedTaskIds];
  }

  loadTask(id: string): ParsedTask | null {
    return this.tasks.get(id) ?? null;
  }

  loadAllTasks(): ParsedTask[] {
    return [...this.tasks.values()];
  }

  updateTask(task: ParsedTask): void {
    this.tasks.set(task.id, task);
    this.modified = true;
    this.modifiedTaskIds.add(task.id);
  }

  appendNote(taskId: string, role: string, notes: string[]): void {
    const existing = this.notesAppended.get(taskId) ?? [];
    this.notesAppended.set(taskId, [...existing, ...notes]);
  }

  appendEvent(taskId: string, event: string, data?: Record<string, unknown>): void {
    eventLogEvent(taskId, event, data);
  }

  assertCanTransition(task: ParsedTask, targetStatus: string): void {
    const err = validateTransition(task.status, targetStatus as never);
    if (err) throw new Error(err);
  }

  claimTask(taskId: string, sessionId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    task.assignee = sessionId;
    task.claimed_at = new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
    if (task.status === STATUS.READY) task.status = STATUS.IN_PROGRESS;
    this.modified = true;
    this.modifiedTaskIds.add(taskId);
  }

  clearClaim(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.assignee = undefined;
    task.claimed_at = undefined;
    this.modified = true;
    this.modifiedTaskIds.add(taskId);
  }

  commit(stateDir: string, message: string): Promise<void> {
    return this.persistAndCommit(stateDir, message);
  }

  private async persistAndCommit(stateDir: string, message: string): Promise<void> {
    if (!this.modified) return;

    // Write only task files in the dirty set
    for (const taskId of this.modifiedTaskIds) {
      const task = this.tasks.get(taskId);
      if (task) {
        writeTaskFile(task);
      }
    }

    const today = new Date().toISOString().split("T")[0];
    for (const [taskId, notes] of this.notesAppended) {
      const task = this.tasks.get(taskId);
      if (task) {
        appendAgentNote(task.filePath, today, "System", notes);
      }
    }

    const git = simpleGit(stateDir);
    await git.add(".");
    await git.commit(message);
  }
}

export async function withTaskStateTransaction<T>(
  options: TransactionOptions,
  mutate: (tx: TaskStateTransaction) => Promise<T> | T,
): Promise<T> {
  const root = options.repoRoot ?? getRepoRoot();
  const stateDir = getTaskStateDir(root);
  const maxRetries = options.maxRetries ?? 3;
  const jitterMin = options.jitterMinMs ?? 2000;
  const jitterMax = options.jitterMaxMs ?? 10000;
  const command = options.command ?? "mutate";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Pull latest
    try {
      await execa("git", ["pull", "--rebase", "origin", "task-state"], { cwd: stateDir });
    } catch {
      // OK if no remote or up to date
    }

    // Load fresh state
    const tasks = loadAllTasks(root);
    const tx = new TransactionImpl(tasks);

    // Apply mutation
    const result = await mutate(tx);

    // Commit
    try {
      await tx.commit(stateDir, `chore: ${command}`);
    } catch (e) {
      if (attempt >= maxRetries) throw e;
      logWarn(`Transaction commit failed (attempt ${attempt + 1}): ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    // Push
    try {
      await execa("git", ["push", "origin", "task-state"], { cwd: stateDir });

      // Emit structured audit event for successful transaction
      try {
        const git = simpleGit(stateDir);
        const commitSha = await git.revparse(["HEAD"]);
        appendAuditEvent(root, {
          timestamp: new Date().toISOString(),
          event: "transaction.committed",
          sessionId: options.actor,
          summary: `Transaction "${command}" committed ${tx.getModifiedTaskIds().length} task(s)`,
          metadata: {
            command,
            changedTaskIds: tx.getModifiedTaskIds(),
            commitSha,
            attempt: attempt + 1,
          },
        });
      } catch {
        // Audit emission failure should not fail the transaction
      }

      return result; // Success
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();

      if (lower.includes("non-fast-forward") || lower.includes("rejected") || lower.includes("fetch first")) {
        // Retry: pull and re-apply
        if (attempt >= maxRetries) throw err;
        const delay = jitterMin + Math.floor(Math.random() * (jitterMax - jitterMin + 1));
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Non-retryable error
      throw err;
    }
  }

  throw new Error(`Transaction failed after ${maxRetries} retries`);
}
