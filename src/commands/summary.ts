import { loadAllTasks } from "../core/task-store.js";
import { selectNextTask } from "../core/scheduler.js";
import { logHeader, logSub, logDivider, logInfo } from "../util/logging.js";

export async function cmdSummary(): Promise<void> {
  const tasks = loadAllTasks();

  if (tasks.length === 0) {
    logInfo("No task files found.");
    return;
  }

  const now = new Date();
  logHeader(`# TaskForge Summary`);
  logDivider();
  logSub(`Generated: ${now.toISOString().replace("T", " ").slice(0, 19)}`);
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

  const makeLine = (t: { id: string; priority: string; agentRole?: string; body: string }) => {
    const titleMatch = t.body.match(/^#\s+\S+:\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : t.id;
    return `- **${t.id}**: ${title} (Priority: ${t.priority}, Role: ${t.agentRole ?? "Implementer"})`;
  };

  logHeader(`## Active Work`);
  logDivider();
  if (active.length === 0) logSub("None");
  else active.forEach((t) => logSub(makeLine(t)));
  logDivider();

  logHeader(`## Blocked`);
  logDivider();
  if (blocked.length === 0) logSub("None");
  else blocked.forEach((t) => logSub(makeLine(t)));
  logDivider();

  logHeader(`## Ready Next`);
  logDivider();
  if (ready.length === 0) logSub("None");
  else ready.forEach((t) => logSub(makeLine(t)));
  logDivider();

  logHeader(`## In Review`);
  logDivider();
  if (review.length === 0 && verify.length === 0) {
    logSub("None");
  } else {
    review.forEach((t) => logSub(`${makeLine(t)} [Review]`));
    verify.forEach((t) => logSub(`${makeLine(t)} [Verify]`));
  }
  logDivider();

  logHeader(`## Completed`);
  logDivider();
  if (done.length === 0) logSub("None");
  else done.forEach((t) => logSub(makeLine(t)));
  logDivider();

  logHeader(`## Inbox`);
  logDivider();
  if (inbox.length === 0) logSub("None");
  else inbox.forEach((t) => logSub(makeLine(t)));
  logDivider();

  logHeader(`## Needs Spec`);
  logDivider();
  if (needsSpec.length === 0) logSub("None");
  else needsSpec.forEach((t) => logSub(makeLine(t)));
  logDivider();

  logHeader(`## Human Action Needed`);
  logDivider();
  if (humanNeeded.length === 0) logSub("None");
  else humanNeeded.forEach((t) => logSub(makeLine(t)));
  logDivider();

  // Recommended next action
  logHeader(`## Recommended Next Action`);
  logDivider();
  const next = selectNextTask(tasks);
  if (active.length > 0) {
    logSub("Continue existing in-progress work.");
  } else if (verify.length > 0) {
    logSub("Run QA/verification on tasks in Verify status.");
  } else if (review.length > 0) {
    logSub("Review tasks in Review status.");
  } else if (next) {
    logSub(`Start the highest-priority task: ${next.id}`);
  } else if (needsSpec.length > 0) {
    logSub("Create specs for tasks in Needs Spec.");
  } else if (inbox.length > 0) {
    logSub("Process inbox items into structured tasks.");
  } else {
    logSub("No actionable tasks. Add work to the inbox.");
  }
  logDivider();

  logHeader(`## Summary`);
  logDivider();
  logSub(`- **Total tasks:** ${tasks.length}`);
  logSub(`- **Active:** ${active.length}`);
  logSub(`- **Blocked:** ${blocked.length}`);
  logSub(`- **Ready:** ${ready.length}`);
  logSub(`- **Done:** ${done.length}`);
}
