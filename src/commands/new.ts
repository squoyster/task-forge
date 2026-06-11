import fs from "node:fs";
import path from "node:path";
import { getNextId } from "../core/task-store.js";
import { withTaskStateTransaction } from "../core/task-state-transaction.js";
import { getRepoRoot, getTaskStateDir } from "../util/paths.js";
import { logSuccess, logInfo, logDivider, logSub } from "../util/logging.js";
import { writeResult } from "../util/write-command-result.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { newStateMachine } from "../core/command-states.js";
import { getDefaultGuidanceAdapter } from "../core/guidance-adapter.js";
import {
  importTaskDocument,
  renderTaskDocument,
  createTaskDocument,
  type TaskSectionKey,
} from "../core/task-document.js";

export interface NewOptions {
  type?: string;
  priority?: string;
  agentRole?: string;
  status?: string;
  body?: string;
  fromFile?: string;
  goal?: string;
  background?: string;
  scope?: string;
  acceptanceCriteria?: string;
  testCommand?: string;
  expectedOutput?: string;
  dependencies?: string;
  risks?: string;
  continuationPolicy?: string;
  json?: boolean;
}

export async function cmdNew(title: string | undefined, options?: NewOptions): Promise<void> {
  const repoRoot = getRepoRoot();
  let taskType = options?.type ?? "Task";
  let priority = options?.priority ?? "P2";
  let agentRole = options?.agentRole ?? "Implementer";
  const status = options?.status ?? "Ready";
  const json = options?.json ?? false;

  const nextId = getNextId(repoRoot);

  let taskTitle = title?.trim() ?? "";
  const sectionPatch = buildSectionPatch(options);
  let document = createTaskDocument(taskTitle || nextId, sectionPatch);

  if (options?.fromFile) {
    try {
      const imported = importTaskDocument(fs.readFileSync(options.fromFile, "utf-8"), { strictReadonly: true });
      taskType = imported.fields.type ?? taskType;
      priority = imported.fields.priority ?? priority;
      agentRole = imported.fields.agentRole ?? agentRole;
      taskTitle = imported.fields.title ?? taskTitle;
      document = {
        ...imported.document,
        title: imported.fields.title ?? imported.document.title,
      };
    } catch (err) {
      writeResult(failedResult({
        command: "new",
        error: err instanceof Error ? err.message : String(err),
        code: "INVALID_INPUT",
      }), json);
      return;
    }
  }

  if (options?.body) {
    document.sections.goal = options.body;
  }
  if (!taskTitle) {
    taskTitle = document.title || nextId;
  }
  if (Object.keys(sectionPatch).length > 0) {
    document.sections = { ...document.sections, ...sectionPatch };
  }

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

  const body = renderTaskDocument(nextId, {
    ...document,
    title: taskTitle,
    sections: {
      goal: document.sections.goal ?? options?.body ?? "Describe the desired outcome.",
      ...document.sections,
    },
  });

  const content = `${frontmatter}\n\n${body}`;

  const stateDir = getTaskStateDir(repoRoot);
  const filePath = path.join(stateDir, `${nextId}.md`);

  // Write file locally first so the transaction can pick it up
  try {
    fs.writeFileSync(filePath, content, "utf-8");
  } catch (err) {
    const result = newStateMachine({
      writeSucceeded: false,
      pushSucceeded: false,
      taskId: nextId,
      filePath,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({
        command: "new",
        error: result.guidance,
        code: result.errorCode ?? "WRITE_FAILED",
      }), json);
      return;
    }
    throw new Error(result.guidance);
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
    const result = newStateMachine({
      writeSucceeded: true,
      pushSucceeded: false,
      taskId: nextId,
      filePath,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({
        command: "new",
        error: result.guidance,
        code: result.errorCode ?? "PUSH_FAILED",
      }), json);
      return;
    }
    logInfo(result.guidance);
    return;
  }

  const result = newStateMachine({
    writeSucceeded: true,
    pushSucceeded,
    taskId: nextId,
    filePath,
  });
  getDefaultGuidanceAdapter().pushGuidance(result);

  if (json) {
    writeResult(successResult({
      command: "new",
      taskId: nextId,
      guidance: result.guidance,
    }), json);
    return;
  }

  logSuccess(result.guidance);
  logInfo(`File: ${filePath}`);
  logDivider();
  logInfo("Next actions:");
  logSub(`  taskforge start ${nextId}   — Begin working on this task (creates worktree)`);
  logSub(`  taskforge claim ${nextId}   — Claim this task without creating a worktree`);
  logSub("  taskforge next            — Find the next available task");
}

function buildSectionPatch(options?: NewOptions): Partial<Record<TaskSectionKey, string>> {
  const sections: Partial<Record<TaskSectionKey, string>> = {};
  if (!options) return sections;
  if (options.goal !== undefined) sections.goal = options.goal;
  if (options.background !== undefined) sections.background = options.background;
  if (options.scope !== undefined) sections.scope = options.scope;
  if (options.acceptanceCriteria !== undefined) sections.acceptanceCriteria = options.acceptanceCriteria;
  if (options.testCommand !== undefined) sections.testCommand = options.testCommand;
  if (options.expectedOutput !== undefined) sections.expectedOutput = options.expectedOutput;
  if (options.dependencies !== undefined) sections.dependencies = options.dependencies;
  if (options.risks !== undefined) sections.risks = options.risks;
  if (options.continuationPolicy !== undefined) sections.continuationPolicy = options.continuationPolicy;
  return sections;
}
