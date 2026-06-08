import fs from "node:fs";
import path from "node:path";
import { getNextId } from "../core/task-store.js";
import { withTaskStateTransaction } from "../core/task-state-transaction.js";
import { getRepoRoot, getTaskStateDir } from "../util/paths.js";
import { logSuccess, logInfo, logDivider, logSub } from "../util/logging.js";
import { newStateMachine } from "../core/command-states.js";
import { getDefaultGuidanceAdapter } from "../core/guidance-adapter.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultMarkdown, renderResultJson } from "../core/result-renderer.js";

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

  // Write file locally first so the transaction can pick it up
  try {
    fs.writeFileSync(filePath, content, "utf-8");
  } catch (err) {
    const smResult = newStateMachine({
      writeSucceeded: false,
      pushSucceeded: false,
      taskId: nextId,
      filePath,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    getDefaultGuidanceAdapter().pushGuidance(smResult);
    const result = failedResult({
      command: "new",
      taskId: nextId,
      error: smResult.guidance,
      code: "WRITE_FAILED",
      nextCommands: smResult.nextAction
        ? [{ command: smResult.nextAction, purpose: "Retry after write failure", when: "On write failure", allowedFor: "all", priority: 1 }]
        : getValidNextCommands("new", "failed"),
    });
    if (json) {
      process.stdout.write(renderResultJson(result) + "\n");
      return;
    }
    throw new Error(smResult.guidance);
  }

  // Push through transaction — if this fails, the local file exists but
  // the remote won't have it, preventing silent data loss.
  let pushSucceeded = false;
  try {
    await withTaskStateTransaction(
      { command: `create ${nextId}`, maxRetries: 3 },
      (tx) => {
        const task = tx.loadTask(nextId);
        if (!task) throw new Error(`Task ${nextId} not found during transaction`);
        // Task already written to disk; transaction just commits and pushes
      },
    );
    pushSucceeded = true;
  } catch (err) {
    pushSucceeded = false;
    const smResult = newStateMachine({
      writeSucceeded: true,
      pushSucceeded: false,
      taskId: nextId,
      filePath,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    getDefaultGuidanceAdapter().pushGuidance(smResult);
    const result = failedResult({
      command: "new",
      taskId: nextId,
      error: smResult.guidance,
      code: smResult.errorCode ?? "PUSH_FAILED",
      nextCommands: smResult.nextAction
        ? [{ command: smResult.nextAction, purpose: "Retry after push failure", when: "On push failure", allowedFor: "all", priority: 1 }]
        : getValidNextCommands("new", "failed"),
    });
    if (json) {
      process.stdout.write(renderResultJson(result) + "\n");
      return;
    }
    logInfo(smResult.guidance);
    process.stdout.write(renderResultMarkdown(result) + "\n");
    return;
  }

  const smResult = newStateMachine({
    writeSucceeded: true,
    pushSucceeded,
    taskId: nextId,
    filePath,
  });
  getDefaultGuidanceAdapter().pushGuidance(smResult);

  const result = successResult({
    command: "new",
    taskId: nextId,
    guidance: smResult.guidance,
    nextCommands: getValidNextCommands("new", "success"),
  });

  if (json) {
    process.stdout.write(renderResultJson(result) + "\n");
    return;
  }

  logSuccess(smResult.guidance);
  logInfo(`File: ${filePath}`);
  logDivider();
  logInfo("Next actions:");
  logSub(`  taskforge start ${nextId}   — Begin working on this task (creates worktree)`);
  logSub(`  taskforge claim ${nextId}   — Claim this task without creating a worktree`);
  logSub("  taskforge next            — Find the next available task");
  process.stdout.write(renderResultMarkdown(result) + "\n");
}
