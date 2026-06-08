/**
 * `taskforge update` — modify task fields through the proper transaction layer.
 *
 * Usage:
 *   taskforge update <taskId> --field priority --value P1
 *   taskforge update <taskId> --body "new body content"
 *   taskforge update <taskId> --append-body "more content"
 *   taskforge update <taskId> --field dependsOn --value "TASK-001"
 *
 * All mutations go through withTaskStateTransaction for atomicity,
 * validation, locking, and audit.
 */
import { loadTaskById, type ParsedTask } from "../core/task-store.js";
import { withTaskStateTransaction } from "../core/task-state-transaction.js";
import { getRepoRoot } from "../util/paths.js";
import { logSuccess, logInfo, logHeader, logDivider, logSub, logError } from "../util/logging.js";
import { printJson, jsonOk, jsonError } from "../util/json-result.js";
import { TaskNotFoundError } from "../core/errors.js";
import { STATUS } from "../util/status-constants.js";

// ---------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface UpdateOptions {
  field?: string;
  value?: string;
  body?: string;
  appendBody?: string;
  json?: boolean;
}

interface FieldUpdate {
  name: string;
  oldValue: unknown;
  newValue: unknown;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Valid field names that can be updated via --field.
 */
const WRITABLE_FIELDS = new Set([
  "priority",
  "type",
  "status",
  "dependsOn",
  "agentRole",
  "riskLevel",
  "humanInterventionRequired",
]);

/**
 * Read-only fields that cannot be modified.
 */
const READ_ONLY_FIELDS = new Set([
  "id",
  "created_at",
  "createdAt",
  "assignee",
  "claimed_at",
  "context_hash",
  "branch",
  "worktree",
]);

/**
 * Valid priority values.
 */
const VALID_PRIORITIES = new Set(["P0", "P1", "P2", "P3"]);

/**
 * Valid type values.
 */
const VALID_TYPES = new Set([
  "Epic", "Feature", "Task", "Bug", "Chore", "Research", "Spike",
  "Refactor", "Test", "Documentation", "Infrastructure", "Security",
  "Release", "Dependency", "Maintenance",
]);

/**
 * Valid status values (non-terminal transitions are checked by the transaction).
 */
const VALID_STATUSES = new Set(Object.values(STATUS));

// ---------------------------------------------------------------------------
// Parse frontmatter values
// ---------------------------------------------------------------------------

function parseFieldValue(
  field: string,
  value: string,
): { ok: true; parsed: unknown } | { ok: false; error: string } {
  switch (field) {
    case "priority":
      if (!VALID_PRIORITIES.has(value)) {
        return { ok: false, error: `Invalid priority "${value}". Must be one of: ${[...VALID_PRIORITIES].join(", ")}` };
      }
      return { ok: true, parsed: value };

    case "type":
      if (!VALID_TYPES.has(value)) {
        return { ok: false, error: `Invalid type "${value}". Must be one of: ${[...VALID_TYPES].join(", ")}` };
      }
      return { ok: true, parsed: value };

    case "status":
      if (!VALID_STATUSES.has(value as any)) {
        return { ok: false, error: `Invalid status "${value}". Must be one of: ${[...VALID_STATUSES].join(", ")}` };
      }
      return { ok: true, parsed: value };

    case "dependsOn":
      return { ok: true, parsed: value };

    case "agentRole":
      return { ok: true, parsed: value };

    case "riskLevel":
      if (!["Low", "Medium", "High", "Critical"].includes(value)) {
        return { ok: false, error: `Invalid riskLevel "${value}". Must be Low, Medium, High, or Critical.` };
      }
      return { ok: true, parsed: value };

    case "humanInterventionRequired":
      if (value !== "true" && value !== "false") {
        return { ok: false, error: `humanInterventionRequired must be "true" or "false".` };
      }
      return { ok: true, parsed: value === "true" };

    default:
      return { ok: false, error: `Unknown field "${field}". Writable fields: ${[...WRITABLE_FIELDS].join(", ")}` };
  }
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export async function cmdUpdateTask(
  taskId: string,
  options: UpdateOptions,
): Promise<void> {
  const repoRoot = getRepoRoot();
  const json = options.json ?? false;

  // Load the task to verify it exists before starting a transaction
  const task = loadTaskById(taskId);
  if (!task) throw new TaskNotFoundError(taskId);

  const fieldUpdates: FieldUpdate[] = [];
  const hasFieldUpdate = options.field && options.value !== undefined;
  const hasBodyReplace = options.body !== undefined;
  const hasBodyAppend = options.appendBody !== undefined;

  if (!hasFieldUpdate && !hasBodyReplace && !hasBodyAppend) {
    const msg = "No updates specified. Use --field <name> --value <val>, --body <text>, or --append-body <text>.";
    if (json) {
      printJson(jsonError(msg, "NO_UPDATES"));
      return;
    }
    throw new Error(msg);
  }

  // Validate field before transaction
  if (hasFieldUpdate) {
    const field = options.field!;
    const value = options.value!;

    if (READ_ONLY_FIELDS.has(field)) {
      const msg = `Field "${field}" is read-only and cannot be modified.`;
      if (json) {
        printJson(jsonError(msg, "READ_ONLY_FIELD"));
        return;
      }
      throw new Error(msg);
    }

    if (!WRITABLE_FIELDS.has(field)) {
      const msg = `Unknown field "${field}". Writable fields: ${[...WRITABLE_FIELDS].join(", ")}`;
      if (json) {
        printJson(jsonError(msg, "UNKNOWN_FIELD"));
        return;
      }
      throw new Error(msg);
    }

    const parsed = parseFieldValue(field, value);
    if (!parsed.ok) {
      if (json) {
        printJson(jsonError(parsed.error, "INVALID_FIELD_VALUE"));
        return;
      }
      throw new Error(parsed.error);
    }
  }

  // Execute update through transaction
  try {
    await withTaskStateTransaction(
      { command: `update ${taskId}`, maxRetries: 3 },
      (tx) => {
        const fresh = tx.loadTask(taskId);
        if (!fresh) throw new Error(`Task ${taskId} not found during transaction`);

        // Apply field updates
        if (hasFieldUpdate) {
          const field = options.field!;
          const parsed = parseFieldValue(field, options.value!);
          if (!parsed.ok) throw new Error(parsed.error);

          const oldValue = (fresh as Record<string, unknown>)[field];
          (fresh as Record<string, unknown>)[field] = parsed.parsed;

          fieldUpdates.push({
            name: field,
            oldValue,
            newValue: parsed.parsed,
          });
        }

        // Apply body replace
        if (hasBodyReplace) {
          const oldBody = fresh.body;
          // Preserve frontmatter, replace everything after the closing ---
          const frontmatterEnd = oldBody.indexOf("\n---\n") + 5;
          const frontmatter = oldBody.slice(0, frontmatterEnd);
          fresh.body = frontmatter + "\n\n" + options.body!;

          fieldUpdates.push({
            name: "body",
            oldValue: "(body content)",
            newValue: "(body content replaced)",
          });
        }

        // Apply body append
        if (hasBodyAppend) {
          fresh.body = fresh.body + "\n\n" + options.appendBody!;

          fieldUpdates.push({
            name: "body",
            oldValue: "(body content)",
            newValue: "(body content appended)",
          });
        }

        tx.updateTask(fresh);

        // Append audit note
        const changeDescriptions = fieldUpdates.map(
          (u) => `${u.name}: ${JSON.stringify(u.oldValue)} → ${JSON.stringify(u.newValue)}`,
        );
        tx.appendNote(taskId, "System", [
          `Task updated via taskforge update:`,
          ...changeDescriptions,
        ]);
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (json) {
      printJson(jsonError(msg, "UPDATE_FAILED"));
      return;
    }
    throw err;
  }

  // Success output
  if (json) {
    printJson(jsonOk({
      taskId,
      updated: fieldUpdates,
      message: `Task ${taskId} updated successfully.`,
    }));
    return;
  }

  logSuccess(`Task ${taskId} updated.`);
  logDivider();
  for (const update of fieldUpdates) {
    logSub(`${update.name}: ${JSON.stringify(update.oldValue)} → ${JSON.stringify(update.newValue)}`);
  }
}
