#!/usr/bin/env node
import { Command } from "commander";
import { cmdInit } from "./commands/init.js";
import { cmdNext } from "./commands/next.js";
import { cmdStart } from "./commands/start.js";
import { cmdStatus } from "./commands/status.js";
import { cmdSummary } from "./commands/summary.js";
import { cmdBlock } from "./commands/block.js";
import { cmdDone } from "./commands/done.js";
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
  .action(wrap(cmdNext));

program
  .command("start <taskId>")
  .description("Set up worktree, branch, and begin a task")
  .action((taskId: string) => wrap(() => cmdStart(taskId))());

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
  .command("block <taskId> <reason>")
  .description("Mark a task as blocked with a reason")
  .action((taskId: string, reason: string) => wrap(() => cmdBlock(taskId, reason))());

program
  .command("done <taskId>")
  .description("Mark a task as done")
  .option("--force", "Force transition to Done even if not allowed")
  .action((taskId: string, opts: { force?: boolean }) => wrap(() => cmdDone(taskId, opts.force ?? false))());

program
  .command("sync")
  .description("Sync with external issue tracker")
  .action(wrap(cmdSync));

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

function wrap<T extends () => Promise<void>>(fn: T): () => Promise<void> {
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

program.parse();
