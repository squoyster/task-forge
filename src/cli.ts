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

const program = new Command();

program
  .name("taskforge")
  .description("TaskForge Autonomous Coding Board CLI")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize TaskForge in this repository")
  .action(cmdInit);

program
  .command("next")
  .description("Return the highest-priority safe task to continue")
  .action(cmdNext);

program
  .command("start <taskId>")
  .description("Set up worktree, branch, and begin a task")
  .action(cmdStart);

program
  .command("status")
  .description("Show project status summary")
  .action(cmdStatus);

program
  .command("summary")
  .description("Show full project summary with recommended next action")
  .action(cmdSummary);

program
  .command("block <taskId> <reason>")
  .description("Mark a task as blocked with a reason")
  .action(cmdBlock);

program
  .command("done <taskId>")
  .description("Mark a task as done")
  .option("--force", "Force transition to Done even if not allowed")
  .action((taskId, opts) => cmdDone(taskId, opts.force));

program
  .command("sync")
  .description("Sync task files with external issue tracker")
  .action(cmdSync);

// Dependency Steward commands
const deps = program.command("deps").description("Dependency health management");

deps
  .command("scan")
  .description("Run broad dependency health checks")
  .action(cmdDepsScan);

deps
  .command("audit")
  .description("Run package-manager-native audit")
  .action(cmdDepsAudit);

deps
  .command("outdated")
  .description("Report outdated direct dependencies")
  .action(cmdDepsOutdated);

deps
  .command("deprecated")
  .description("Check for deprecated packages")
  .action(cmdDepsDeprecated);

deps
  .command("plan")
  .description("Produce a dependency remediation plan")
  .action(cmdDepsPlan);

deps
  .command("create-tasks")
  .description("Create TaskForge dependency tasks from findings")
  .action(cmdDepsCreateTasks);

deps
  .command("pr")
  .description("Create focused dependency update PRs for low-risk cases")
  .action(cmdDepsPr);

deps
  .command("summary")
  .description("Produce a dependency health summary")
  .action(cmdDepsSummary);

program.parse();
