import { getRepoRoot } from "../util/paths.js";
import { loadTaskById } from "../core/task-store.js";
import { assertTaskOwnership } from "../core/session.js";
import { run } from "../util/exec.js";
import { createTaskEvent, appendTaskTranscript } from "../core/audit.js";
import { TaskNotFoundError } from "../core/errors.js";
import { loadConfig } from "../core/config.js";
import { createPullRequest, findPullRequestByBranch } from "../integrations/github/service.js";
import { withTaskStateTransaction } from "../core/task-state-transaction.js";
import type { GitHubConfig } from "../integrations/github/types.js";
import type { Task } from "../core/task.js";
import { logInfo, logHeader, logSuccess, logWarn, logError } from "../util/logging.js";
import { checkpointStateMachine, submitStateMachine } from "../core/command-states.js";
import { getDefaultGuidanceAdapter } from "../core/guidance-adapter.js";

function requireTask(taskId: string): Task {
  const task = loadTaskById(taskId);
  if (!task) throw new TaskNotFoundError(taskId);
  return task;
}

export async function cmdDiff(taskId: string): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = requireTask(taskId);

  assertTaskOwnership(task, repoRoot);

  if (!task.worktree) {
    throw new Error(`No worktree found for ${taskId}. Run 'taskforge start ${taskId}' first.`);
  }

  logHeader(`Diff: ${taskId}`);
  const result = await run("git", ["-C", task.worktree, "diff"], repoRoot);
  process.stdout.write(result.stdout);
}

export async function cmdCheckpoint(taskId: string, message: string): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    const result = checkpointStateMachine({
      hasChanges: false,
      commitSucceeded: false,
      inWorktree: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    logError(result.guidance);
    throw new TaskNotFoundError(taskId);
  }

  if (!task.worktree) {
    const result = checkpointStateMachine({
      hasChanges: false,
      commitSucceeded: false,
      inWorktree: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    logError(result.guidance);
    throw new Error(result.guidance);
  }

  try {
    assertTaskOwnership(task, repoRoot);
  } catch {
    const result = checkpointStateMachine({
      hasChanges: false,
      commitSucceeded: false,
      inWorktree: true,
      taskId,
      errorMessage: "Ownership verification failed",
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    throw new Error(result.guidance);
  }

  const branchResult = await run("git", ["-C", task.worktree, "rev-parse", "--abbrev-ref", "HEAD"], repoRoot);
  const branch = branchResult.stdout.trim();

  if (branch === "main" || branch === "task-state") {
    const result = checkpointStateMachine({
      hasChanges: false,
      commitSucceeded: false,
      inWorktree: true,
      taskId,
      errorMessage: `Refusing to checkpoint on ${branch} branch`,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    throw new Error(result.guidance);
  }

  // Check for changes
  const statusResult = await run("git", ["-C", task.worktree, "status", "--porcelain"], repoRoot);
  const hasChanges = statusResult.stdout.trim().length > 0;

  if (!hasChanges) {
    const result = checkpointStateMachine({
      hasChanges: false,
      commitSucceeded: false,
      inWorktree: true,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    logInfo(result.guidance);
    return;
  }

  const fullMessage = [
    message,
    "",
    `Task: ${taskId}`,
    `TaskForge-Managed: true`,
  ].join("\n");

  let commitSucceeded = false;
  try {
    await run("git", ["-C", task.worktree, "add", "."], repoRoot);
    await run("git", ["-C", task.worktree, "commit", "-m", fullMessage], repoRoot);
    commitSucceeded = true;
  } catch (err) {
    const result = checkpointStateMachine({
      hasChanges: true,
      commitSucceeded: false,
      inWorktree: true,
      taskId,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    logError(result.guidance);
    throw new Error(result.guidance);
  }

  const result = checkpointStateMachine({
    hasChanges: true,
    commitSucceeded,
    inWorktree: true,
    taskId,
  });
  getDefaultGuidanceAdapter().pushGuidance(result);

  logSuccess(result.guidance);

  appendTaskTranscript(repoRoot, taskId, createTaskEvent(taskId, "git.commit", {
    summary: message,
  }));
}

export interface SubmitOptions {
  json?: boolean;
}

/**
 * Error class for submission failures with structured information.
 */
export class SubmissionError extends Error {
  constructor(
    message: string,
    public step: string,
    public recoverable: boolean,
    public code: string = "SUBMISSION_ERROR",
  ) {
    super(message);
    this.name = "SubmissionError";
  }
}

/**
 * Check whether uncommitted changes exist in the task worktree.
 */
async function hasUncommittedChanges(worktree: string, repoRoot: string): Promise<boolean> {
  try {
    const result = await run("git", ["-C", worktree, "status", "--porcelain"], repoRoot);
    return result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get the current SHA of HEAD in the worktree.
 */
async function getHeadSha(worktree: string, repoRoot: string): Promise<string> {
  const result = await run("git", ["-C", worktree, "rev-parse", "HEAD"], repoRoot);
  return result.stdout.trim();
}

/**
 * Get the SHA of the remote branch tip.
 */
async function getRemoteSha(branch: string, repoRoot: string): Promise<string | null> {
  try {
    const result = await run("git", ["ls-remote", "origin", branch], repoRoot);
    const match = result.stdout.match(/^([a-f0-9]+)\s+refs\/heads\//m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export async function cmdSubmit(taskId: string, options?: SubmitOptions): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);
  const json = options?.json ?? false;

  // --- Precondition checks ---
  if (!task) {
    if (json) {
      const { printJson, jsonError } = await import("../util/json-result.js");
      printJson(jsonError(`Task ${taskId} not found.`, "TASK_NOT_FOUND"));
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  if (!task.branch) {
    const msg = `Task ${taskId} has no branch. Run 'taskforge start ${taskId}' first.`;
    if (json) {
      const { printJson, jsonError } = await import("../util/json-result.js");
      printJson(jsonError(msg, "NO_BRANCH"));
      return;
    }
    throw new SubmissionError(msg, "precondition", false, "NO_BRANCH");
  }

  if (task.branch === "main" || task.branch === "task-state") {
    const msg = `Refusing to push branch "${task.branch}".`;
    if (json) {
      const { printJson, jsonError } = await import("../util/json-result.js");
      printJson(jsonError(msg, "PROTECTED_BRANCH"));
      return;
    }
    throw new SubmissionError(msg, "precondition", false, "PROTECTED_BRANCH");
  }

  if (!task.worktree) {
    const msg = `Task ${taskId} has no worktree. Run 'taskforge start ${taskId}' first.`;
    if (json) {
      const { printJson, jsonError } = await import("../util/json-result.js");
      printJson(jsonError(msg, "NO_WORKTREE"));
      return;
    }
    throw new SubmissionError(msg, "precondition", false, "NO_WORKTREE");
  }

  // --- Ownership ---
  try {
    assertTaskOwnership(task, repoRoot);
  } catch {
    const msg = `Task ${taskId} ownership mismatch.`;
    if (json) {
      const { printJson, jsonError } = await import("../util/json-result.js");
      printJson(jsonError(msg, "OWNERSHIP_MISMATCH"));
      return;
    }
    throw new SubmissionError(msg, "ownership", false, "OWNERSHIP_MISMATCH");
  }

  // --- Step 1: Checkpoint if needed ---
  const hasChanges = await hasUncommittedChanges(task.worktree, repoRoot);
  if (hasChanges) {
    if (!json) logInfo("Uncommitted changes found. Running checkpoint first...");
    try {
      await run("git", ["-C", task.worktree, "add", "."], repoRoot);
      await run("git", ["-C", task.worktree, "commit", "-m", `checkpoint: pre-submit auto-commit\n\nTask: ${taskId}\nTaskForge-Managed: true`], repoRoot);
      if (!json) logSuccess("Checkpoint created.");
    } catch (err) {
      const msg = `Checkpoint failed: ${err instanceof Error ? err.message : String(err)}`;
      if (json) {
        const { printJson, jsonError } = await import("../util/json-result.js");
        printJson(jsonError(msg, "CHECKPOINT_FAILED"));
        return;
      }
      throw new SubmissionError(msg, "checkpoint", true, "CHECKPOINT_FAILED");
    }
  }

  // --- Step 2: Get current SHA ---
  let headSha: string;
  try {
    headSha = await getHeadSha(task.worktree, repoRoot);
  } catch (err) {
    const msg = `Failed to read HEAD SHA: ${err instanceof Error ? err.message : String(err)}`;
    if (json) {
      const { printJson, jsonError } = await import("../util/json-result.js");
      printJson(jsonError(msg, "SHA_READ_FAILED"));
      return;
    }
    throw new SubmissionError(msg, "sha-read", true, "SHA_READ_FAILED");
  }

  // --- Step 3: Push ---
  try {
    await run("git", ["-C", task.worktree, "push", "origin", task.branch], repoRoot);
    if (!json) logSuccess("Branch pushed.");
  } catch (err) {
    const msg = `Push failed: ${err instanceof Error ? err.message : String(err)}`;
    if (json) {
      const { printJson, jsonError } = await import("../util/json-result.js");
      printJson(jsonError(msg, "PUSH_FAILED"));
      return;
    }
    throw new SubmissionError(msg, "push", true, "PUSH_FAILED");
  }

  // --- Step 4: Record remote SHA for later reconciliation ---
  const remoteSha = await getRemoteSha(task.branch, repoRoot);

  // --- Step 5: PR create / reconcile ---
  const config = loadConfig(repoRoot);
  const githubConfig = config.github;
  const githubConfigured = !!(githubConfig?.enabled && githubConfig.owner && githubConfig.repo);

  let prNumber: number | undefined = task.pr;
  let prUrl: string | undefined;
  let prCreated = false;
  let prReconciled = false;

  if (githubConfigured) {
    // Try to find an existing PR for this branch
    const existingPr = task.pr
      ? undefined // PR already recorded — skip lookup
      : await findPullRequestByBranch(githubConfig! as unknown as GitHubConfig, task.branch);

    if (existingPr) {
      // PR already exists — reconcile metadata
      prNumber = existingPr.number;
      prUrl = existingPr.url;
      prReconciled = true;
      if (!json) logInfo(`Found existing PR #${prNumber} for branch ${task.branch}.`);
    } else if (task.pr) {
      // PR is recorded in task but not found via API — use recorded value
      prNumber = task.pr;
      if (!json) logInfo(`Using recorded PR #${prNumber}.`);
    } else {
      // No existing PR — create one
      try {
        const title = task.body?.match(/^#\s+\S+:\s+(.+)$/m)?.[1]?.trim() ?? `Task ${taskId}`;
        const body = task.body ?? "";
        const base = config.project?.defaultBranch ?? "main";
        const gc: GitHubConfig = githubConfig! as unknown as GitHubConfig;
        const pr = await createPullRequest(gc, title, task.branch, base, body);
        prNumber = pr.number;
        prUrl = pr.url;
        prCreated = true;
        if (!json) logSuccess(`PR #${prNumber} created.`);
      } catch (err) {
        const msg = `PR creation failed: ${err instanceof Error ? err.message : String(err)}`;
        if (json) {
          const { printJson, jsonError } = await import("../util/json-result.js");
          printJson(jsonError(msg, "PR_CREATE_FAILED"));
          return;
        }
        throw new SubmissionError(msg, "pr-create", true, "PR_CREATE_FAILED");
      }
    }
  }

  // --- Step 6: Record submission via transaction ---
  try {
    await withTaskStateTransaction(
      { command: `submit ${taskId}`, maxRetries: 3 },
      (tx) => {
        const fresh = tx.loadTask(taskId);
        if (!fresh) throw new Error(`Task ${taskId} not found during transaction`);

        fresh.submitted_sha = headSha;
        fresh.submitted_at = new Date().toISOString();
        if (prNumber) fresh.pr = prNumber;
        if (prUrl) (fresh as unknown as Record<string, unknown>).pr_url = prUrl;
        if (remoteSha) fresh.branch = task.branch; // ensure branch is set

        // Roll forward status: if it's In Progress or Implementation Complete,
        // move to Submitted
        if (fresh.status === "In Progress" || fresh.status === "Implementation Complete") {
          fresh.status = "Submitted";
        }

        tx.updateTask(fresh);
        tx.appendNote(taskId, "System", [
          `Task submitted via taskforge submit.`,
          `SHA: ${headSha.slice(0, 12)}`,
          prNumber ? `PR: #${prNumber}${prCreated ? " (created)" : prReconciled ? " (reconciled)" : ""}` : "",
          `Remote branch: ${task.branch}`,
        ].filter(Boolean));
      },
    );
  } catch (err) {
    const msg = `Failed to record submission metadata: ${err instanceof Error ? err.message : String(err)}`;
    if (json) {
      const { printJson, jsonError } = await import("../util/json-result.js");
      printJson(jsonError(msg, "METADATA_WRITE_FAILED"));
      return;
    }
    throw new SubmissionError(msg, "metadata", true, "METADATA_WRITE_FAILED");
  }

  // --- Success output ---
  appendTaskTranscript(repoRoot, taskId, createTaskEvent(taskId, "git.push", {
    summary: `Submitted branch ${task.branch} (SHA: ${headSha.slice(0, 12)})${prNumber ? ` PR #${prNumber}` : ""}`,
  }));

  const result = submitStateMachine({
    prCreated: prCreated || prReconciled,
    githubConfigured,
    taskId,
  });
  getDefaultGuidanceAdapter().pushGuidance(result);

  if (json) {
    const { printJson, jsonOk } = await import("../util/json-result.js");
    printJson(jsonOk({
      message: `Task ${taskId} submitted. SHA: ${headSha.slice(0, 12)}${prNumber ? ` PR #${prNumber}` : ""}`,
      sha: headSha,
      branch: task.branch,
      pr: prNumber,
      prUrl,
      prCreated,
      prReconciled,
      status: "Submitted",
    } as never));
    return;
  }

  logSuccess(result.guidance);
}

export async function cmdPr(taskId: string): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);
  const config = loadConfig(repoRoot);

  if (!task) {
    const result = submitStateMachine({
      prCreated: false,
      githubConfigured: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    logError(result.guidance);
    throw new TaskNotFoundError(taskId);
  }

  if (!task.branch) {
    const result = submitStateMachine({
      prCreated: false,
      githubConfigured: false,
      taskId,
      errorMessage: "No branch recorded",
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    logError(result.guidance);
    throw new Error(result.guidance);
  }

  const title = `[${taskId}] ${taskId}`;
  const body = `Task: ${taskId}\n\nAuto-generated by TaskForge.`;

  if (config.github?.enabled && config.github.owner && config.github.repo) {
    logInfo(`Creating PR for ${taskId} from branch ${task.branch} via GitHub API...`);

    try {
      const githubConfig: GitHubConfig = {
        owner: config.github.owner,
        repo: config.github.repo,
        token: process.env.GITHUB_TOKEN,
      };
      const pr = await createPullRequest(githubConfig, title, task.branch, "main", body);

      // Record PR number in task metadata
      try {
        await withTaskStateTransaction(
          { command: `pr ${taskId}`, maxRetries: 3 },
          (tx) => {
            const fresh = tx.loadTask(taskId);
            if (fresh) {
              fresh.pr = pr.number;
              (fresh as unknown as Record<string, unknown>).pr_url = pr.url;
              tx.updateTask(fresh);
              tx.appendNote(taskId, "System", [`PR #${pr.number} recorded.`]);
            }
          },
        );
      } catch {
        // Non-critical — PR was created even if metadata write fails
      }

      const result = submitStateMachine({
        prCreated: true,
        prNumber: pr.number,
        prUrl: pr.url,
        githubConfigured: true,
        taskId,
      });
      getDefaultGuidanceAdapter().pushGuidance(result);

      logSuccess(result.guidance);

      appendTaskTranscript(repoRoot, taskId, createTaskEvent(taskId, "github.pr.created", {
        summary: `Created PR #${pr.number}`,
        metadata: { prNumber: pr.number, prUrl: pr.url },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      const result = submitStateMachine({
        prCreated: false,
        githubConfigured: true,
        taskId,
        errorMessage: message,
      });
      getDefaultGuidanceAdapter().pushGuidance(result);

      logWarn(result.guidance);

      appendTaskTranscript(repoRoot, taskId, createTaskEvent(taskId, "github.pr.failed", {
        summary: `PR creation failed: ${message}`,
      }));

      throw error;
    }
  } else {
    const result = submitStateMachine({
      prCreated: false,
      githubConfigured: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);

    logWarn(result.guidance);
    logInfo(`To create a PR manually:`);
    logInfo(`  gh pr create --title "${title}" --head ${task.branch} --base main --body "${body}"`);
    logInfo(`  Or visit: https://github.com/<owner>/<repo>/compare/main...${task.branch}`);

    appendTaskTranscript(repoRoot, taskId, createTaskEvent(taskId, "github.pr.manual", {
      summary: "Manual PR creation required - GitHub not configured",
    }));
  }
}
