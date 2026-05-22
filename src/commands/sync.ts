import { loadAllTasks, updateTaskIssue } from "../core/task-store.js";
import { loadConfig } from "../core/config.js";
import { getRepoRoot } from "../util/paths.js";
import { logInfo, logSuccess, logError } from "../util/logging.js";
import {
  createIssue,
  updateIssueLabels,
  updateIssueBody,
  ensureLabels,
  generateIssueBody,
  setConfig,
} from "../integrations/github/index.js";
import { STATUS_LABELS } from "../integrations/github/types.js";

export async function cmdSync(): Promise<void> {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);

  logInfo("# TaskForge Sync");
  logInfo("");

  if (!config.github?.enabled) {
    logInfo("GitHub integration is not enabled in config.");
    logInfo("");
    logInfo("To enable, set in .taskforge/config.json:");
    logInfo('  "github": { "enabled": true, "owner": "...", "repo": "..." }');
    logInfo("");
    logInfo("Ensure GITHUB_TOKEN is set in environment.");
    return;
  }

  const githubConfig = {
    owner: config.github.owner ?? "",
    repo: config.github.repo ?? "",
  };

  if (!githubConfig.owner || !githubConfig.repo) {
    logError("GitHub owner and repo must be configured.");
    return;
  }

  setConfig(githubConfig);

  const tasks = loadAllTasks(repoRoot);

  if (tasks.length === 0) {
    logInfo("No task files found.");
    return;
  }

  logInfo(`## Syncing ${tasks.length} task(s) to ${githubConfig.owner}/${githubConfig.repo}`);
  logInfo("");

  await ensureLabels(githubConfig);

  for (const task of tasks) {
    const titleMatch = task.body.match(/^#\s+\S+:\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : task.id;

    if (task.issue) {
      await updateExistingIssue(githubConfig, task.issue, task);
      logSuccess(`Updated #${task.issue}: ${task.id} - ${title}`);
    } else {
      const issueNumber = await createNewIssue(githubConfig, task, title);
      if (issueNumber) {
        updateTaskIssue(task.filePath, issueNumber);
        logSuccess(`Created #${issueNumber}: ${task.id} - ${title}`);
      }
    }
  }

  logInfo("");
  logInfo("## Sync Status");
  logInfo("");
  logSuccess("All tasks synced to GitHub Issues.");
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