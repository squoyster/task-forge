import fs from "node:fs";
import matter from "gray-matter";
import { loadTaskById } from "../core/task-store.js";
import { pullTaskState } from "../core/git.js";
import { withTaskStateTransaction } from "../core/task-state-transaction.js";
import { TaskNotFoundError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";
import { logSuccess, logWarn } from "../util/logging.js";
import { writeResult } from "../util/write-command-result.js";
import { successResult, failedResult } from "../core/result-builder.js";
import type { ParsedTask } from "../core/task-store.js";

/**
 * Fields that are managed by other TaskForge commands and must not be
 * directly modified via `taskforge update`.
 */
const PROTECTED_FIELDS = new Set([
  "id",
  "status",
  "assignee",
  "claimed_at",
  "branch",
  "worktree",
  "blocked_reason",
  "blocked_by",
  "blocked_since",
  "block_category",
  "context_hash",
  "submitted_sha",
  "submitted_at",
  "pr_merged",
  "pr_head_sha",
  "pr_base_branch",
  "override_reason",
  "override_actor",
  "override_timestamp",
  "override_failed_gates",
]);

export interface UpdateOptions {
  json?: boolean;
  field?: string | string[];
  value?: string | string[];
}

function isProtectedField(field: string): boolean {
  return PROTECTED_FIELDS.has(field);
}

/**
 * Coerce a string value into the most appropriate JavaScript type.
 * Used when setting task frontmatter fields via CLI strings.
 */
function coerceValue(value: string): unknown {
  // Preserve exact strings that look like numbers/booleans but should remain strings
  // We use heuristics: if the value is a number string, parse it as number.
  // If "true"/"false", parse as boolean.
  // Otherwise, keep as string.

  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (value === "undefined") return undefined;

  // Try number
  const num = Number(value);
  if (!Number.isNaN(num) && String(num) === value.trim()) {
    return num;
  }

  // Try array (JSON array string like "[1,2,3]")
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      return JSON.parse(value);
    } catch {
      // Not valid JSON array, keep as string
    }
  }

  // Try JSON object
  if (value.startsWith("{") && value.endsWith("}")) {
    try {
      return JSON.parse(value);
    } catch {
      // Not valid JSON object, keep as string
    }
  }

  return value;
}

export async function cmdUpdate(
  taskId: string,
  options: UpdateOptions = {},
): Promise<void> {
  const repoRoot = getRepoRoot();
  const json = options.json ?? false;

  await pullTaskState(repoRoot);

  const task = loadTaskById(taskId);
  if (!task) {
    if (json) {
      writeResult(failedResult({
        command: "update",
        taskId,
        error: `Task ${taskId} not found`,
        code: "TASK_NOT_FOUND",
      }), json);
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  // Collect fields and values into pairs
  const fields: string[] = [];
  const values: string[] = [];

  if (options.field && options.value) {
    const fieldArr = Array.isArray(options.field) ? options.field : [options.field];
    const valueArr = Array.isArray(options.value) ? options.value : [options.value];

    if (fieldArr.length !== valueArr.length) {
      if (json) {
        writeResult(failedResult({
          command: "update",
          taskId,
          error: "Number of --field options must match number of --value options",
          code: "FIELD_VALUE_MISMATCH",
        }), json);
        return;
      }
      throw new Error("Number of --field options must match number of --value options");
    }

    for (let i = 0; i < fieldArr.length; i++) {
      fields.push(fieldArr[i]);
      values.push(valueArr[i]);
    }
  }

  if (fields.length === 0) {
    if (json) {
      writeResult(failedResult({
        command: "update",
        taskId,
        error: "No fields provided. Use --field <name> --value <value> to set fields.",
        code: "NO_FIELDS",
      }), json);
      return;
    }
    throw new Error("No fields provided. Use --field <name> --value <value> to set fields.");
  }

  // Validate all fields before touching anything
  for (const field of fields) {
    if (isProtectedField(field)) {
      if (json) {
        writeResult(failedResult({
          command: "update",
          taskId,
          error: `Field "${field}" is protected and cannot be modified via taskforge update. Use the dedicated command instead.`,
          code: "PROTECTED_FIELD",
        }), json);
        return;
      }
      throw new Error(
        `Field "${field}" is protected and cannot be modified via taskforge update. ` +
        `Use the dedicated command instead.`,
      );
    }
  }

  // Apply update within a transaction
  try {
    await withTaskStateTransaction(
      { command: `update ${taskId}`, maxRetries: 3 },
      async (tx) => {
        const fresh = tx.loadTask(taskId);
        if (!fresh) throw new Error(`Task ${taskId} not found during transaction`);

        // Apply each field update
        for (let i = 0; i < fields.length; i++) {
          const field = fields[i];
          const rawValue = values[i];
          const coerced = coerceValue(rawValue);

          (fresh as Record<string, unknown>)[field] = coerced;
        }

        tx.updateTask(fresh);

        tx.appendNote(taskId, "System", [
          `Field(s) updated via taskforge update: ${fields.join(", ")}`,
        ]);
      },
    );
  } catch (err) {
    if (json) {
      writeResult(failedResult({
        command: "update",
        taskId,
        error: err instanceof Error ? err.message : String(err),
        code: "TRANSACTION_FAILED",
      }), json);
      return;
    }
    throw err;
  }

  if (json) {
    writeResult(successResult({
      command: "update",
      taskId,
      guidance: `Task ${taskId} updated: ${fields.join(", ")}`,
    }), json);
    return;
  }

  logSuccess(`Task ${taskId} updated: ${fields.join(", ")}`);
}
