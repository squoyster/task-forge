import { getRepoRoot } from "../util/paths.js";
import { loadTaskById, writeTaskFile } from "../core/task-store.js";
import { assertTaskOwnership } from "../core/session.js";
import { run } from "../util/exec.js";
import { createTaskEvent, appendTaskTranscript } from "../core/audit.js";
import { TaskForgeError, TaskNotFoundError } from "../core/errors.js";
import { loadConfig } from "../core/config.js";
import { createPullRequest, findPullRequestByHead } from "../integrations/github/service.js";
import type { GitHubConfig } from "../integrations/github/types.js";
import type { Task } from "../core/task.js";
import { logInfo, logHeader, logSuccess, logWarn, logError } from "../util/logging.js";
import { writeResult } from "../util/write-command-result.js";
import { successResult, noopResult, failedResult } from "../core/result-builder.js";
import { checkpointStateMachine, submitStateMachine } from "../core/command-states.js";
import { getDefaultGuidanceAdapter } from "../core/guidance-adapter.js";
import { getBranchCommitsBehindIntegration } from "../core/git.js";

function requireTask(taskId: string): Task {
  const task = loadTaskById(taskId);
  if (!task) throw new TaskNotFoundError(taskId);
  return task;
}

interface MergeabilityResult {
  ok: boolean;
  mergeable: boolean;
  detail?: string;
}

function summarizeMergeConflict(output: string): string | undefined {
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.find((line) => /conflict|CONFLICT|add\/add|modify\/delete/i.test(line)) ?? lines[0];
}

async function checkMergeabilityAgainst(
  repoRoot: string,
  worktree: string,
  integrationBranch: string,
): Promise<MergeabilityResult> {
  // Note: origin/<integrationBranch> must already be fetched by the caller.
  const mergeTreeResult = await run(
    "git",
    ["-C", worktree, "merge-tree", "--write-tree", "--messages", "HEAD", `origin/${integrationBranch}`],
    repoRoot,
  );

  const mergeOutput = [mergeTreeResult.stdout, mergeTreeResult.stderr]
    .filter((part) => part.trim().length > 0)
    .join("\n");

  if (mergeTreeResult.exitCode !== 0) {
    // exit code 1 = conflict; exit code > 1 = tool error
    if (mergeTreeResult.exitCode > 1) {
      return {
        ok: false,
        mergeable: false,
        detail: summarizeMergeConflict(mergeOutput),
      };
    }
    return {
      ok: true,
      mergeable: false,
      detail: summarizeMergeConflict(mergeOutput),
    };
  }

  return { ok: true, mergeable: true };
}

function isPushNoop(pushOutput: string): boolean {
  return /\[up to date\]/i.test(pushOutput) || /^=\s/m.test(pushOutput);
}

interface BranchAssessment {
  remoteSha: string | null;
  localHeadSha: string;
  commitsAheadOfRemote: number;
  state: "missing_remote" | "local_ahead" | "already_pushed";
}

/**
 * Assess the publication state of a task branch by checking the remote
 * without fetching. Uses `git ls-remote` (lightweight, no fetch needed)
 * and `git rev-list --count` to determine whether the branch needs pushing,
 * has unpushed commits, or is already up to date with the remote.
 */
async function assessBranchState(
  repoRoot: string,
  worktree: string,
  branch: string,
): Promise<BranchAssessment> {
  const lsRemote = await run(
    "git",
    ["ls-remote", "origin", `refs/heads/${branch}`],
    repoRoot,
  );
  const remoteSha = lsRemote.stdout.trim().split(/\s+/)[0] || null;

  const revParse = await run(
    "git",
    ["-C", worktree, "rev-parse", "HEAD"],
    repoRoot,
  );
  const localHeadSha = revParse.stdout.trim();

  let commitsAheadOfRemote = 0;
  if (remoteSha) {
    const revList = await run(
      "git",
      ["-C", worktree, "rev-list", "--count", `${remoteSha}..HEAD`],
      repoRoot,
    );
    commitsAheadOfRemote = parseInt(revList.stdout.trim(), 10) || 0;
  }

  let state: BranchAssessment["state"];
  if (!remoteSha) {
    state = "missing_remote";
  } else if (commitsAheadOfRemote > 0) {
    state = "local_ahead";
  } else {
    state = "already_pushed";
  }

  return { remoteSha, localHeadSha, commitsAheadOfRemote, state };
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
    await assertTaskOwnership(task, repoRoot);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Ownership verification failed";
    const result = checkpointStateMachine({
      hasChanges: false,
      commitSucceeded: false,
      inWorktree: true,
      taskId,
      errorMessage,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    throw error instanceof TaskForgeError ? error : new Error(result.guidance);
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

  try {
    appendTaskTranscript(repoRoot, taskId, createTaskEvent(taskId, "git.commit", {
      summary: message,
    }));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const guidance =
      `Commit succeeded for ${taskId}, but TaskForge could not record the checkpoint audit event. ` +
      `The branch contains the commit and the worktree should be clean. ` +
      `Inspect the task state before continuing. Audit failure: ${detail}`;
    logError(guidance);
    writeResult(failedResult({
      command: "checkpoint",
      taskId,
      worktree: task.worktree,
      branch,
      guidance,
      error: guidance,
      code: "CHECKPOINT_AUDIT_WRITE_FAILED",
      recoverySteps: [
        `Inspect task state: taskforge inspect ${taskId} --json`,
        "Repair the audit/log path or permissions issue that blocked transcript writing",
        `Continue from the existing commit after recovery; do not recommit unchanged work`,
      ],
      nextCommands: [
        { command: `taskforge inspect ${taskId} --json`, purpose: "Inspect the partial checkpoint state", when: "Immediately after the audit failure", allowedFor: "all", priority: 1 },
        { command: "taskforge doctor --check", purpose: "Diagnose audit/log path issues", when: "If the audit failure cause is unclear", allowedFor: "all", priority: 2 },
        { command: `taskforge submit ${taskId}`, purpose: "Continue from the existing commit once the state is understood", when: "After recovery confirms the branch is correct", allowedFor: "all", priority: 3 },
      ],
    }), json);
    return;
  }

  logSuccess(result.guidance);

  writeResult(successResult({
    command: "checkpoint",
    taskId,
    guidance: result.guidance,
  }), json);
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

  const config = loadConfig(repoRoot);
  const integrationBranch = config.project?.defaultBranch ?? "main";
  const githubConfigured = !!(config.github?.enabled && config.github.owner && config.github.repo);

  try {
    await assertTaskOwnership(task, repoRoot);
  } catch (error) {
    const result = submitStateMachine({
      prCreated: false,
      githubConfigured,
      taskId,
      errorMessage: error instanceof Error ? error.message : "Ownership verification failed",
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    logError(result.guidance);
    throw error instanceof TaskForgeError ? error : new Error(result.guidance);
  }

  // ── Pre-push validation: fetch integration branch ──────────────
  const fetchResult = await run(
    "git",
    ["-C", task.worktree, "fetch", "origin", integrationBranch],
    repoRoot,
  );
  if (fetchResult.exitCode !== 0) {
    const guidance =
      `Could not fetch origin/${integrationBranch} from ${task.worktree}. ` +
      `Resolve the repository state and retry submit.`;
    logError(guidance);
    writeResult(failedResult({
      command: "submit",
      taskId,
      branch: task.branch,
      worktree: task.worktree,
      error: guidance,
      code: "FETCH_FAILED",
    }), json);
    return;
  }

  // ── Pre-push validation: check if branch is behind integration branch ───
  const behindCount = await getBranchCommitsBehindIntegration(repoRoot, task.branch, integrationBranch);
  if (behindCount > 0) {
    const guidance =
      `Branch is ${behindCount} commit(s) behind origin/${integrationBranch}. ` +
      `Rebase or merge the integration branch into the task branch before submitting. ` +
      `Suggested: git rebase origin/${integrationBranch} (or git merge origin/${integrationBranch}).`;
    logError(guidance);
    writeResult(failedResult({
      command: "submit",
      taskId,
      branch: task.branch,
      worktree: task.worktree,
      error: guidance,
      code: "BRANCH_BEHIND",
    }), json);
    return;
  }

  // ── Pre-push validation: check for unrelated commits ──────────
  // Uses base_sha recorded by task.start branch provenance.
  // If base_sha is not recorded, the check is skipped gracefully.
  const taskFrontmatter = task as unknown as Record<string, unknown>;
  const baseSha = taskFrontmatter.base_sha as string | undefined;
  if (baseSha) {
    const mergeBaseResult = await run(
      "git",
      ["-C", task.worktree, "merge-base", "--is-ancestor", baseSha, "HEAD"],
      repoRoot,
    );
    if (mergeBaseResult.exitCode !== 0) {
      const guidance =
        `Branch contains commits that are not descendants of the recorded base SHA. ` +
        `This may indicate cross-task contamination or an incorrect branch base.`;
      logError(guidance);
      writeResult(failedResult({
        command: "submit",
        taskId,
        branch: task.branch,
        worktree: task.worktree,
        error: guidance,
        code: "UNRELATED_COMMITS",
      }), json);
      return;
    }
  }

  // ── Pre-push validation: mergeability check ────────────────────
  const mergeability = await checkMergeabilityAgainst(repoRoot, task.worktree, integrationBranch);
  if (!mergeability.ok) {
    const guidance =
      `Could not verify whether ${task.branch} merges cleanly with origin/${integrationBranch}. ` +
      `Resolve the repository state and retry submit. ${mergeability.detail ?? ""}`.trim();
    logError(guidance);
    writeResult(failedResult({
      command: "submit",
      taskId,
      branch: task.branch,
      worktree: task.worktree,
      error: guidance,
      code: "MERGEABILITY_CHECK_FAILED",
    }), json);
    return;
  }

  if (!mergeability.mergeable) {
    const detail = mergeability.detail ? ` Conflict detail: ${mergeability.detail}` : "";
    const guidance =
      `Branch ${task.branch} does not merge cleanly with origin/${integrationBranch}. ` +
      `Rebase or merge ${integrationBranch} into the task branch, resolve conflicts, checkpoint, and submit again.${detail}`;
    logError(guidance);
    writeResult(failedResult({
      command: "submit",
      taskId,
      branch: task.branch,
      worktree: task.worktree,
      error: guidance,
      code: "NOT_MERGEABLE",
    }), json);
    return;
  }

  // ── Pre-push branch state assessment ──────────────────────────────────────
  const assessment = await assessBranchState(repoRoot, task.worktree, task.branch);

  // ── Fast path: branch already up to date on remote ──────────────────────
  if (assessment.state === "already_pushed") {
    let prNumber: number | null = null;
    if (githubConfigured) {
      const ghConfig: GitHubConfig = {
        owner: config.github!.owner as string,
        repo: config.github!.repo as string,
        token: process.env.GITHUB_TOKEN,
      };
      try {
        const pr = await findPullRequestByHead(ghConfig, task.branch);
        prNumber = pr?.number ?? null;
        if (pr) {
          logInfo(`PR #${pr.number} exists for branch ${task.branch}`);
        } else {
          logInfo("No open PR found for branch");
        }
      } catch {
        logInfo("PR lookup failed (API error)");
      }
    } else {
      logInfo("GitHub not configured — cannot check PR status");
    }

    if (prNumber) {
      const guidance =
        `Branch ${task.branch} is already submitted and merges cleanly with origin/${integrationBranch}. ` +
        `PR #${prNumber} exists. No changes to submit for ${taskId}.`;
      logInfo(guidance);
      writeResult(noopResult({
        command: "submit",
        taskId,
        branch: task.branch,
        worktree: task.worktree,
        guidance,
        reason: "Branch is already submitted with an open pull request.",
        nextCommands: [
          { command: `taskforge diff ${taskId}`, purpose: "Review the latest diff", when: "After confirming submission", allowedFor: "all", priority: 2 },
          { command: `taskforge done ${taskId}`, purpose: "Complete the task", when: "After PR is reviewed and merged", allowedFor: "all", priority: 3 },
        ],
      }), json);
      return;
    }

    // Branch pushed but no PR — create one (no push needed)
    if (githubConfigured) {
      const ghConfig: GitHubConfig = {
        owner: config.github!.owner as string,
        repo: config.github!.repo as string,
        token: process.env.GITHUB_TOKEN,
      };
      try {
        const title = `[${taskId}] ${taskId}`;
        const body = `Task: ${taskId}\n\nAuto-generated by TaskForge.`;
        const pr = await createPullRequest(ghConfig, title, task.branch, integrationBranch, body);
        const prGuidance =
          `Branch ${task.branch} was already on remote and merges cleanly with origin/${integrationBranch}. ` +
          `PR #${pr.number} created: ${pr.url}.`;
        logSuccess(prGuidance);
        writeResult(successResult({
          command: "submit",
          taskId,
          branch: task.branch,
          worktree: task.worktree,
          guidance: prGuidance,
        }), json);
        appendTaskTranscript(repoRoot, taskId, createTaskEvent(taskId, "github.pr.created", {
          summary: `Created PR #${pr.number}`,
          metadata: { prNumber: pr.number, prUrl: pr.url },
        }));
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const guidance =
          `Branch ${task.branch} is on remote but PR creation failed: ${message}. ` +
          `Run 'taskforge pr ${taskId}' to create the PR manually.`;
        logWarn(guidance);
        writeResult(noopResult({
          command: "submit",
          taskId,
          branch: task.branch,
          worktree: task.worktree,
          guidance,
          reason: "Branch pushed; PR creation failed.",
          nextCommands: [
            { command: `taskforge pr ${taskId}`, purpose: "Create pull request manually", when: "After submit indicates PR creation failed", allowedFor: "all", priority: 1 },
          ],
        }), json);
        return;
      }
    }

    // No GitHub config
    const guidance =
      `Branch ${task.branch} is on remote and merges cleanly with origin/${integrationBranch}. ` +
      `To create a pull request, run 'taskforge pr ${taskId}' or create one on GitHub manually.`;
    logInfo(guidance);
    writeResult(noopResult({
      command: "submit",
      taskId,
      branch: task.branch,
      worktree: task.worktree,
      guidance,
      reason: "Branch is already submitted. Create a PR manually.",
    }), json);
    return;
  }

  // ── Push needed (missing_remote or local_ahead) ──────────────────────────
  const pushResult = await run(
    "git",
    ["-C", task.worktree, "push", "--porcelain", "origin", task.branch],
    repoRoot,
  );
  const pushOutput = [pushResult.stdout, pushResult.stderr]
    .filter((part) => part.trim().length > 0)
    .join("\n");

  if (pushResult.exitCode !== 0) {
    const guidance = `Failed to push branch ${task.branch}: ${pushOutput || "git push failed"}`;
    logError(guidance);
    throw new Error(guidance);
  }

  if (isPushNoop(pushOutput)) {
    const guidance =
      `Branch ${task.branch} is already submitted and merges cleanly with origin/${integrationBranch}. ` +
      `No changes to submit for ${taskId}.`;
    logInfo(guidance);
    writeResult(noopResult({
      command: "submit",
      taskId,
      branch: task.branch,
      worktree: task.worktree,
      guidance,
      reason: "Branch already on remote (noop push).",
    }), json);
    return;
  }

  // ── Record submitted SHA ────────────────────────────────────────
  const headShaResult = await run(
    "git",
    ["-C", task.worktree, "rev-parse", "HEAD"],
    repoRoot,
  );
  const headSha = headShaResult.stdout.trim();
  if (headSha) {
    const updatedTask = loadTaskById(taskId);
    if (updatedTask) {
      updatedTask.submitted_sha = headSha;
      updatedTask.submitted_at = new Date().toISOString();
      writeTaskFile(updatedTask);
    }
  }

  // ── Push succeeded — create PR if GitHub is configured ───────────────
  if (githubConfigured) {
    const title = `[${taskId}] ${taskId}`;
    const body = `Task: ${taskId}\n\nAuto-generated by TaskForge.`;

    try {
      const githubConfig: GitHubConfig = {
        owner: config.github!.owner!,
        repo: config.github!.repo!,
        token: process.env.GITHUB_TOKEN,
      };
      const pr = await createPullRequest(githubConfig, title, task.branch, integrationBranch, body);

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
        command: "submit",
        taskId,
        branch: task.branch,
        worktree: task.worktree,
        guidance: result.guidance,
      }), json);

      appendTaskTranscript(repoRoot, taskId, createTaskEvent(taskId, "git.push", {
        summary: `Pushed branch ${task.branch} and created PR #${pr.number}`,
        metadata: { integrationBranch, prNumber: pr.number, prUrl: pr.url, submittedSha: headSha },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      const result = submitStateMachine({
        prCreated: false,
        githubConfigured: true,
        taskId,
        prCreationFailed: true,
        integrationBranch,
        errorMessage: message,
      });
      getDefaultGuidanceAdapter().pushGuidance(result);
      logWarn(result.guidance);

      writeResult(failedResult({
        command: "submit",
        taskId,
        branch: task.branch,
        worktree: task.worktree,
        error: result.guidance,
        code: "PR_CREATION_FAILED",
      }), json);

      appendTaskTranscript(repoRoot, taskId, createTaskEvent(taskId, "github.pr.failed", {
        summary: `Branch pushed but PR creation failed: ${message}`,
        metadata: { integrationBranch, submittedSha: headSha },
      }));
    }
    return;
  }

  // ── No GitHub configured — success with manual PR instructions ──
  const guidance =
    `Pushed branch ${task.branch} to origin. ` +
    `Branch merges cleanly with origin/${integrationBranch}. ` +
    `Create a PR manually: gh pr create --title "[${taskId}] ${taskId}" --head ${task.branch} --base ${integrationBranch}`;
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
    metadata: { integrationBranch, submittedSha: headSha },
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

  const integrationBranch = config.project?.defaultBranch ?? "main";
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
      const pr = await createPullRequest(githubConfig, title, task.branch, integrationBranch, body);

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
    logInfo("To create a PR manually:");
    logInfo(`  gh pr create --title "${title}" --head ${task.branch} --base ${integrationBranch} --body "${body}"`);
    logInfo(`  Or visit: https://github.com/<owner>/<repo>/compare/${integrationBranch}...${task.branch}`);

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
