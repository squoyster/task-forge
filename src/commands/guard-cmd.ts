/**
 * `taskforge guard` — inspect and manage the mutation boundary.
 *
 * Subcommands:
 *   guard:status   — show whether enforcement is active, list denied/allowed
 *   guard:override — (doctor only) authorise a specific mutation
 */
import { loadTaskById } from "../core/task-store.js";
import { getRepoRoot } from "../util/paths.js";
import { run } from "../util/exec.js";
import { logInfo, logHeader, logDivider, logSub, logSuccess } from "../util/logging.js";
import { writeResult } from "../util/write-command-result.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { TaskNotFoundError } from "../core/errors.js";
import {
  isManagedSession,
  DENIED_GIT_COMMANDS,
  READ_ONLY_GIT_COMMANDS,
  checkMutationAllowed,
  recordOverride,
  type OverrideRequest,
} from "../core/mutation-guard.js";

export interface GuardStatusOptions {
  json?: boolean;
}

export interface GuardOverrideOptions {
  json?: boolean;
}

export async function cmdGuardStatus(opts: GuardStatusOptions = {}): Promise<void> {
  const managed = isManagedSession();

  const status = {
    managed,
    envVar: process.env.TASK_FORGE_ACTIVE,
    doctorOverrideAvailable: true,
    deniedCommandCount: DENIED_GIT_COMMANDS.length,
    readOnlyCommandCount: READ_ONLY_GIT_COMMANDS.length,
    doctorOverrideExists: false, // Placeholder — could check doctor lock
  };

  if (opts.json) {
    writeResult(successResult({
      command: "guard:status",
      guidance: `Mutation guard: ${status.managed ? "active" : "inactive"}`,
    }), opts.json);
    return;
  }

  logHeader("Mutation Boundary Status");
  logDivider();
  logSub(`Managed session: ${managed ? "YES" : "NO (TASK_FORGE_ACTIVE not set)"}`);
  logSub(`Denied commands: ${DENIED_GIT_COMMANDS.length}`);
  logSub(`Read-only commands: ${READ_ONLY_GIT_COMMANDS.length}`);
  logSub(`Doctor override: available`);
  logDivider();

  logInfo("Denied mutations:");
  for (const cmd of DENIED_GIT_COMMANDS) {
    logSub(`  git ${cmd}`);
  }
  logInfo("Allowed read-only commands:");
  for (const cmd of READ_ONLY_GIT_COMMANDS) {
    logSub(`  git ${cmd}`);
  }
}

export async function cmdGuardOverride(
  taskId: string,
  command: string,
  reason: string,
  opts: GuardOverrideOptions = {},
): Promise<void> {
  // Verify the task exists
  const task = loadTaskById(taskId);
  if (!task) throw new TaskNotFoundError(taskId);

  // Check that the caller is a doctor
  const actor = process.env.TASKFORGE_ACTOR;
  if (actor !== "doctor") {
    const msg = "Only doctor agents may issue mutation overrides. Set TASKFORGE_ACTOR=doctor.";
    if (opts.json) {
      writeResult(failedResult({ command: "guard:override", taskId, error: msg, code: "UNAUTHORIZED" }), opts.json);
      return;
    }
    throw new Error(msg);
  }

  // Validate the command can actually be checked
  const result = checkMutationAllowed(command);
  if (result.allowed) {
    const msg = `Command "${command}" is not denied — no override needed.`;
    if (opts.json) {
      writeResult(successResult({ command: "guard:override", taskId, guidance: `Command "${command}" is not denied — no override needed.` }), opts.json);
      return;
    }
    logInfo(msg);
    return;
  }

  // Get the repo root for audit
  const repoRoot = getRepoRoot();
  let beforeSha = "";
  try {
    const r = await run("git", ["rev-parse", "HEAD"], repoRoot);
    beforeSha = r.stdout.trim();
  } catch {}

  // Record the override
  const override: OverrideRequest = {
    reason,
    identity: "doctor",
    taskId,
    command,
    affectedRepo: repoRoot,
    beforeSha: beforeSha || undefined,
    timestamp: new Date().toISOString(),
  };

  recordOverride(override);

  if (opts.json) {
    writeResult(successResult({ command: "guard:override", taskId, guidance: `Override issued for command "${command}" (task ${taskId}). Valid for 5 minutes.` }), opts.json);
    return;
  }

  logSuccess(`Override issued for command "${command}" (task ${taskId}).`);
  logSub(`Reason: ${reason}`);
  logSub(`Valid for 5 minutes. Audit recorded at .override-audit.jsonl`);
}
