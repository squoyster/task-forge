/**
 * mcp — TaskForge MCP server (TF-EMBED-02).
 *
 * Exposes a TYPED task/state contract over MCP: 7 read/mutation tools that
 * reuse the CLI command core, plus two read-only resources (a compact workflow
 * guide and a per-task body template). No shell, git, worktree, branch, push,
 * PR, force, unlock, or generic state-transition proxy is exposed (R-E02-003).
 *
 * Mutations go through `runCommandForResult`, which runs the real CLI command
 * function (preserving authority / doctor-lock / transaction / audit /
 * validation invariants) and returns its typed TaskForgeCommandResult via the
 * result sink — never by parsing stdout (R-E02-001/002).
 *
 * MCP is OFF unless explicitly enabled (cli.ts gates this command behind
 * TASKFORGE_WITH_MCP; opencode config defaults `mcp.taskforge.enabled:false`).
 */
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { cmdNext } from "./next.js";
import { cmdClaim } from "./claim.js";
import { cmdBlock } from "./block.js";
import { cmdDone } from "./done.js";
import { cmdGates } from "./gates.js";
import { cmdValidateState } from "./validate-state.js";
import { loadConfig } from "../core/config.js";
import { getRepoRoot } from "../util/paths.js";
import {
  McpCommandResultSchema,
  runCommandForResult,
  buildGetTaskResult,
  buildTaskResource,
  isValidTaskId,
} from "../core/mcp-contract.js";
import type { TaskForgeCommandResult } from "../core/command-result.js";

export interface McpOptions {
  config?: string;
  json?: boolean;
}

// Shared output schema for every tool: the typed command result, passthrough
// so command-specific enrichment keys (e.g. `next`'s task/score/owner packet)
// survive SDK outputSchema validation.
const OUTPUT_SCHEMA = McpCommandResultSchema;

// First 512 chars lead with scope + safety invariants (R-E02 / AC-5).
const INSTRUCTIONS = [
  "TaskForge MCP server: scoped to TASK and TASK-STATE only.",
  "SAFETY INVARIANTS:",
  "- This server never mutates the repo, runs shell, or manages git/worktrees/branches.",
  "- It never force-pushes, unlocks locks, or performs generic state transitions.",
  "- taskId is an opaque token (e.g. TASK-324); never a filesystem path.",
  "- Resources are read-only and never expose out-of-root paths.",
  "- If a .doctor-lock exists, mutations return doctor_required; do not improvise recovery here.",
  "",
  "TOOLS (7): taskforge_next, taskforge_get_task, taskforge_claim,",
  "taskforge_block, taskforge_complete, taskforge_gates, taskforge_validate_state.",
  "RESOURCES: taskforge://workflow (compact guide), taskforge://task/{taskId} (task body).",
  "All results are typed TaskForgeCommandResult objects (structuredContent).",
].join("\n");

/**
 * Build and connect the TaskForge MCP server. Exported for tests; the CLI
 * entry point is `cmdMcp`.
 */
export function createTaskForgeServer(): McpServer {
  const server = new McpServer(
    { name: "taskforge", version: "0.4.0" },
    { capabilities: { tools: {}, resources: {} }, instructions: INSTRUCTIONS },
  );
  registerTools(server);
  registerResources(server);
  return server;
}

export async function cmdMcp(opts: McpOptions): Promise<void> {
  loadConfig(opts.config ?? getRepoRoot());
  const server = createTaskForgeServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function registerTools(server: McpServer): void {
  // Wrap a typed result as the MCP tool return. `content` is required by the
  // SDK's CallToolResult type; we keep it empty since structuredContent carries
  // the typed payload (AC: typed structuredContent + optional derived text).
  const ok = (result: TaskForgeCommandResult) => ({
    content: [] as Array<{ type: "text"; text: string }>,
    structuredContent: result as unknown as Record<string, unknown>,
  });

  // ── taskforge_next ──────────────────────────────────────────────────────
  server.registerTool(
    "taskforge_next",
    {
      description: "Return the highest-priority safe task to work on next.",
      inputSchema: {},
      outputSchema: OUTPUT_SCHEMA,
    },
    async () => {
      const result = await runCommandForResult("next", () => cmdNext({ json: true }));
      return ok(result);
    },
  );

  // ── taskforge_get_task ──────────────────────────────────────────────────
  server.registerTool(
    "taskforge_get_task",
    {
      description: "Read a single task by its opaque id (e.g. TASK-324). Returns typed task metadata.",
      inputSchema: { taskId: z.string().min(1) },
      outputSchema: OUTPUT_SCHEMA,
    },
    async ({ taskId }) => {
      const result = resolveTaskIdOrFail("get_task", taskId) ?? buildGetTaskResult(taskId);
      return ok(result);
    },
  );

  // ── taskforge_claim ─────────────────────────────────────────────────────
  server.registerTool(
    "taskforge_claim",
    {
      description: "Claim a Ready task (sets it In Progress). Reuses the CLI claim core: honors authority, doctor-lock, session, and ownership invariants.",
      inputSchema: { taskId: z.string().min(1), force: z.boolean().optional() },
      outputSchema: OUTPUT_SCHEMA,
    },
    async ({ taskId, force }) => {
      const result = resolveTaskIdOrFail("claim", taskId)
        ?? await runCommandForResult("claim", () => cmdClaim(taskId, { json: true, force }));
      return ok(result);
    },
  );

  // ── taskforge_block ─────────────────────────────────────────────────────
  server.registerTool(
    "taskforge_block",
    {
      description: "Mark a task Blocked with a reason. Reuses the CLI block core (ownership + status-transition invariants).",
      inputSchema: {
        taskId: z.string().min(1),
        reason: z.string().min(1),
        category: z.string().optional(),
        blockedBy: z.string().optional(),
      },
      outputSchema: OUTPUT_SCHEMA,
    },
    async ({ taskId, reason, category, blockedBy }) => {
      const result = resolveTaskIdOrFail("block", taskId)
        ?? await runCommandForResult("block", () => cmdBlock(taskId, reason, { json: true, category, blockedBy }));
      return ok(result);
    },
  );

  // ── taskforge_complete ──────────────────────────────────────────────────
  server.registerTool(
    "taskforge_complete",
    {
      description: "Mark a task Done after gates pass. Reuses the CLI done core: enforces gates, AC, ownership, audit, and PR-verification invariants. Does NOT manage git/worktree/branch lifecycle.",
      inputSchema: { taskId: z.string().min(1), force: z.boolean().optional() },
      outputSchema: OUTPUT_SCHEMA,
    },
    async ({ taskId, force }) => {
      const result = resolveTaskIdOrFail("done", taskId)
        ?? await runCommandForResult("done", () => cmdDone(taskId, { json: true, force }));
      return ok(result);
    },
  );

  // ── taskforge_gates ─────────────────────────────────────────────────────
  server.registerTool(
    "taskforge_gates",
    {
      description: "Run configured verification gates (typecheck/lint/build/test). Returns a typed result with per-gate diagnostics.",
      inputSchema: { only: z.string().optional() },
      outputSchema: OUTPUT_SCHEMA,
    },
    async ({ only }) => {
      const result = await runCommandForResult("gates", () => cmdGates({ json: true, only }));
      return ok(result);
    },
  );

  // ── taskforge_validate_state ────────────────────────────────────────────
  server.registerTool(
    "taskforge_validate_state",
    {
      description: "Validate task-state integrity. Returns typed validation issues; never calls process.exit.",
      inputSchema: { strict: z.boolean().optional() },
      outputSchema: OUTPUT_SCHEMA,
    },
    async ({ strict }) => {
      const result = await runCommandForResult(
        "validate-state",
        () => cmdValidateState({ json: true, strict, emitOnly: true }),
      );
      return ok(result);
    },
  );
}

function registerResources(server: McpServer): void {
  // Static compact workflow guide.
  server.registerResource(
    "workflow",
    "taskforge://workflow",
    { description: "Compact TaskForge workflow contract (read-only).", mimeType: "text/markdown" },
    () => ({ contents: [{ uri: "taskforge://workflow", mimeType: "text/markdown", text: WORKFLOW_RESOURCE }] }),
  );

  // Dynamic per-task body (template). list: undefined intentionally.
  const taskTemplate = new ResourceTemplate("taskforge://task/{taskId}", { list: undefined });
  server.registerResource(
    "task",
    taskTemplate,
    { description: "Read-only body of a single task, addressed by opaque taskId.", mimeType: "text/markdown" },
    (_uri, variables) => {
      const taskId = String(variables.taskId ?? "");
      if (!isValidTaskId(taskId)) {
        return {
          contents: [
            { uri: `taskforge://task/${taskId}`, mimeType: "text/markdown", text: `# Invalid task id\n\n${taskId} is not a valid opaque task id.` },
          ],
        };
      }
      return buildTaskResource(taskId);
    },
  );
}

/**
 * Guard taskId against path traversal / out-of-store addressing. Returns a
 * failed result if invalid, otherwise undefined (caller proceeds).
 */
function resolveTaskIdOrFail(command: string, taskId: string): TaskForgeCommandResult | undefined {
  if (isValidTaskId(taskId)) return undefined;
  return {
    ok: false,
    status: "failed",
    metadata: { command, timestamp: new Date().toISOString() },
    context: {},
    agentPrompt: { role: "implementer" },
    validNextCommands: [],
    nextActions: [],
    todoMerge: { required: false, items: [] },
    contextCleanup: { required: false, actions: [] },
    prohibitedActions: [],
    recovery: { required: false, steps: [] },
    diagnostics: [{ level: "error", message: `Invalid task id: ${taskId}` }],
    error: `Invalid task id: ${taskId}`,
    code: "INVALID_TASK_ID",
  };
}

const WORKFLOW_RESOURCE = [
  "# TaskForge Workflow (compact)",
  "",
  "Status flow: Inbox -> Needs Spec -> Ready -> In Progress -> Review -> Verify -> Done",
  "                                |",
  "                             Blocked",
  "",
  "Read state: taskforge_next (pick), taskforge_get_task (inspect).",
  "Mutate state: taskforge_claim, taskforge_block, taskforge_complete.",
  "Verify: taskforge_gates, taskforge_validate_state.",
  "",
  "All mutations reuse the CLI core: authority, doctor-lock, transaction,",
  "audit, and validation invariants are preserved. If a .doctor-lock exists,",
  "mutations return doctor_required — do not improvise recovery here.",
  "",
  "git / worktree / branch / push / PR lifecycle is NOT exposed over MCP;",
  "agents manage that directly per the repo's workflow contract.",
].join("\n");
