import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { cmdStatus } from "./status.js";
import { cmdNext } from "./next.js";
import { cmdGates } from "./gates.js";
import { cmdStart, type StartOptions } from "./start.js";
import { cmdDone, type DoneOptions } from "./done.js";
import { cmdCheckpoint } from "../commands/git-facade.js";
import { loadConfig } from "../core/config.js";
import { getRepoRoot } from "../util/paths.js";
import { Writable } from "node:stream";

export interface McpOptions {
  config?: string;
  json?: boolean;
}

/**
 * Execute a function that writes to stdout, capturing its output into a string.
 * The MCP transport also uses stdout, so we must redirect during command execution.
 */
async function captureStdout(fn: () => Promise<void>): Promise<string> {
  const chunks: Buffer[] = [];
  const originalStdout = process.stdout;

  const capture = new Writable({
    write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
      chunks.push(chunk);
      callback();
    },
  });

  (process as unknown as Record<string, unknown>).stdout = capture as unknown as typeof process.stdout;

  try {
    await fn();
  } finally {
    (process as unknown as Record<string, unknown>).stdout = originalStdout;
  }

  return Buffer.concat(chunks).toString("utf-8");
}

export async function cmdMcp(opts: McpOptions): Promise<void> {
  loadConfig(opts.config ?? getRepoRoot());
  const repoRoot = getRepoRoot();

  const server = new McpServer(
    {
      name: "taskforge",
      version: "0.3.0",
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: `TaskForge MCP server for repository: ${repoRoot}`,
    },
  );

  registerTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function registerTools(server: McpServer): void {
  // taskforge_status - Show project status
  server.tool(
    "taskforge_status",
    "Show the current status summary of all tasks in the project",
    {
      json: z.boolean().optional().default(false),
    },
    async (args: { json?: boolean }) => {
      try {
        const output = await captureStdout(() => cmdStatus(args.json ?? false));
        return { content: [{ type: "text" as const, text: output.trim() }] };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // taskforge_next - Find next task
  server.tool(
    "taskforge_next",
    "Return the highest-priority safe task to work on next",
    {
      json: z.boolean().optional().default(false),
    },
    async (args: { json?: boolean }) => {
      try {
        const output = await captureStdout(() => cmdNext({ json: args.json ?? false }));
        return { content: [{ type: "text" as const, text: output.trim() }] };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // taskforge_start - Start a task
  server.tool(
    "taskforge_start",
    "Create a worktree and branch for a task and begin working on it",
    {
      taskId: z.string(),
      force: z.boolean().optional().default(false),
      json: z.boolean().optional().default(false),
    },
    async (args: { taskId: string; force?: boolean; json?: boolean }) => {
      try {
        const opts: StartOptions = { force: args.force ?? false, json: args.json ?? false };
        const output = await captureStdout(() => cmdStart(args.taskId, opts));
        return { content: [{ type: "text" as const, text: output.trim() }] };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // taskforge_done - Mark a task as done
  server.tool(
    "taskforge_done",
    "Mark a task as completed and optionally clean up its worktree",
    {
      taskId: z.string(),
      cleanup: z.boolean().optional().default(false),
      deleteBranch: z.boolean().optional().default(false),
      json: z.boolean().optional().default(false),
    },
    async (args: { taskId: string; cleanup?: boolean; deleteBranch?: boolean; json?: boolean }) => {
      try {
        const opts: DoneOptions = {
          cleanup: args.cleanup ?? false,
          deleteBranch: args.deleteBranch ?? false,
          json: args.json ?? false,
        };
        const output = await captureStdout(() => cmdDone(args.taskId, opts));
        return { content: [{ type: "text" as const, text: output.trim() }] };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // taskforge_checkpoint - Commit changes on task branch
  server.tool(
    "taskforge_checkpoint",
    "Create a commit on the current task branch with the given message",
    {
      taskId: z.string(),
      message: z.string(),
    },
    async (args: { taskId: string; message: string }) => {
      try {
        const output = await captureStdout(() => cmdCheckpoint(args.taskId, args.message));
        return { content: [{ type: "text" as const, text: output.trim() || `Checkpoint created for ${args.taskId}.` }] };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // taskforge_gates - Run verification gates
  server.tool(
    "taskforge_gates",
    "Run all configured verification gates (typecheck, lint, build, test)",
    {
      json: z.boolean().optional().default(false),
    },
    async (args: { json?: boolean }) => {
      try {
        const success = await cmdGates({ json: args.json ?? false });
        return { content: [{ type: "text" as const, text: success ? "All gates passed." : "Some gates failed." }] };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
