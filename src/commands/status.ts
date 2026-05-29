import { loadAllTasks } from "../core/task-store.js";
import { hasUnmetDependencies, getDependents } from "../core/scheduler.js";
import { STATUS } from "../util/status-constants.js";
import { logHeader, logSub, logDivider, logInfo } from "../util/logging.js";
import { successResult, noopResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultMarkdown, renderResultJson } from "../core/result-renderer.js";

interface StatusRow {
  id: string;
  title: string;
  priority: string;
  extra?: string;
  worktree?: string;
  branch?: string;
}

interface StatusJson {
  total: number;
  byStatus: Record<string, number>;
  tasks: {
    id: string;
    title: string;
    priority: string;
    status: string;
    dependsOn?: string[];
    blockedBy?: string[];
    blockedDependents?: string[];
    worktree?: string;
    branch?: string;
  }[];
}

function printTable(
  header: string,
  rows: StatusRow[],
): void {
  logHeader(`## ${header}`);
  logDivider();
  if (rows.length === 0) {
    logSub("None");
  } else {
    for (const row of rows) {
      const extra = row.extra ? ` [${row.extra}]` : "";
      const workspace = row.worktree ? ` [Worktree: ${row.worktree}]` : "";
      const branch = row.branch ? ` [Branch: ${row.branch}]` : "";
      logSub(`- **${row.id}**: ${row.title} (Priority: ${row.priority})${extra}${workspace}${branch}`);
    }
  }
  logDivider();
}

function makeRow(t: { id: string; priority: string; body: string; worktree?: string; branch?: string }): StatusRow {
  const titleMatch = t.body.match(/^#\s+\S+:\s+(.+)$/m);
  return {
    id: t.id,
    title: titleMatch ? titleMatch[1] : t.id,
    priority: t.priority,
    worktree: t.worktree,
    branch: t.branch,
  };
}

function makeDependencyInfo(t: ReturnType<typeof loadAllTasks>[0], allTasks: ReturnType<typeof loadAllTasks>): {
  extra?: string;
  blockedBy?: string[];
  blockedDependents?: string[];
} {
  const unmet = hasUnmetDependencies(t, allTasks);
  const dependents = getDependents(t.id, allTasks);
  const parts: string[] = [];

  if (unmet.length > 0) {
    parts.push(`Waiting on: ${unmet.join(", ")}`);
  }
  if (dependents.length > 0) {
    parts.push(`Blocks: ${dependents.map((d) => d.id).join(", ")}`);
  }

  return {
    extra: parts.length > 0 ? parts.join(" | ") : undefined,
    blockedBy: unmet.length > 0 ? unmet : undefined,
    blockedDependents: dependents.length > 0 ? dependents.map((d) => d.id) : undefined,
  };
}

function buildJson(tasks: ReturnType<typeof loadAllTasks>): StatusJson {
  const byStatus: Record<string, number> = {};
  const taskEntries: StatusJson["tasks"] = [];

  for (const t of tasks) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    const r = makeRow(t);
    const depInfo = makeDependencyInfo(t, tasks);
    taskEntries.push({
      id: r.id,
      title: r.title,
      priority: r.priority,
      status: t.status,
      dependsOn: t.dependsOn,
      blockedBy: depInfo.blockedBy,
      blockedDependents: depInfo.blockedDependents,
      worktree: t.worktree ?? undefined,
      branch: t.branch ?? undefined,
    });
  }

  return { total: tasks.length, byStatus, tasks: taskEntries };
}

export async function cmdStatus(json?: boolean): Promise<void> {
  const startTime = Date.now();
  const tasks = loadAllTasks();

  if (tasks.length === 0) {
    const result = noopResult({
      command: "status",
      reason: "No task files found.",
      nextCommands: getValidNextCommands("status", "success"),
      duration: Date.now() - startTime,
    });
    if (json) {
      const jsonOutput = JSON.parse(renderResultJson(result)) as Record<string, unknown>;
      const statusData = buildJson(tasks);
      Object.assign(jsonOutput, statusData);
      console.log(JSON.stringify(jsonOutput, null, 2));
    } else {
      logInfo("No task files found.");
      process.stdout.write(renderResultMarkdown(result) + "\n");
    }
    return;
  }

  const active = tasks.filter((t) => t.status === STATUS.IN_PROGRESS);
  const blocked = tasks.filter((t) => t.status === STATUS.BLOCKED);
  const ready = tasks.filter((t) => t.status === STATUS.READY);
  const review = tasks.filter((t) => t.status === STATUS.REVIEW);
  const verify = tasks.filter((t) => t.status === STATUS.VERIFY);
  const inbox = tasks.filter((t) => t.status === STATUS.INBOX);
  const needsSpec = tasks.filter((t) => t.status === STATUS.NEEDS_SPEC);
  const done = tasks.filter((t) => t.status === STATUS.DONE);
  const humanNeeded = tasks.filter((t) => t.humanInterventionRequired);

  // Dependency-blocked tasks: actionable tasks with unmet dependencies
  const depBlocked = tasks.filter(
    (t) =>
      (t.status === STATUS.READY || t.status === STATUS.IN_PROGRESS || t.status === STATUS.REVIEW || t.status === STATUS.VERIFY) &&
      hasUnmetDependencies(t, tasks).length > 0,
  );

  if (!json) {
    logHeader("# TaskForge Status");
    logDivider();

    printTable("Active Work", active.map((t) => {
      const depInfo = makeDependencyInfo(t, tasks);
      return { ...makeRow(t), extra: depInfo.extra, worktree: t.worktree, branch: t.branch };
    }));
    printTable(STATUS.BLOCKED, blocked.map(makeRow));
    printTable("Dependency-Blocked", depBlocked.map((t) => {
      const depInfo = makeDependencyInfo(t, tasks);
      return { ...makeRow(t), extra: depInfo.extra ?? "Waiting on dependencies" };
    }));
    printTable("Ready Next", ready.filter((t) => !depBlocked.includes(t)).map(makeRow));

    logHeader("## In Review");
    logDivider();
    if (review.length === 0 && verify.length === 0) {
      logSub("None");
    } else {
      for (const t of review) {
        const r = makeRow(t);
        const depInfo = makeDependencyInfo(t, tasks);
        const extra = depInfo.extra ? ` [${depInfo.extra}]` : "";
        logSub(`- **${r.id}**: ${r.title} (Priority: ${r.priority}) [Review]${extra}`);
      }
      for (const t of verify) {
        const r = makeRow(t);
        const depInfo = makeDependencyInfo(t, tasks);
        const extra = depInfo.extra ? ` [${depInfo.extra}]` : "";
        logSub(`- **${r.id}**: ${r.title} (Priority: ${r.priority}) [Verify]${extra}`);
      }
    }
    logDivider();

    printTable(STATUS.INBOX, inbox.map(makeRow));
    printTable(STATUS.NEEDS_SPEC, needsSpec.map(makeRow));
    printTable("Completed", done.map(makeRow));

    logHeader("## Human Action Needed");
    logDivider();
    if (humanNeeded.length === 0) {
      logSub("None");
    } else {
      for (const t of humanNeeded) {
        const r = makeRow(t);
        logSub(`- **${r.id}**: ${r.title} (Priority: ${r.priority})`);
      }
    }
    logDivider();

    logHeader("## Summary");
    logDivider();
    logSub(`- **Total tasks:** ${tasks.length}`);
    logSub(`- **Active:** ${active.length}`);
    logSub(`- **Blocked:** ${blocked.length}`);
    logSub(`- **Dependency-Blocked:** ${depBlocked.length}`);
    logSub(`- **Ready:** ${ready.length - depBlocked.filter((t) => t.status === STATUS.READY).length}`);
    logSub(`- **Done:** ${done.length}`);
  }

  const result = successResult({
    command: "status",
    guidance: json ? undefined : "Status displayed above.",
    nextCommands: getValidNextCommands("status", "success"),
    duration: Date.now() - startTime,
  });

  if (json) {
    const jsonOutput = JSON.parse(renderResultJson(result)) as Record<string, unknown>;
    const statusData = buildJson(tasks);
    Object.assign(jsonOutput, statusData);
    console.log(JSON.stringify(jsonOutput, null, 2));
  } else {
    process.stdout.write(renderResultMarkdown(result) + "\n");
  }
}