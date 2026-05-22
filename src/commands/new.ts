import fs from "node:fs";
import path from "node:path";
import { getNextId } from "../core/task-store.js";
import { commitAndPushTaskState } from "../core/git.js";
import { getRepoRoot, getTaskStateDir } from "../util/paths.js";
import { logSuccess, logInfo } from "../util/logging.js";
import { printJson, jsonOk } from "../util/json-result.js";

export interface NewOptions {
  type?: string;
  priority?: string;
  agentRole?: string;
  status?: string;
  body?: string;
  json?: boolean;
}

export async function cmdNew(title: string, options?: NewOptions): Promise<void> {
  const repoRoot = getRepoRoot();
  const taskType = options?.type ?? "Task";
  const priority = options?.priority ?? "P2";
  const agentRole = options?.agentRole ?? "Implementer";
  const status = options?.status ?? "Ready";
  const bodyExtra = options?.body ?? "";
  const json = options?.json ?? false;

  const nextId = getNextId(repoRoot);

  const frontmatter = [
    "---",
    `id: ${nextId}`,
    `type: ${taskType}`,
    `status: ${status}`,
    `priority: ${priority}`,
    `agentRole: ${agentRole}`,
    `riskLevel: Low`,
    `humanInterventionRequired: false`,
    "---",
  ].join("\n");

  const body = [
    `# ${nextId}: ${title}`,
    "",
    "## Goal",
    "",
    bodyExtra || "Describe the desired outcome.",
    "",
    "## Acceptance Criteria",
    "",
    "- [ ]",
    "",
    "## Agent Notes",
    "",
  ].join("\n");

  const content = `${frontmatter}\n\n${body}`;

  const stateDir = getTaskStateDir(repoRoot);
  const filePath = path.join(stateDir, `${nextId}.md`);
  fs.writeFileSync(filePath, content, "utf-8");

  await commitAndPushTaskState(repoRoot, `chore: create ${nextId}`);

  if (json) {
    printJson(jsonOk({
      task: { id: nextId, file: filePath },
    } as never));
    return;
  }

  logSuccess(`Created ${nextId}: ${title}`);
  logInfo(`File: ${filePath}`);
}
