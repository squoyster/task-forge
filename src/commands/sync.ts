import { loadAllTasks, updateTaskIssue } from "../core/task-store.js";
import { loadConfig } from "../core/config.js";
import { getRepoRoot } from "../util/paths.js";
import { commitAndPushTaskState } from "../core/git.js";
import { logInfo, logSuccess, logError } from "../util/logging.js";
import { writeResult } from "../util/write-command-result.js";
import { successResult } from "../core/result-builder.js";
import {
  createIssue,
  updateIssueLabels,
  updateIssueBody,
  ensureLabels,
  generateIssueBody,
  setConfig,
} from "../integrations/github/index.js";
import { STATUS_LABELS } from "../integrations/github/types.js";
import { syncTaskToProject } from "../integrations/github/projects.js";

export async function cmdSync(json = false): Promise<void> {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);

  logInfo("# TaskForge Sync");
  logInfo("");

  // Always push task-state changes first, regardless of GitHub config.
  // This ensures pending publications (from taskforge new) are pushed.
  let taskStatePushed = false;
  try {
    await commitAndPushTaskState(repoRoot, "chore: sync task state");
    taskStatePushed = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(`Failed to push task-state: ${msg}`);
  }

  if (!config.github?.enabled) {
    logInfo("GitHub integration is not enabled in config.");
    logInfo("");
    if (taskStatePushed) {
      logInfo("Task-state changes pushed successfully.");
    } else {
      logInfo("To enable GitHub sync, set in .taskforge/config.json:");
      logInfo('  "github": { "enabled": true, "owner": "...", "repo": "..." }');
      logInfo("");
      logInfo("Ensure GITHUB_TOKEN is set in environment.");
    }
    writeResult(successResult({
      command: "sync",
      guidance: taskStatePushed
        ? "Task-state changes pushed. GitHub integration not enabled."
        : "GitHub integration not enabled.",
    }), json);
    return;
  }

  const githubConfig = {
    owner: config.github.owner ?? "",
    repo: config.github.repo ?? "",
    projectNumber: config.github.projectNumber,
  };

  if (!githubConfig.owner || !githubConfig.repo) {
    logError("GitHub owner and repo must be configured.");
    writeResult(successResult({
      command: "sync",
      guidance: taskStatePushed
        ? "Task-state changes pushed. GitHub owner/repo not configured."
        : "GitHub owner and repo must be configured.",
    }), json);
    return;
  }

  setConfig(githubConfig);

  const tasks = loadAllTasks(repoRoot);

  if (tasks.length === 0) {
    logInfo("No task files found.");
    writeResult(successResult({
      command: "sync",
      guidance: "No task files found.",
    }), json);
    return;
  }

  logInfo(`## Syncing ${tasks.length} task(s) to ${githubConfig.owner}/${githubConfig.repo}`);
  logInfo("");

  await ensureLabels(githubConfig);

  // Track tasks that were successfully linked to issues for project sync
  const syncedIssues: Array<{ issueNumber: number; taskId: string; taskStatus: string }> = [];

  for (const task of tasks) {
    const titleMatch = task.body.match(/^#\s+\S+:\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : task.id;

    if (task.issue) {
      await updateExistingIssue(githubConfig, task.issue, task);
      logSuccess(`Updated #${task.issue}: ${task.id} - ${title}`);
      syncedIssues.push({ issueNumber: task.issue, taskId: task.id, taskStatus: task.status });
    } else {
      const issueNumber = await createNewIssue(githubConfig, task, title);
      if (issueNumber) {
        updateTaskIssue(task.filePath, issueNumber);
        logSuccess(`Created #${issueNumber}: ${task.id} - ${title}`);
        syncedIssues.push({ issueNumber, taskId: task.id, taskStatus: task.status });
      }
    }
  }

  // Push any task file changes (new issue numbers) to shared task-state branch
  await commitAndPushTaskState(repoRoot, "chore: sync tasks with GitHub");

  // Sync to GitHub Projects board if projectNumber is configured
  if (config.github.projectNumber && syncedIssues.length > 0) {
    await syncToProjectBoard(githubConfig, config, syncedIssues);
  }

  logInfo("");
  logInfo("## Sync Status");
  logInfo("");

  const projectSuffix = config.github.projectNumber ? ` and Project #${config.github.projectNumber}` : "";
  logSuccess(`All tasks synced to GitHub Issues${projectSuffix}.`);

  writeResult(successResult({
    command: "sync",
    guidance: `All tasks synced to GitHub Issues${projectSuffix}.`,
  }), json);
}

/**
 * Sync task statuses to the GitHub Projects v2 board.
 */
async function syncToProjectBoard(
  githubConfig: { owner: string; repo: string; projectNumber?: number },
  config: { github?: { projects?: { statusField: string; columnMapping?: Record<string, string> } } },
  syncedIssues: Array<{ issueNumber: number; taskId: string; taskStatus: string }>,
): Promise<void> {
  const fieldName = config.github?.projects?.statusField ?? "Status";
  const columnMapping = config.github?.projects?.columnMapping;

  logInfo("");
  logInfo(`## Syncing ${syncedIssues.length} task(s) to Project board`);
  logInfo("");

  for (const { issueNumber, taskId, taskStatus } of syncedIssues) {
    // Map task status to project column name if mapping is configured
    const projectStatus = columnMapping?.[taskStatus] ?? taskStatus;

    const ok = await syncTaskToProject(
      githubConfig,
      issueNumber,
      projectStatus,
      fieldName,
    );

    if (ok) {
      logSuccess(`Project #${issueNumber}: ${taskId} → ${projectStatus}`);
    } else {
      logError(`Failed to sync ${taskId} to project board.`);
    }
  }
}

async function createNewIssue(
  githubConfig: { owner: string; repo: string },
  task: { id: string; priority: string; status: string; body: string },
  title: string,
): Promise<number | null> {
  const statusLabel = STATUS_LABELS[task.status] ?? "inbox";
  const labels = ["taskforge", statusLabel];

  if (task.priority === "P0") labels.push("p0");
  else if (task.priority === "P1") labels.push("p1");

  const body = generateIssueBody(task.id, task.body);

  try {
    const result = await createIssue(githubConfig, {
      title: `${task.id}: ${title}`,
      body,
      labels,
    });
    return result.number;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(`Failed to create issue for ${task.id}: ${msg}`);
    return null;
  }
}

async function updateExistingIssue(
  githubConfig: { owner: string; repo: string },
  issueNumber: number,
  task: { id: string; status: string; body: string },
): Promise<void> {
  const statusLabel = STATUS_LABELS[task.status] ?? "inbox";

  try {
    await Promise.all([
      updateIssueLabels(githubConfig, issueNumber, statusLabel),
      updateIssueBody(githubConfig, issueNumber, task.body),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(`Failed to update issue #${issueNumber}: ${msg}`);
  }
}
