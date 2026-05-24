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
    const match = branch.match(/^(?:agent\\/)?(TASK-\\\\d+)/);
    if (match) return match[1];
  } catch {}

  try {
    const cwd = process.cwd();
    const match = cwd.match(/worktrees\\/(?:[^/]+\\/)?(TASK-\\\\d+)/);
    if (match) return match[1];
  } catch {}

  return "UNKNOWN";
}

function redactSecrets(obj: Record<string, unknown>): Record<string, unknown> {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    const k = key.toUpperCase();
    if (k.includes("TOKEN") || k.includes("SECRET") || k.includes("PASSWORD") || k.includes("KEY")) {
      result[key] = "[REDACTED]";
    }
  }
  return result;
}

function writeAuditEvent(event: Record<string, unknown>): void {
  try {
    const taskId = resolveTaskId();
    const dir = \`logs/taskforge/tasks/\${taskId}\`;
    require("fs").mkdirSync(dir, { recursive: true });
    const line = JSON.stringify(event) + "\\n";
    require("fs").appendFileSync(\`\${dir}/transcript.jsonl\`, line);
  } catch {}
}

function writeSessionEvent(sessionId: string, event: Record<string, unknown>): void {
  try {
    const dir = \`logs/taskforge/sessions\`;
    require("fs").mkdirSync(dir, { recursive: true });
    const line = JSON.stringify(event) + "\\n";
    require("fs").appendFileSync(\`\${dir}/\${sessionId}.jsonl\`, line);
  } catch {}
}

const taskforgeAudit: Plugin = {
  name: "taskforge-audit",
  version: "1.0.0",

  async onSessionStart(ctx: { sessionId: string; taskId?: string }) {
    const taskId = ctx.taskId ?? resolveTaskId();
    const event = {
      timestamp: new Date().toISOString(),
      event: "session.started",
      taskId,
      sessionId: ctx.sessionId,
    };
    writeAuditEvent(event);
    // Session events written via onSessionStart only
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
