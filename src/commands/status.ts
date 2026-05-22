import { loadAllTasks } from "../core/task-store.js";
import { hasUnmetDependencies, getDependents } from "../core/scheduler.js";
import { logHeader, logSub, logDivider, logInfo } from "../util/logging.js";

interface StatusRow {
  id: string;
  title: string;
  priority: string;
  extra?: string;
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
      logSub(`- **${row.id}**: ${row.title} (Priority: ${row.priority})${extra}`);
    }
  }
  logDivider();
}

function makeRow(t: { id: string; priority: string; body: string }): StatusRow {
  const titleMatch = t.body.match(/^#\s+\S+:\s+(.+)$/m);
  return {
    id: t.id,
    title: titleMatch ? titleMatch[1] : t.id,
    priority: t.priority,
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
    });
  }

  return { total: tasks.length, byStatus, tasks: taskEntries };
}

export async function cmdStatus(json?: boolean): Promise<void> {
  const tasks = loadAllTasks();

  if (json) {
    const output = buildJson(tasks);
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (tasks.length === 0) {
    logInfo("No task files found.");
    return;
  }

  logHeader("# TaskForge Status");
  logDivider();

  const active = tasks.filter((t) => t.status === "In Progress");
  const blocked = tasks.filter((t) => t.status === "Blocked");
  const ready = tasks.filter((t) => t.status === "Ready");
  const review = tasks.filter((t) => t.status === "Review");
  const verify = tasks.filter((t) => t.status === "Verify");
  const inbox = tasks.filter((t) => t.status === "Inbox");
  const needsSpec = tasks.filter((t) => t.status === "Needs Spec");
  const done = tasks.filter((t) => t.status === "Done");
  const humanNeeded = tasks.filter((t) => t.humanInterventionRequired);

  // Dependency-blocked tasks: actionable tasks with unmet dependencies
  const depBlocked = tasks.filter(
    (t) =>
      (t.status === "Ready" || t.status === "In Progress" || t.status === "Review" || t.status === "Verify") &&
      hasUnmetDependencies(t, tasks).length > 0,
  );

  printTable("Active Work", active.map((t) => {
    const depInfo = makeDependencyInfo(t, tasks);
    return { ...makeRow(t), extra: depInfo.extra };
  }));
  printTable("Blocked", blocked.map(makeRow));
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

  printTable("Inbox", inbox.map(makeRow));
  printTable("Needs Spec", needsSpec.map(makeRow));
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
  logSub(`- **Ready:** ${ready.length - depBlocked.filter((t) => t.status === "Ready").length}`);
  logSub(`- **Done:** ${done.length}`);
}
