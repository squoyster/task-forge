import { loadTaskById } from "../core/task-store.js";
import { getRepoRoot, getWorktreePath } from "../util/paths.js";
import { logHeader, logSub, logDivider, logInfo } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { successResult } from "../core/result-builder.js";
import { writeResult } from "../util/write-command-result.js";
import fs from "node:fs";
import path from "node:path";

export async function cmdPrompt(taskId: string, options?: { json?: boolean }): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);
  if (!task) throw new TaskNotFoundError(taskId);

  const wtPath = getWorktreePath(repoRoot, taskId);

  if (options?.json) {
    const title = task.body.match(/^#\s+\S+:\s+(.+)$/m)?.[1]?.trim() ?? task.id;
    writeResult(successResult({
      command: "prompt",
      taskId,
      guidance: `Task ${taskId}: ${title} (${task.status}, ${task.priority}). Worktree: ${task.worktree ?? wtPath}. Branch: ${task.branch ?? "none"}. ${extractAcceptanceCriteria(task.body).length} acceptance criteria.`,
    }), options.json);
    return;
  }

  const title = task.body.match(/^#\s+\S+:\s+(.+)$/m)?.[1]?.trim() ?? task.id;
  logHeader(`# ${task.id}: ${title}`);
  logDivider();
  logInfo(task.body);
  logDivider();
  logHeader("## Workspace");
  logSub(`Branch: ${task.branch ?? "none"}`);
  logSub(`Worktree: ${task.worktree ?? wtPath}`);
  logDivider();
  logHeader("## Verification");
  logSub("npm run typecheck && npm run lint && npm run build && npm test -- --run");

  // Project conventions
  const agentsPath = path.join(repoRoot, "AGENTS.md");
  if (fs.existsSync(agentsPath)) {
    logDivider();
    logHeader("## Project Conventions (from AGENTS.md)");
    logInfo(fs.readFileSync(agentsPath, "utf-8").slice(0, 2000));
  }
}

function extractAcceptanceCriteria(body: string): string[] {
  const match = body.match(/## Acceptance Criteria\n([\s\S]*?)(?=\n## |$)/);
  if (!match) return [];
  return match[1].split("\n").filter((l) => l.trim().startsWith("- ["));
}
