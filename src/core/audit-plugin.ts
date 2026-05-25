import fs from "node:fs";
import path from "node:path";
import { writeGeneratedFile } from "../core/templates.js";
import { logInfo, logSuccess } from "../util/logging.js";

const PLUGINS_DIR = ".opencode/plugins";

export function generateAuditPlugin(): string {
  return `// TaskForge Audit Plugin — managed by taskforge init
// Do not edit directly. Re-run 'taskforge init' to update.

import type { Plugin } from "opencode";

function resolveTaskId(): string {
  if (process.env.TASKFORGE_TASK_ID) return process.env.TASKFORGE_TASK_ID;

  try {
    const branch = require("child_process")
      .execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" })
      .trim();
    const match = branch.match(/^(?:agent\\/)?(TASK-\\d+)/);
    if (match) return match[1];
  } catch {}

  try {
    const cwd = process.cwd();
    const match = cwd.match(/worktrees\\/(?:[^/]+\\/)?(TASK-\\d+)/);
    if (match) return match[1];
  } catch {}

  return "UNKNOWN";
}

const SECRET_PATTERNS = [
  "TOKEN",
  "SECRET",
  "PASSWORD",
  "API_KEY",
  "API-KEY",
  "API KEY",
  "PRIVATE_KEY",
  "PRIVATE-KEY",
  "PRIVATE KEY",
  "CREDENTIAL",
  "AUTHORIZATION",
  "AUTH_TOKEN",
  "AUTH-TOKEN",
  "ACCESS_KEY",
  "ACCESS-KEY",
  "ACCESS KEY",
] as const;

function isSecretKey(key: string): boolean {
  const upper = key.toUpperCase().replace(/[-_\s]/g, "_");
  return SECRET_PATTERNS.some((pattern) => upper.includes(pattern));
}

function redactSecrets(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (isSecretKey(key)) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redactSecrets(val);
      }
    }
    return result;
  }
  return value;
}

function writeAuditEvent(event: Record<string, unknown>): void {
  try {
    const taskId = resolveTaskId();
    const dir = \`logs/taskforge/tasks/\${taskId}\`;
    require("fs").mkdirSync(dir, { recursive: true });
    const redacted = redactSecrets(event) as Record<string, unknown>;
    const line = JSON.stringify(redacted) + "\\n";
    require("fs").appendFileSync(\`\${dir}/transcript.jsonl\`, line);
  } catch {}
}

const taskforgeAudit: Plugin = {
  name: "taskforge-audit",
  version: "1.0.0",

  async onSessionStart(ctx: { sessionId: string; taskId?: string }) {
    writeAuditEvent({
      timestamp: new Date().toISOString(),
      event: "session.started",
      taskId: ctx.taskId ?? resolveTaskId(),
      sessionId: ctx.sessionId,
    });
  },

  async onToolExecute(ctx: { tool: string; command?: string; taskId?: string }) {
    const event: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      event: "tool.execute",
      taskId: ctx.taskId ?? resolveTaskId(),
      tool: ctx.tool,
    };
    if (ctx.command) {
      if (ctx.command.includes("TOKEN") || ctx.command.includes("SECRET")) {
        event.summary = "[REDACTED]";
      } else {
        event.summary = ctx.command.slice(0, 200);
      }
    }
    writeAuditEvent(event);
  },

  async onPermissionRequest(ctx: { id: string; tool: string; args?: Record<string, unknown>; taskId?: string }) {
    writeAuditEvent({
      timestamp: new Date().toISOString(),
      event: "permission.requested",
      taskId: ctx.taskId ?? resolveTaskId(),
      permissionId: ctx.id,
      tool: ctx.tool,
      args: ctx.args ? redactSecrets(ctx.args) : undefined,
    });
  },

  async onPermissionResponse(ctx: { id: string; decision: string; taskId?: string }) {
    writeAuditEvent({
      timestamp: new Date().toISOString(),
      event: "permission.responded",
      taskId: ctx.taskId ?? resolveTaskId(),
      permissionId: ctx.id,
      decision: ctx.decision,
    });
  },
};

export default taskforgeAudit;
`;
}

export function installAuditPlugin(projectRoot: string, dryRun: boolean): void {
  const pluginPath = path.join(projectRoot, PLUGINS_DIR, "taskforge-audit.ts");

  if (dryRun) {
    logInfo(`Would ${fs.existsSync(pluginPath) ? "update" : "create"} ${PLUGINS_DIR}/taskforge-audit.ts`);
    return;
  }

  writeGeneratedFile(pluginPath, generateAuditPlugin());
  logSuccess(`Audit plugin installed: ${PLUGINS_DIR}/taskforge-audit.ts`);
}
