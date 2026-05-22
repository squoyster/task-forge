#!/usr/bin/env node
import { Command } from "commander";
import { cmdInit } from "./commands/init.js";
import { cmdNext } from "./commands/next.js";
import { cmdStart, type StartOptions } from "./commands/start.js";
import { cmdStatus } from "./commands/status.js";
import { cmdSummary } from "./commands/summary.js";
import { cmdGates, type GatesOptions } from "./commands/gates.js";
import { cmdBlock } from "./commands/block.js";
import { cmdDone, type DoneOptions } from "./commands/done.js";
import { cmdUnlock, type UnlockOptions } from "./commands/unlock.js";
import { cmdSweep } from "./commands/sweep.js";
import { cmdHeartbeat, type HeartbeatOptions } from "./commands/heartbeat.js";
import { cmdInspect, type InspectOptions } from "./commands/inspect.js";
import { cmdClaim, type ClaimOptions } from "./commands/claim.js";
import { cmdReport, type ReportOptions } from "./commands/report.js";
import { cmdCleanup, type CleanupOptions } from "./commands/cleanup-cmd.js";
import { cmdPrompt } from "./commands/prompt.js";
import { cmdNew, type NewOptions } from "./commands/new.js";
import { cmdResume } from "./commands/resume.js";
import { cmdDoctor } from "./commands/doctor.js";
import { cmdConfigValidate } from "./commands/config-validate.js";
import { cmdRelease, type ReleaseOptions } from "./commands/release.js";
import { cmdValidateState } from "./commands/validate-state.js";
import { cmdList, type ListOptions } from "./commands/list.js";
import { cmdSync } from "./commands/sync.js";
import { cmdDepsScan } from "./commands/deps/scan.js";
import { cmdDepsAudit } from "./commands/deps/audit-cmd.js";
import { cmdDepsOutdated } from "./commands/deps/outdated-cmd.js";
import { cmdDepsDeprecated } from "./commands/deps/deprecated-cmd.js";
import { cmdDepsPlan } from "./commands/deps/plan.js";
import { cmdDepsCreateTasks } from "./commands/deps/create-tasks.js";
import { cmdDepsPr } from "./commands/deps/pr.js";
import { cmdDepsSummary } from "./commands/deps/summary.js";
import { TaskForgeError } from "./core/errors.js";
import { logError } from "./util/logging.js";

const program = new Command();

program
  .name("taskforge")
  .description("TaskForge Autonomous Coding Board CLI")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize TaskForge in this repository")
  .option("--force", "Recreate missing configuration files and templates")
  .action((opts: { force?: boolean }) => wrap(() => cmdInit(opts.force ?? false))());

program
  .command("next")
  .description("Return the highest-priority safe task to continue")
  .option("--json", "Output in JSON format")
  .action((opts: { json?: boolean }) => wrap(() => cmdNext(opts))());

program
  .command("start <taskId>")
  .description("Set up worktree, branch, and begin a task")
  .option("--force", "Override stale lock if task is locked by another session")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { force?: boolean; json?: boolean }) => {
    const startOpts: StartOptions = { force: opts.force ?? false, json: opts.json ?? false };
    return wrap(() => cmdStart(taskId, startOpts))();
  });

program
  .command("status")
  .description("Show project status summary")
  .option("--json", "Output in JSON format for programmatic consumption")
  .action((opts) => wrap(() => cmdStatus(opts.json ?? false))());

program
  .command("summary")
  .description("Show full project summary with recommended next action")
  .option("--json", "Output in JSON format for programmatic consumption")
  .action((opts) => wrap(() => cmdSummary(opts.json ?? false))());

program
  .command("gates")
  .description("Run configured verification gates")
  .option("--json", "Output results in JSON format")
  .option("--only <names>", "Run only specific gates (comma-separated)")
  .action((opts: { json?: boolean; only?: string }) => {
    const gateOpts: GatesOptions = {
      json: opts.json ?? false,
      only: opts.only,
    };
    return wrap(() => cmdGates(gateOpts))();
  });

program
  .command("block <taskId> <reason>")
  .description("Mark a task as blocked with a reason")
  .option("--category <cat>", "Blocker category: human_decision, test_failure, merge_conflict, missing_secret, unsafe_operation, ambiguous_spec")
  .option("--blocked-by <who>", "Who/what is blocking: human, agent, bot")
  .option("--json", "Output in JSON format")
  .action((taskId: string, reason: string, opts: { json?: boolean; category?: string; blockedBy?: string }) => {
    return wrap(() => cmdBlock(taskId, reason, {
      json: opts.json ?? false,
      category: opts.category,
      blockedBy: opts.blockedBy,
    }))();
  });

program
  .command("done <taskId>")
  .description("Mark a task as done")
  .option("--force", "Force transition to Done even if not allowed")
  .option("--cleanup", "Remove worktree after marking done")
  .option("--delete-branch", "Delete the task branch after marking done (implies --cleanup)")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { force?: boolean; cleanup?: boolean; deleteBranch?: boolean; json?: boolean }) => {
    const doneOpts: DoneOptions = {
      force: opts.force ?? false,
      cleanup: opts.cleanup ?? false,
      deleteBranch: opts.deleteBranch ?? false,
      json: opts.json ?? false,
    };
    // --delete-branch implies --cleanup
    if (doneOpts.deleteBranch && !doneOpts.cleanup) {
      doneOpts.cleanup = true;
    }
    return wrap(() => cmdDone(taskId, doneOpts))();
  });

program
  .command("sync")
  .description("Sync with external issue tracker")
  .action(wrap(cmdSync));

program
  .command("list")
  .description("List and filter tasks")
  .option("--status <status>", "Filter by status (e.g., Ready, In Progress, Done)")
  .option("--priority <priority>", "Filter by priority (P0, P1, P2, P3)")
  .option("--type <type>", "Filter by task type (Task, Bug, Feature, etc.)")
  .option("--search <query>", "Filter by text search in ID or body")
  .option("--json", "Output results as JSON")
  .action((opts: { status?: string; priority?: string; type?: string; search?: string; json?: boolean }) => {
    const listOpts: ListOptions = {
      status: opts.status,
      priority: opts.priority,
      type: opts.type,
      search: opts.search,
      json: opts.json ?? false,
    };
    return wrap(() => cmdList(listOpts))();
  });

program
  .command("unlock <taskId>")
  .description("Manually unlock a task (requires --force)")
  .option("--force", "Force unlock the task")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { force?: boolean; json?: boolean }) => {
    const unlockOpts: UnlockOptions = { force: opts.force ?? false, json: opts.json ?? false };
    return wrap(() => cmdUnlock(taskId, unlockOpts))();
  });

program
  .command("sweep")
  .description("Sweeper Protocol: recover stale in-progress tasks (claimed >4h)")
  .option("--json", "Output in JSON format")
  .option("--dry-run", "Preview what would happen without mutating state")
  .option("--force", "Skip worktree classification, reset all stale tasks")
  .action((opts: { json?: boolean; dryRun?: boolean; force?: boolean }) =>
    wrap(() => cmdSweep({ json: opts.json, dryRun: opts.dryRun, force: opts.force }))());

program
  .command("heartbeat <taskId>")
  .description("Extend the lease on an In Progress task by updating claimed_at")
  .option("--force", "Skip ownership verification")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { force?: boolean; json?: boolean }) => {
    const hbOpts: HeartbeatOptions = { force: opts.force ?? false, json: opts.json ?? false };
    return wrap(() => cmdHeartbeat(taskId, hbOpts))();
  });

program
  .command("inspect <taskId>")
  .description("Inspect task worktree and branch state")
  .option("--all", "Inspect all In Progress tasks")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { all?: boolean; json?: boolean }) => {
    const inspectOpts: InspectOptions = { all: opts.all ?? false, json: opts.json ?? false };
    return wrap(() => cmdInspect(taskId, inspectOpts))();
  });

program
  .command("claim <taskId>")
  .description("Claim a task (set assignee and claimed_at) without creating a worktree")
  .option("--force", "Override an existing claim")
  .option("--session <id>", "Use a specific session ID instead of generating one")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { force?: boolean; session?: string; json?: boolean }) => {
    const claimOpts: ClaimOptions = {
      force: opts.force ?? false,
      session: opts.session,
      json: opts.json ?? false,
    };
    return wrap(() => cmdClaim(taskId, claimOpts))();
  });

program
  .command("report <taskId>")
  .description("Generate a structured completion report")
  .option("--complete", "Transition task to Review after generating report")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { complete?: boolean; json?: boolean }) => {
    const reportOpts: ReportOptions = { complete: opts.complete ?? false, json: opts.json ?? false };
    return wrap(() => cmdReport(taskId, reportOpts))();
  });

program
  .command("cleanup <taskId>")
  .description("Remove task worktree and branch with safety checks")
  .option("--dry-run", "Preview what would be removed without mutating")
  .option("--apply", "Execute cleanup (fails if unsafe)")
  .option("--force", "Skip all safety checks")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { dryRun?: boolean; apply?: boolean; force?: boolean; json?: boolean }) => {
    const cleanupOpts: CleanupOptions = {
      dryRun: opts.dryRun ?? false,
      apply: opts.apply ?? false,
      force: opts.force ?? false,
      json: opts.json ?? false,
    };
    return wrap(() => cmdCleanup(taskId, cleanupOpts))();
  });

program
  .command("new <title>")
  .description("Create a new task file with auto-incremented ID")
  .option("--type <type>", "Task type (Task, Feature, Bug, etc.)", "Task")
  .option("--priority <p>", "Priority (P0-P3)", "P2")
  .option("--agent-role <role>", "Agent role", "Implementer")
  .option("--status <status>", "Initial status (Ready, Inbox, etc.)", "Ready")
  .option("--body <text>", "Additional body text")
  .option("--json", "Output in JSON format")
  .action((title: string, opts: { type?: string; priority?: string; agentRole?: string; status?: string; body?: string; json?: boolean }) => {
    const newOpts: NewOptions = {
      type: opts.type,
      priority: opts.priority,
      agentRole: opts.agentRole,
      status: opts.status,
      body: opts.body,
      json: opts.json ?? false,
    };
    return wrap(() => cmdNew(title, newOpts))();
  });

// Dependency Steward commands
const deps = program.command("deps").description("Dependency health management");

deps
  .command("scan")
  .description("Run broad dependency health checks")
  .action(wrap(cmdDepsScan));

deps
  .command("audit")
  .description("Run package-manager-native audit")
  .option("--severity <level>", "Filter by severity level (critical, high, medium, low, info)")
  .option("--create-tasks", "Automatically create tasks for found vulnerabilities")
  .action((opts) => wrap(() => cmdDepsAudit(opts.severity, opts.createTasks ?? false))());

deps
  .command("outdated")
  .description("Report outdated direct dependencies")
  .action(wrap(cmdDepsOutdated));

deps
  .command("deprecated")
  .description("Check for deprecated packages")
  .action(wrap(cmdDepsDeprecated));

deps
  .command("plan")
  .description("Produce a dependency remediation plan")
  .action(wrap(cmdDepsPlan));

deps
  .command("create-tasks")
  .description("Create TaskForge dependency tasks from findings")
  .action(wrap(cmdDepsCreateTasks));

deps
  .command("pr")
  .description("Create focused dependency update PRs for low-risk cases")
  .action(wrap(cmdDepsPr));

deps
  .command("summary")
  .description("Produce a dependency health summary")
  .action(wrap(cmdDepsSummary));

function wrap(fn: () => Promise<unknown>): () => Promise<void> {
  return async () => {
    try {
      await fn();
    } catch (err) {
      if (err instanceof TaskForgeError) {
        logError(err.message);
        process.exit(err.exitCode);
      }
      logError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  };
}

program
  .command("prompt <taskId>")
  .description("Emit a complete agent execution packet")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { json?: boolean }) => wrap(() => cmdPrompt(taskId, opts))());

program
  .command("resume <taskId>")
  .description("Re-enter an existing task workspace")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { json?: boolean }) => wrap(() => cmdResume(taskId, opts))());

program
  .command("doctor")
  .description("Run diagnostic checks on repo and task-state health")
  .option("--json", "Output in JSON format")
  .action((opts: { json?: boolean }) => wrap(() => cmdDoctor(opts))());

program
  .command("config-validate")
  .description("Validate .taskforge/config.json")
  .option("--json", "Output in JSON format")
  .action((opts: { json?: boolean }) => wrap(() => cmdConfigValidate(opts))());

program
  .command("release <taskId>")
  .description("Voluntarily release a task claim and reset to Ready")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { json?: boolean }) => {
    const releaseOpts: ReleaseOptions = { json: opts.json ?? false };
    return wrap(() => cmdRelease(taskId, releaseOpts))();
  });

program
  .command("validate-state")
  .description("Validate task-state for invariant violations")
  .option("--json", "Output in JSON format")
  .option("--strict", "Treat warnings as errors")
  .action((opts: { json?: boolean; strict?: boolean }) => wrap(() => cmdValidateState(opts))());

program.parse();
