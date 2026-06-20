#!/usr/bin/env node
import { Command } from "commander";
import { cmdInit } from "./commands/init.js";
import { cmdNext } from "./commands/next.js";
import { cmdStart, type StartOptions } from "./commands/start.js";
import { cmdStatus } from "./commands/status.js";
import { cmdSummary } from "./commands/summary.js";
import { cmdGates, type GatesOptions } from "./commands/gates.js";
import { cmdHook, type HookOptions } from "./commands/hook.js";
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
import { cmdUpdate, type UpdateOptions } from "./commands/update.js";
import { cmdResume } from "./commands/resume.js";
import { cmdDoctor } from "./commands/doctor.js";
import { cmdConfigValidate } from "./commands/config-validate.js";
import { cmdRelease, type ReleaseOptions } from "./commands/release.js";
import { cmdReject } from "./commands/reject.js";
import { cmdList, type ListOptions } from "./commands/list.js";
import { cmdSync } from "./commands/sync.js";
import { cmdAgents, type AgentsOptions } from "./commands/agents.js";
import { cmdDepsScan } from "./commands/deps/scan.js";
import { cmdDepsAudit } from "./commands/deps/audit-cmd.js";
import { cmdDepsOutdated } from "./commands/deps/outdated-cmd.js";
import { cmdDepsDeprecated } from "./commands/deps/deprecated-cmd.js";
import { cmdDepsPlan } from "./commands/deps/plan.js";
import { cmdDepsCreateTasks } from "./commands/deps/create-tasks.js";
import { cmdDepsPr } from "./commands/deps/pr.js";
import { cmdDepsSummary } from "./commands/deps/summary.js";
import { cmdAudit, cmdTranscript, cmdTimeline } from "./commands/audit.js";
import { cmdAcCheck } from "./commands/ac-check.js";
import { cmdPromote, type PromoteOptions } from "./commands/promote.js";
import { cmdGuardStatus, cmdGuardOverride } from "./commands/guard-cmd.js";
import { cmdMcp } from "./commands/mcp.js";
import { TaskForgeError } from "./core/errors.js";
import { logError } from "./util/logging.js";
import { recordCliInvocation } from "./core/cli-audit.js";
import { getRepoRoot } from "./util/paths.js";

const program = new Command();

program
  .name("taskforge")
  .description("TaskForge Autonomous Coding Board CLI")
  .version("0.3.0");

program
  .command("init")
  .description("Initialize TaskForge in this repository")
  .option("--force", "Recreate missing configuration files and templates")
  .option("--agent-framework <id>", "Agent framework: opencode, generic, auto, or none")
  .option("--policy <level>", "Policy: permissive, managed, or locked-down")
  .option("--install-hooks", "Install git hooks")
  .option("--no-install-hooks", "Skip git hooks")
  .option("--audit", "Enable audit plugin")
  .option("--no-audit", "Disable audit plugin")
  .option("--guard", "Enable guard plugin")
  .option("--no-guard", "Disable guard plugin")
  .option("--dry-run", "Show planned changes without writing")
  .option("--repair", "Repair missing or stale generated files")
  .action((opts: Record<string, unknown>) => {
    wrapWithAudit("init", [], opts, () =>
      cmdInit({
        force: opts.force as boolean | undefined,
        agentFramework: opts.agentFramework as string | undefined,
        policy: opts.policy as "permissive" | "managed" | "locked-down" | undefined,
        installHooks: opts.installHooks as boolean | undefined,
        audit: opts.audit as boolean | undefined,
        guard: opts.guard as boolean | undefined,
        dryRun: opts.dryRun as boolean | undefined,
        repair: opts.repair as boolean | undefined,
      }),
    )();
  });

program
  .command("next")
  .description("Return the highest-priority safe task to continue")
  .option("--json", "Output in JSON format")
  .action((opts: { json?: boolean }) => wrapWithAudit("next", [], opts, () => cmdNext(opts))());

program
  .command("start <taskId>")
  .description("Set up worktree, branch, and begin a task")
  .option("--force", "Override stale lock if task is locked by another session")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { force?: boolean; json?: boolean }) => {
    const startOpts: StartOptions = { force: opts.force ?? false, json: opts.json ?? false };
    return wrapWithAudit("start", [taskId], opts, () => cmdStart(taskId, startOpts))();
  });

program
  .command("status")
  .description("Show project status summary")
  .option("--json", "Output in JSON format for programmatic consumption")
  .action((opts) => wrapWithAudit("status", [], opts, () => cmdStatus(opts.json ?? false))());

program
  .command("summary")
  .description("Show full project summary with recommended next action")
  .option("--json", "Output in JSON format for programmatic consumption")
  .action((opts) => wrapWithAudit("summary", [], opts, () => cmdSummary(opts.json ?? false))());

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
    return wrapWithAudit("gates", [], opts, () => cmdGates(gateOpts))();
  });

program
  .command("block <taskId> <reason>")
  .description("Mark a task as blocked with a reason")
  .option("--category <cat>", "Blocker category: human_decision, test_failure, merge_conflict, missing_secret, unsafe_operation, ambiguous_spec")
  .option("--blocked-by <who>", "Who/what is blocking: human, agent, bot")
  .option("--json", "Output in JSON format")
  .action((taskId: string, reason: string, opts: { json?: boolean; category?: string; blockedBy?: string }) => {
    return wrapWithAudit("block", [taskId, reason], opts, () => cmdBlock(taskId, reason, {
      json: opts.json ?? false,
      category: opts.category,
      blockedBy: opts.blockedBy,
    }))();
  });

program
  .command("done <taskId>")
  .description("Mark a task as done")
  .option("--cleanup", "Remove worktree after marking done")
  .option("--delete-branch", "Delete the task branch after marking done (implies --cleanup)")
  .option("--force", "Bypass gate checks (human/doctor only)")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { cleanup?: boolean; deleteBranch?: boolean; force?: boolean; json?: boolean }) => {
    const doneOpts: DoneOptions = {
      cleanup: opts.cleanup ?? false,
      deleteBranch: opts.deleteBranch ?? false,
      force: opts.force ?? false,
      json: opts.json ?? false,
    };
    if (doneOpts.deleteBranch && !doneOpts.cleanup) doneOpts.cleanup = true;
    return wrapWithAudit("done", [taskId], opts, () => cmdDone(taskId, doneOpts))();
  });

if (process.env.TASKFORGE_WITH_DEPS) {
  program
    .command("sync")
    .description("Sync with external issue tracker (opt-in: TASKFORGE_WITH_DEPS)")
    .action(wrapWithAudit("sync", [], {}, cmdSync));
}

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
    return wrapWithAudit("list", [], opts, () => cmdList(listOpts))();
  });

program
  .command("promote <taskId>")
  .description("Advance a task through the status state machine")
  .option("--to <status>", "Target status to promote to")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { to?: string; json?: boolean }) => {
    const promoteOpts: PromoteOptions = { to: opts.to, json: opts.json ?? false };
    return wrapWithAudit("promote", [taskId], opts, () => cmdPromote(taskId, promoteOpts))();
  });

program
  .command("unlock <taskId>")
  .description("Manually unlock a task (requires --force)")
  .option("--force", "Force unlock the task")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { force?: boolean; json?: boolean }) => {
    const unlockOpts: UnlockOptions = { force: opts.force ?? false, json: opts.json ?? false };
    return wrapWithAudit("unlock", [taskId], opts, () => cmdUnlock(taskId, unlockOpts))();
  });

program
  .command("sweep")
  .description("Sweeper Protocol: recover stale in-progress tasks (claimed past sweep.staleThresholdMinutes, default 15m)")
  .option("--json", "Output in JSON format")
  .option("--dry-run", "Preview what would happen without mutating state")
  .option("--force", "Skip worktree classification, reset all stale tasks (requires human/doctor authority)")
  .option("--reclaim", "Reclaim stale-claimed tasks back to Ready (re-assignable), skipping review classification")
  .action((opts: { json?: boolean; dryRun?: boolean; force?: boolean; reclaim?: boolean }) =>
    wrapWithAudit("sweep", [], opts, () => cmdSweep({ json: opts.json, dryRun: opts.dryRun, force: opts.force, reclaim: opts.reclaim }))());

program
  .command("heartbeat <taskId>")
  .description("Extend the lease on an In Progress task by updating claimed_at")
  .option("--force", "Skip ownership verification")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { force?: boolean; json?: boolean }) => {
    const hbOpts: HeartbeatOptions = { force: opts.force ?? false, json: opts.json ?? false };
    return wrapWithAudit("heartbeat", [taskId], opts, () => cmdHeartbeat(taskId, hbOpts))();
  });

program
  .command("agents")
  .description("List active agents in the distributed registry")
  .option("--json", "Output in JSON format")
  .option("--stale", "Show only stale agents (no heartbeat within threshold)")
  .option("--recover", "Mark stale agents as crashed")
  .option("--threshold <minutes>", "Stale threshold in minutes", "15")
  .action((opts: { json?: boolean; stale?: boolean; recover?: boolean; threshold?: string }) => {
    const agentsOpts: AgentsOptions = {
      json: opts.json ?? false,
      stale: opts.stale ?? false,
      recover: opts.recover ?? false,
      threshold: parseInt(opts.threshold ?? "15", 10),
    };
    return wrapWithAudit("agents", [], opts, () => cmdAgents(agentsOpts))();
  });

program
  .command("inspect <taskId>")
  .description("Inspect task worktree and branch state")
  .option("--all", "Inspect all In Progress tasks")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { all?: boolean; json?: boolean }) => {
    const inspectOpts: InspectOptions = { all: opts.all ?? false, json: opts.json ?? false };
    return wrapWithAudit("inspect", [taskId], opts, () => cmdInspect(taskId, inspectOpts))();
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
    return wrapWithAudit("claim", [taskId], opts, () => cmdClaim(taskId, claimOpts))();
  });

program
  .command("report <taskId>")
  .description("Generate a structured completion report")
  .option("--complete", "Transition task to Review after generating report")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { complete?: boolean; json?: boolean }) => {
    const reportOpts: ReportOptions = { complete: opts.complete ?? false, json: opts.json ?? false };
    return wrapWithAudit("report", [taskId], opts, () => cmdReport(taskId, reportOpts))();
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
    return wrapWithAudit("cleanup", [taskId], opts, () => cmdCleanup(taskId, cleanupOpts))();
  });

program
  .command("new [title]")
  .description("Create a new task file with auto-incremented ID")
  .option("--type <type>", "Task type (Task, Feature, Bug, etc.)", "Task")
  .option("--priority <p>", "Priority (P0-P3)", "P2")
  .option("--agent-role <role>", "Agent role", "Implementer")
  .option("--status <status>", "Initial status (Ready, Inbox, etc.)", "Ready")
  .option("--from-file <path>", "Create task from a markdown file")
  .option("--body <text>", "Additional body text")
  .option("--goal <text>", "Goal section content")
  .option("--background <text>", "Background section content")
  .option("--scope <text>", "Scope section content")
  .option("--acceptance-criteria <text>", "Acceptance Criteria section content")
  .option("--test-command <text>", "Test / Verification Command section content")
  .option("--expected-output <text>", "Expected Output / Behavior section content")
  .option("--dependencies <text>", "Dependencies section content")
  .option("--risks <text>", "Risks section content")
  .option("--continuation-policy <text>", "Continuation Policy section content")
  .option("--json", "Output in JSON format")
  .action((title: string | undefined, opts: {
    type?: string;
    priority?: string;
    agentRole?: string;
    status?: string;
    fromFile?: string;
    body?: string;
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
  }) => {
    const newOpts: NewOptions = {
      type: opts.type,
      priority: opts.priority,
      agentRole: opts.agentRole,
      status: opts.status,
      fromFile: opts.fromFile,
      body: opts.body,
      goal: opts.goal,
      background: opts.background,
      scope: opts.scope,
      acceptanceCriteria: opts.acceptanceCriteria,
      testCommand: opts.testCommand,
      expectedOutput: opts.expectedOutput,
      dependencies: opts.dependencies,
      risks: opts.risks,
      continuationPolicy: opts.continuationPolicy,
      json: opts.json ?? false,
    };
    return wrapWithAudit("new", title ? [title] : [], opts, () => cmdNew(title, newOpts))();
  });

program
  .command("update <taskId>")
  .description("Update editable task spec fields without mutating workflow-owned state")
  .option("--from-file <path>", "Patch the task from a markdown file")
  .option("--title <text>", "Update the task title")
  .option("--type <type>", "Update task type")
  .option("--priority <p>", "Update task priority")
  .option("--agent-role <role>", "Update agent role")
  .option("--risk-level <level>", "Update risk level")
  .option("--human-intervention-required", "Set human intervention required to true")
  .option("--no-human-intervention-required", "Set human intervention required to false")
  .option("--depends-on <taskId>", "Add a dependency", collectRepeatedOptions, [])
  .option("--goal <text>", "Update Goal section content")
  .option("--background <text>", "Update Background section content")
  .option("--scope <text>", "Update Scope section content")
  .option("--acceptance-criteria <text>", "Update Acceptance Criteria section content")
  .option("--test-command <text>", "Update Test / Verification Command section content")
  .option("--expected-output <text>", "Update Expected Output / Behavior section content")
  .option("--dependencies <text>", "Update Dependencies section content")
  .option("--risks <text>", "Update Risks section content")
  .option("--continuation-policy <text>", "Update Continuation Policy section content")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: {
    fromFile?: string;
    title?: string;
    type?: string;
    priority?: string;
    agentRole?: string;
    riskLevel?: string;
    humanInterventionRequired?: boolean;
    dependsOn?: string[];
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
  }) => {
    const updateOpts: UpdateOptions = {
      fromFile: opts.fromFile,
      title: opts.title,
      type: opts.type,
      priority: opts.priority,
      agentRole: opts.agentRole,
      riskLevel: opts.riskLevel,
      humanInterventionRequired: opts.humanInterventionRequired,
      dependsOn: opts.dependsOn?.length ? opts.dependsOn : undefined,
      goal: opts.goal,
      background: opts.background,
      scope: opts.scope,
      acceptanceCriteria: opts.acceptanceCriteria,
      testCommand: opts.testCommand,
      expectedOutput: opts.expectedOutput,
      dependencies: opts.dependencies,
      risks: opts.risks,
      continuationPolicy: opts.continuationPolicy,
      json: opts.json ?? false,
    };
    return wrapWithAudit("update", [taskId], opts, () => cmdUpdate(taskId, updateOpts))();
  });

// Dependency Steward commands (opt-in via TASKFORGE_WITH_DEPS; not registered by default)
if (process.env.TASKFORGE_WITH_DEPS) {
const deps = program.command("deps").description("Dependency health management");

deps
  .command("scan")
  .description("Run broad dependency health checks")
  .action(wrapWithAudit("deps scan", [], {}, cmdDepsScan));

deps
  .command("audit")
  .description("Run package-manager-native audit")
  .option("--severity <level>", "Filter by severity level (critical, high, medium, low, info)")
  .option("--create-tasks", "Automatically create tasks for found vulnerabilities")
  .action((opts) => wrapWithAudit("deps audit", [], opts, () => cmdDepsAudit(opts.severity, opts.createTasks ?? false))());

deps
  .command("outdated")
  .description("Report outdated direct dependencies")
  .action(wrapWithAudit("deps outdated", [], {}, cmdDepsOutdated));

deps
  .command("deprecated")
  .description("Check for deprecated packages")
  .action(wrapWithAudit("deps deprecated", [], {}, cmdDepsDeprecated));

deps
  .command("plan")
  .description("Produce a dependency remediation plan")
  .action(wrapWithAudit("deps plan", [], {}, cmdDepsPlan));

deps
  .command("create-tasks")
  .description("Create TaskForge dependency tasks from findings")
  .action(wrapWithAudit("deps create-tasks", [], {}, cmdDepsCreateTasks));

deps
  .command("pr")
  .description("Create focused dependency update PRs for low-risk cases")
  .action(wrapWithAudit("deps pr", [], {}, cmdDepsPr));

deps
  .command("summary")
  .description("Produce a dependency health summary")
  .action(wrapWithAudit("deps summary", [], {}, cmdDepsSummary));
}

/**
 * Wrap a command action with CLI invocation audit capture.
 * Records command name, args, flags, exit code, duration, and session ID.
 */
function wrapWithAudit(
  commandName: string,
  args: string[],
  flags: Record<string, unknown>,
  fn: () => Promise<unknown>,
): () => Promise<void> {
  return async () => {
    const startTime = Date.now();
    let exitCode = 0;
    let error: string | null = null;

    try {
      await fn();
    } catch (err) {
      if (err instanceof TaskForgeError) {
        exitCode = err.exitCode;
        error = err.message;
        logError(err.message);
      } else {
        exitCode = 1;
        error = err instanceof Error ? err.message : String(err);
        logError(`Unexpected error: ${error}`);
      }

      // Record the invocation before exiting
      try {
        const repoRoot = getRepoRoot();
        recordCliInvocation(repoRoot, commandName, args, flags, exitCode, Date.now() - startTime, error);
      } catch {
        // Don't let audit failure prevent exit
      }

      process.exit(exitCode);
    }

    // Record successful invocation
    try {
      const repoRoot = getRepoRoot();
      recordCliInvocation(repoRoot, commandName, args, flags, 0, Date.now() - startTime, null);
    } catch {
      // Don't let audit failure prevent normal operation
    }
  };
}

function collectRepeatedOptions(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

program
  .command("prompt <taskId>")
  .description("Emit a complete agent execution packet")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { json?: boolean }) => wrapWithAudit("prompt", [taskId], opts, () => cmdPrompt(taskId, opts))());

program
  .command("resume <taskId>")
  .description("Re-enter an existing task workspace")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { json?: boolean }) => wrapWithAudit("resume", [taskId], opts, () => cmdResume(taskId, opts))());

program
  .command("doctor")
  .description("Run diagnostic checks on repo and task-state health")
  .option("--check", "Run diagnostics only (alias for default behavior)")
  .option("--fix", "Apply doctor-mode automatic repairs")
  .option("--lock", "Acquire doctor lock for recovery")
  .option("--reason <text>", "Reason for doctor lock")
  .option("--ttl-hours <hours>", "Doctor lock TTL in hours", (value) => Number(value))
  .option("--json", "Output in JSON format")
  .action((opts: { json?: boolean; check?: boolean; fix?: boolean; lock?: boolean; reason?: string; ttlHours?: number }) => wrapWithAudit("doctor", [], opts, () => cmdDoctor(opts))());

program
  .command("config-validate")
  .description("Validate .taskforge/config.json")
  .option("--json", "Output in JSON format")
  .action((opts: { json?: boolean }) => wrapWithAudit("config-validate", [], opts, () => cmdConfigValidate(opts))());

program
  .command("release <taskId>")
  .description("Voluntarily release a task claim and reset to Ready")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { json?: boolean }) => {
    const releaseOpts: ReleaseOptions = { json: opts.json ?? false };
    return wrapWithAudit("release", [taskId], opts, () => cmdRelease(taskId, releaseOpts))();
  });

program
  .command("reject <taskId> <reason>")
  .description("Mark a task as rejected (obsolete, won't implement)")
  .option("--json", "Output in JSON format")
  .action((taskId: string, reason: string, opts: { json?: boolean }) =>
    wrapWithAudit("reject", [taskId, reason], opts, () => cmdReject(taskId, reason, opts))());

program
  .command("validate-state")
  .description("Validate task-state for invariant violations")
  .option("--json", "Output in JSON format")
  .option("--strict", "Exit with non-zero status on any warnings or errors (for CI)")
  .action((opts: { json?: boolean; strict?: boolean }) =>
    wrapWithAudit("validate-state", [], opts, async () => {
      const { cmdValidateState } = await import("./commands/validate-state.js");
      await cmdValidateState(opts);
    })(),
  );

program
  .command("audit <taskId>")
  .description("Show audit events for a task")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { json?: boolean }) =>
    wrapWithAudit("audit", [taskId], opts, async () => { cmdAudit(taskId, opts); })(),
  );

program
  .command("transcript <taskId>")
  .description("Show readable transcript for a task")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { json?: boolean }) =>
    wrapWithAudit("transcript", [taskId], opts, async () => { cmdTranscript(taskId, opts); })(),
  );

program
  .command("timeline <taskId>")
  .description("Show event timeline summary for a task")
  .option("--json", "Output in JSON format")
  .action((taskId: string, opts: { json?: boolean }) =>
    wrapWithAudit("timeline", [taskId], opts, async () => { cmdTimeline(taskId, opts); })(),
  );

program
  .command("ac-check [taskId]")
  .description("Scan task files for acceptance criteria issues")
  .option("--json", "Output in JSON format")
  .action((taskId: string | undefined, opts: { json?: boolean }) =>
    wrapWithAudit("ac-check", taskId ? [taskId] : [], opts, async () => { cmdAcCheck(taskId, opts); })(),
  );

program
  .command("mcp")
  .description("Start a Model Context Protocol (MCP) server for TaskForge")
  .option("--config <path>", "Path to config directory")
  .option("--json", "Output in JSON format")
  .action((opts: { config?: string; json?: boolean }) =>
    wrapWithAudit("mcp", [], opts, async () => { await cmdMcp({ config: opts.config, json: opts.json }); })(),
  );

const guard = program.command("guard").description("Manage the mutation boundary");

guard
  .command("status")
  .description("Show mutation boundary enforcement status")
  .option("--json", "Output in JSON format")
  .action((opts: { json?: boolean }) =>
    wrapWithAudit("guard:status", [], opts, () => cmdGuardStatus(opts))(),
  );

guard
  .command("override <taskId> <command> <reason>")
  .description("(doctor only) Issue a time-limited mutation override")
  .option("--json", "Output in JSON format")
  .action((taskId: string, command: string, reason: string, opts: { json?: boolean }) =>
    wrapWithAudit("guard:override", [taskId], opts, () => cmdGuardOverride(taskId, command, reason, opts))(),
  );

program
  .command("_hook <name>", { hidden: true })
  .description("Run hook logic in TypeScript (internal, used by git hooks)")
  .option("--json", "Output in JSON format")
  .action((name: string, opts: { json?: boolean }) => {
    const hookOpts: HookOptions = { json: opts.json ?? false };
    return wrapWithAudit("_hook", [], opts, () => cmdHook(name, hookOpts))();
  });

program.parse();
