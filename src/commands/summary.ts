import { loadAllTasks } from "../core/task-store.js";
import { selectNextTask } from "../core/scheduler.js";
import { STATUS } from "../util/status-constants.js";
import { logHeader, logSub, logDivider, logInfo } from "../util/logging.js";
import { successResult, noopResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultMarkdown, renderResultJson } from "../core/result-renderer.js";

interface SummaryJsonTask {
  id: string;
  title: string;
  priority: string;
  role: string;
  status: string;
  worktree?: string;
  branch?: string;
}

interface SummaryJson {
  generated: string;
  total: number;
  byStatus: Record<string, number>;
  nextAction: string;
  tasks: SummaryJsonTask[];
}

function makeLine(t: { id: string; priority: string; agentRole?: string; body: string; worktree?: string; branch?: string }): {
  id: string;
  title: string;
  priority: string;
  role: string;
  worktree?: string;
  branch?: string;
} {
  const titleMatch = t.body.match(/^#\s+\S+:\s+(.+)$/m);
  return {
    id: t.id,
    title: titleMatch ? titleMatch[1] : t.id,
    priority: t.priority,
    role: t.agentRole ?? "Implementer",
    worktree: t.worktree,
    branch: t.branch,
  };
}

function buildJson(tasks: ReturnType<typeof loadAllTasks>): SummaryJson {
  const now = new Date();
  const byStatus: Record<string, number> = {};
  const taskEntries: SummaryJsonTask[] = [];

  for (const t of tasks) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    const info = makeLine(t);
    taskEntries.push({ ...info, status: t.status });
  }

  const active = tasks.filter((t) => t.status === STATUS.IN_PROGRESS);
  const review = tasks.filter((t) => t.status === STATUS.REVIEW);
  const verify = tasks.filter((t) => t.status === STATUS.VERIFY);
  const needsSpec = tasks.filter((t) => t.status === STATUS.NEEDS_SPEC);
  const inbox = tasks.filter((t) => t.status === STATUS.INBOX);
  const next = selectNextTask(tasks);

  let nextAction: string;
  if (active.length > 0) {
    nextAction = "Continue existing in-progress work.";
  } else if (verify.length > 0) {
    nextAction = "Run QA/verification on tasks in Verify status.";
  } else if (review.length > 0) {
    nextAction = "Review tasks in Review status.";
  } else if (next) {
    nextAction = `Start the highest-priority task: ${next.id}`;
  } else if (needsSpec.length > 0) {
    nextAction = "Create specs for tasks in Needs Spec.";
  } else if (inbox.length > 0) {
    nextAction = "Process inbox items into structured tasks.";
  } else {
    nextAction = "No actionable tasks. Add work to the inbox.";
  }

  return {
    generated: now.toISOString().replace("T", " ").slice(0, 19),
    total: tasks.length,
    byStatus,
    nextAction,
    tasks: taskEntries,
  };
}

export async function cmdSummary(json?: boolean): Promise<void> {
  const startTime = Date.now();
  const tasks = loadAllTasks();

  if (tasks.length === 0) {
    const result = noopResult({
      command: "summary",
      reason: "No task files found.",
      nextCommands: getValidNextCommands("summary", "success"),
      duration: Date.now() - startTime,
    });
    if (json) {
      const jsonOutput = JSON.parse(renderResultJson(result)) as Record<string, unknown>;
      const summaryData = buildJson([]);
      Object.assign(jsonOutput, summaryData);
      console.log(JSON.stringify(jsonOutput, null, 2));
    } else {
      logInfo("No task files found.");
      process.stdout.write(renderResultMarkdown(result) + "\n");
    }
    return;
  }

  const now = new Date();
  if (!json) {
    logHeader("# TaskForge Summary");
    logDivider();
    logSub(`Generated: ${now.toISOString().replace("T", " ").slice(0, 19)}`);
    logDivider();
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

  const displayLine = (t: { id: string; priority: string; agentRole?: string; body: string; worktree?: string; branch?: string }) => {
    const { id, title, priority, role, worktree, branch } = makeLine(t);
    const workspace = worktree ? ` [Worktree: ${worktree}]` : "";
    const br = branch ? ` [Branch: ${branch}]` : "";
    return `- **${id}**: ${title} (Priority: ${priority}, Role: ${role})${workspace}${br}`;
  };

  if (!json) {
    logHeader("## Active Work");
    logDivider();
    if (active.length === 0) logSub("None");
    else active.forEach((t) => logSub(displayLine(t)));
    logDivider();

    logHeader("## Blocked");
    logDivider();
    if (blocked.length === 0) logSub("None");
    else blocked.forEach((t) => logSub(displayLine(t)));
    logDivider();

    logHeader("## Ready Next");
    logDivider();
    if (ready.length === 0) logSub("None");
    else ready.forEach((t) => logSub(displayLine(t)));
    logDivider();

    logHeader("## In Review");
    logDivider();
    if (review.length === 0 && verify.length === 0) {
      logSub("None");
    } else {
      review.forEach((t) => logSub(`${displayLine(t)} [Review]`));
      verify.forEach((t) => logSub(`${displayLine(t)} [Verify]`));
    }
    logDivider();

    logHeader("## Completed");
    logDivider();
    if (done.length === 0) logSub("None");
    else done.forEach((t) => logSub(displayLine(t)));
    logDivider();

    logHeader("## Inbox");
    logDivider();
    if (inbox.length === 0) logSub("None");
    else inbox.forEach((t) => logSub(displayLine(t)));
    logDivider();

    logHeader("## Needs Spec");
    logDivider();
    if (needsSpec.length === 0) logSub("None");
    else needsSpec.forEach((t) => logSub(displayLine(t)));
    logDivider();

    logHeader("## Human Action Needed");
    logDivider();
    if (humanNeeded.length === 0) logSub("None");
    else humanNeeded.forEach((t) => logSub(displayLine(t)));
    logDivider();
  }

  // Recommended next action
  const next = selectNextTask(tasks);
  let guidance: string;
  if (active.length > 0) {
    guidance = "Continue existing in-progress work.";
  } else if (verify.length > 0) {
    guidance = "Run QA/verification on tasks in Verify status.";
  } else if (review.length > 0) {
    guidance = "Review tasks in Review status.";
  } else if (next) {
    guidance = `Start the highest-priority task: ${next.id}`;
  } else if (needsSpec.length > 0) {
    guidance = "Create specs for tasks in Needs Spec.";
  } else if (inbox.length > 0) {
    guidance = "Process inbox items into structured tasks.";
  } else {
    guidance = "No actionable tasks. Add work to the inbox.";
  }

  if (!json) {
    logHeader("## Recommended Next Action");
    logDivider();
    logSub(guidance);
    logDivider();

    logHeader("## Summary");
    logDivider();
    logSub(`- **Total tasks:** ${tasks.length}`);
    logSub(`- **Active:** ${active.length}`);
    logSub(`- **Blocked:** ${blocked.length}`);
    logSub(`- **Ready:** ${ready.length}`);
    logSub(`- **Done:** ${done.length}`);
  }

  const result = successResult({
    command: "summary",
    guidance,
    nextCommands: getValidNextCommands("summary", "success"),
    duration: Date.now() - startTime,
  });

  if (json) {
    const jsonOutput = JSON.parse(renderResultJson(result)) as Record<string, unknown>;
    const summaryData = buildJson(tasks);
    Object.assign(jsonOutput, summaryData);
    console.log(JSON.stringify(jsonOutput, null, 2));
  } else {
    process.stdout.write(renderResultMarkdown(result) + "\n");
  }
}