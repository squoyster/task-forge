import { loadAllTasks } from "../core/task-store.js";
import { selectNextTask, scoreTask } from "../core/scheduler.js";
import { logInfo, logHeader, logSub, logDivider } from "../util/logging.js";

export async function cmdNext(): Promise<void> {
  const tasks = loadAllTasks();

  if (tasks.length === 0) {
    logInfo("No task files found.");
    return;
  }

  const next = selectNextTask(tasks);

  if (!next) {
    logInfo("No actionable tasks found.");
    logDivider();
    logInfo("All tasks are in Inbox, Needs Spec, Blocked, Done, Rejected, or Deferred.");
    return;
  }

  logHeader(`## Next Task`);
  logDivider();
  logSub(`**ID:** ${next.id}`);
  logSub(`**Status:** ${next.status}`);
  logSub(`**Priority:** ${next.priority}`);
  logSub(`**Agent Role:** ${next.agentRole ?? "Implementer"}`);
  logSub(`**Score:** ${scoreTask(next)}`);

  // Extract goal from body
  const goalMatch = next.body.match(/## Goal\n([\s\S]*?)(?=##|\n\n\n|$)/);
  if (goalMatch) {
    logSub(`**Goal:** ${goalMatch[1].trim().slice(0, 120)}${goalMatch[1].trim().length > 120 ? "..." : ""}`);
  }

  logSub(`**File:** ${next.filePath}`);
  logDivider();
  logInfo(`### Start this task:`);
  logSub(`taskforge start ${next.id}`);
}
