import { getRepoRoot } from "../util/paths.js";
import { loadTaskById } from "../core/task-store.js";
import { assertTaskOwnership } from "../core/session.js";
import { run } from "../util/exec.js";
import { createTaskEvent, appendTaskTranscript } from "../core/audit.js";
import { TaskNotFoundError } from "../core/errors.js";
import { loadConfig } from "../core/config.js";
import { createPullRequest } from "../integrations/github/service.js";
import type { GitHubConfig } from "../integrations/github/types.js";
import type { Task } from "../core/task.js";
import { logInfo, logHeader, logSuccess, logWarn, logError } from "../util/logging.js";
import { writeResult } from "../util/write-command-result.js";
import { successResult, noopResult, failedResult } from "../core/result-builder.js";
import { checkpointStateMachine, submitStateMachine } from "../core/command-states.js";
import { getDefaultGuidanceAdapter } from "../core/guidance-adapter.js";

function requireTask(taskId: string): Task {
  const task = loadTaskById(taskId);
  if (!task) throw new TaskNotFoundError(taskId);
  return task;
}

export async function cmdDiff(taskId: string, json = false): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = requireTask(taskId);

  if (!task.worktree) {
    throw new Error(`No worktree found for ${taskId}. Run 'taskforge start ${taskId}' first.`);
  }

  try {
    await assertTaskOwnership(task, task.worktree);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeResult(failedResult({
      command: "diff",
      taskId,
      error: message,
      code: "OWNERSHIP_MISMATCH",
      nextCommands: [
        { command: `taskforge resume ${taskId}`, purpose: "Enter the owning task workspace", when: "Before reviewing the diff", allowedFor: "all", priority: 1 },
        { command: `taskforge inspect ${taskId} --json`, purpose: "Inspect task ownership and workspace state", when: "If ownership is unclear", allowedFor: "all", priority: 2 },
      ],
    }), json);
    return;
  }

  logHeader(`Diff: ${taskId}`);
  const result = await run("git", ["-C", task.worktree, "diff"], repoRoot);
  process.stdout.write(result.stdout);

  writeResult(successResult({
    command: "diff",
    taskId,
    guidance: `Diff shown for ${taskId}.`,
  }), json);
}

export async function cmdCheckpoint(taskId: string, message: string, json = false): Promise<void> {
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
    writeResult(noopResult({
      command: "checkpoint",
      taskId,
      guidance: result.guidance,
    }), json);
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

  writeResult(successResult({
    command: "checkpoint",
    taskId,
    guidance: result.guidance,
  }), json);

  appendTaskTranscript(repoRoot, taskId, createTaskEvent(taskId, "git.commit", {
    summary: message,
  }));
}

export async function cmdSubmit(taskId: string, json = false): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

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

  if (task.branch === "main" || task.branch === "task-state") {
    const result = submitStateMachine({
      prCreated: false,
      githubConfigured: false,
      taskId,
      errorMessage: `Refusing to push ${task.branch}`,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    logError(result.guidance);
    throw new Error(result.guidance);
  }

  if (!task.worktree) {
    const result = submitStateMachine({
      prCreated: false,
      githubConfigured: false,
      taskId,
      errorMessage: "No worktree found",
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    logError(result.guidance);
    throw new Error(result.guidance);
  }

  const pushResult = await run(
    "git",
    ["-C", task.worktree, "push", "--porcelain", "origin", task.branch],
    repoRoot,
  );
  const pushOutput = [pushResult.stdout, pushResult.stderr]
    .filter((part) => part.trim().length > 0)
    .join("\n");

  if (pushResult.exitCode !== 0) {
    logError(`Failed to push branch ${task.branch}: ${pushOutput || "git push failed"}`);
    throw new Error(`Failed to push branch ${task.branch}: ${pushOutput || "git push failed"}`);
  }

  if (/\[up to date\]/i.test(pushOutput) || /^=\s/m.test(pushOutput)) {
    const guidance = `Branch ${task.branch} is already up to date on origin. No changes to submit for ${taskId}.`;
    logInfo(guidance);
    writeResult(noopResult({
      command: "submit",
      taskId,
      branch: task.branch,
      worktree: task.worktree,
      guidance,
      reason: "Branch is already up to date on origin.",
    }), json);
    return;
  }

  const guidance =
    `Pushed branch ${task.branch} to origin. ` +
    `Run 'taskforge pr ${taskId}' to create or update a pull request.`;

  logSuccess(guidance);

  writeResult(successResult({
    command: "submit",
    taskId,
    branch: task.branch,
    worktree: task.worktree,
    guidance,
  }), json);

  appendTaskTranscript(repoRoot, taskId, createTaskEvent(taskId, "git.push", {
    summary: `Pushed branch ${task.branch}`,
    metadata: { pushOutput },
  }));
}

export async function cmdPr(taskId: string, json = false): Promise<void> {
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

      const result = submitStateMachine({
        prCreated: true,
        prNumber: pr.number,
        prUrl: pr.url,
        githubConfigured: true,
        taskId,
      });
      getDefaultGuidanceAdapter().pushGuidance(result);

      logSuccess(result.guidance);

      writeResult(successResult({
        command: "pr",
        taskId,
        guidance: result.guidance,
      }), json);

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

    writeResult(successResult({
      command: "pr",
      taskId,
      guidance: result.guidance,
    }), json);

    appendTaskTranscript(repoRoot, taskId, createTaskEvent(taskId, "github.pr.manual", {
      summary: "Manual PR creation required - GitHub not configured",
    }));
  }
}
