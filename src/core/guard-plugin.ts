import fs from "node:fs";
import path from "node:path";
import { writeGeneratedFile } from "../core/templates.js";
import { logInfo, logSuccess } from "../util/logging.js";

const PLUGINS_DIR = ".opencode/plugins";

export function generateGuardPlugin(policy: string): string {
  const blockMode = policy === "locked-down" ? "block" : policy === "permissive" ? "warn" : "block";

  return `// TaskForge Guard Plugin — managed by taskforge init
// Do not edit directly. Re-run 'taskforge init' to update.
// Policy: ${policy} (mode: ${blockMode})

import type { Plugin } from "opencode";

function hasBlock(command: string): string | null {
  const c = command.trim();

  if (c.startsWith("git push --force")) return "force push is forbidden";
  if (c.startsWith("git push") || c.startsWith("git commit") || c === "git") {
    return "normal agents must use TaskForge facade commands (taskforge checkpoint, taskforge submit) — not direct git";
  }
  if (c.match(/^(sed|perl|python|node|tee|echo)\\s.*task-state/)) {
    return "task-state files must only be modified through TaskForge CLI commands";
  }

  return null;
}

function checkDoctorLock(): string | null {
  try {
    const fs = require("fs");
    const lockPath = "../task-state/.doctor-lock";
    if (fs.existsSync(lockPath)) {
      return "Doctor lock is active — normal agents must pause until recovery is complete";
    }
  } catch {}
  return null;
}

const taskforgeGuard: Plugin = {
  name: "taskforge-guard",
  version: "1.0.0",

  async onBeforeToolExecute(ctx: { tool: string; command?: string }): Promise<{ allow: boolean; reason?: string } | void> {
    const command = ctx.command ?? "";

    const doctorLockReason = checkDoctorLock();
    if (doctorLockReason) {
      return ${blockMode === "block" ? '{ allow: false, reason: doctorLockReason }' : `{ allow: true, reason: "WARNING: " + doctorLockReason }`};
    }

    const blockReason = hasBlock(command);
    if (blockReason) {
      return ${blockMode === "block" ? '{ allow: false, reason: blockReason }' : blockMode === "warn" ? `{ allow: true, reason: "WARNING: " + blockReason }` : '{ allow: false, reason: blockReason }'};
    }

    return;
  },
};

export default taskforgeGuard;
`;
}

export function installGuardPlugin(projectRoot: string, policy: string, dryRun: boolean): void {
  const pluginPath = path.join(projectRoot, PLUGINS_DIR, "taskforge-guard.ts");

  if (dryRun) {
    logInfo(`Would ${fs.existsSync(pluginPath) ? "update" : "create"} ${PLUGINS_DIR}/taskforge-guard.ts (policy: ${policy})`);
    return;
  }

  writeGeneratedFile(pluginPath, generateGuardPlugin(policy));
  logSuccess(`Guard plugin installed: ${PLUGINS_DIR}/taskforge-guard.ts (policy: ${policy})`);
}
