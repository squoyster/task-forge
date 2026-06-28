/**
 * mcp-contract — Typed bridge between MCP tool/resource handlers and the
 * TaskForge CLI command core.
 *
 * Design (R-E02-001/002/003):
 *  - Mutating tools reuse the CLI command functions (claim/block/done/etc.)
 *    so authority, doctor-lock, task-state transaction, audit, and validation
 *    invariants are preserved. No mutation logic is duplicated here.
 *  - Results are captured as typed `TaskForgeCommandResult` objects via a
 *    module-level result sink (`setResultSink`), NOT by parsing ANSI stdout.
 *  - stdout is silenced (blackhole) during command execution because the
 *    commands emit progress via console.log, which would corrupt the stdio
 *    JSON-RPC transport. stderr is left untouched (harmless for the client).
 *
 * See `src/commands/mcp.ts` for tool/resource registration, and
 * `docs/architecture/command-return-contract.md` for the contract.
 */
import { Writable } from "node:stream";
import { z } from "zod";
import {
  TaskForgeCommandResultSchema,
  type TaskForgeCommandResult,
  setResultSink,
} from "./command-result.js";
import { failedResult } from "./result-builder.js";
import { loadTaskById } from "./task-store.js";
import { buildJsonTask } from "../util/json-result.js";
import { successResult } from "./result-builder.js";

/**
 * Output schema used for every MCP tool's `structuredContent`. `.passthrough()`
 * preserves top-level enrichment keys that some commands add (notably `next`'s
 * task/score/owner/cwd/prompt/workspace packet) so the SDK's outputSchema
 * validation does not strip them.
 */
export const McpCommandResultSchema = TaskForgeCommandResultSchema.passthrough();

/**
 * A taskId is an opaque token (e.g. `TASK-324`). It must never be treated as a
 * filesystem path: this guard rejects slashes, dots, and traversal sequences,
 * so resources/tools cannot address files outside the task store.
 */
export const TASK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export function isValidTaskId(taskId: string): boolean {
  return TASK_ID_PATTERN.test(taskId);
}

/**
 * Run a CLI command function in-process and return its typed
 * TaskForgeCommandResult via the result sink. stdout is silenced for the
 * duration of `fn` to protect the stdio transport. If `fn` completes without
 * emitting a result (e.g. it threw before reaching an emit), a synthesised
 * failed result is returned.
 *
 * This function NEVER parses stdout and NEVER duplicates mutation logic: the
 * command function does all the work; we only observe its structured result.
 */
export async function runCommandForResult(
  command: string,
  fn: () => Promise<unknown>,
): Promise<TaskForgeCommandResult> {
  let captured: TaskForgeCommandResult | null = null;
  const prevSink = setResultSink((result) => {
    captured = result;
  });

  const prevStdoutDescriptor = Object.getOwnPropertyDescriptor(process, "stdout");
  Object.defineProperty(process, "stdout", {
    value: SILENT_STDOUT,
    writable: true,
    configurable: true,
    enumerable: true,
  });

  try {
    await fn();
  } catch (err) {
    // Commands invoked with json:true normally catch their own errors and emit
    // a failed result. A throw reaching here means an unexpected failure; keep
    // any captured result if the command emitted before throwing, otherwise
    // synthesise one so the client always receives typed structure.
    if (!captured) {
      captured = failedResult({
        command,
        error: err instanceof Error ? err.message : String(err),
        code: "COMMAND_THREW",
      });
    }
  } finally {
    setResultSink(prevSink);
    if (prevStdoutDescriptor) {
      Object.defineProperty(process, "stdout", prevStdoutDescriptor);
    }
  }

  return captured ?? failedResult({
    command,
    error: "Command completed without emitting a result.",
    code: "NO_RESULT_EMIT",
  });
}

/** Build the typed result returned by the `taskforge_get_task` tool. */
export function buildGetTaskResult(taskId: string): TaskForgeCommandResult {
  const task = loadTaskById(taskId);
  if (!task) {
    return failedResult({
      command: "get_task",
      taskId,
      error: `Task ${taskId} not found`,
      code: "TASK_NOT_FOUND",
    });
  }
  const result = successResult({
    command: "get_task",
    taskId,
    guidance: `Task ${taskId} loaded. Body is available via the taskforge://task/${taskId} resource.`,
  });
  // Attach typed task metadata as data (builder doesn't accept `data` directly).
  result.data = { task: buildJsonTask({ id: task.id, status: task.status, priority: task.priority, body: task.body }) };
  return result;
}

/**
 * Build the resource-read result for `taskforge://task/{taskId}`. Returns the
 * task's markdown body (never its filesystem path) as read-only text.
 */
export function buildTaskResource(taskId: string): { contents: Array<{ uri: string; mimeType: string; text: string }> } {
  const task = loadTaskById(taskId);
  const uri = `taskforge://task/${taskId}`;
  if (!task) {
    return {
      contents: [
        { uri, mimeType: "text/markdown", text: `# Task not found\n\nTask ${taskId} does not exist.` },
      ],
    };
  }
  // Return the task body verbatim; never expose filePath or out-of-root paths.
  return {
    contents: [{ uri, mimeType: "text/markdown", text: task.body }],
  };
}

// A stdout replacement that silently discards every write. Created once and
// reused; structured results come from the result sink, not stdout.
const SILENT_STDOUT = new Writable({
  write(_chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    callback();
  },
});

// Re-export schema pieces the tool registration needs.
export { z };
