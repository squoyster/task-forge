import { loadAllTasks } from "../core/task-store.js";
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

function buildJson(tasks: ReturnType<typeof loadAllTasks>): StatusJson {
  const byStatus: Record<string, number> = {};
  const taskEntries: StatusJson["tasks"] = [];

  for (const t of tasks) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    const r = makeRow(t);
    taskEntries.push({ id: r.id, title: r.title, priority: r.priority, status: t.status });
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

  printTable("Active Work", active.map(makeRow));
  printTable("Blocked", blocked.map(makeRow));
  printTable("Ready Next", ready.map(makeRow));

  logHeader("## In Review");
  logDivider();
  if (review.length === 0 && verify.length === 0) {
    logSub("None");
  } else {
    for (const t of review) {
      const r = makeRow(t);
      logSub(`- **${r.id}**: ${r.title} (Priority: ${r.priority}) [Review]`);
    }
    for (const t of verify) {
      const r = makeRow(t);
      logSub(`- **${r.id}**: ${r.title} (Priority: ${r.priority}) [Verify]`);
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
  logSub(`- **Ready:** ${ready.length}`);
  logSub(`- **Done:** ${done.length}`);
}