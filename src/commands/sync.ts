import { loadAllTasks } from "../core/task-store.js";
import { logInfo, logSub } from "../util/logging.js";

export async function cmdSync(): Promise<void> {
  logInfo("# TaskForge Sync");
  logInfo("");
  logInfo("Sync with external issue tracker is not yet configured.");
  logInfo("");
  logInfo("To configure sync, set one of:");
  logInfo("  TASKFORGE_TRACKER=github    # GitHub Issues + Projects");
  logInfo("  TASKFORGE_TRACKER=plane     # Plane");
  logInfo("  TASKFORGE_TRACKER=linear    # Linear");
  logInfo("  TASKFORGE_TRACKER=jira      # Jira");
  logInfo("");
  logInfo("And set the corresponding API credentials.");
  logInfo("");

  const tasks = loadAllTasks();
  if (tasks.length > 0) {
    logInfo("## Current Task Files");
    logInfo("");
    for (const task of tasks) {
      const titleMatch = task.body.match(/^#\s+\S+:\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : task.id;
      logSub(`- **${task.id}**: ${title} [${task.status}]`);
    }
  } else {
    logInfo("No task files found.");
  }

  logInfo("");
  logInfo("## Sync Status");
  logInfo("");
  logInfo("No external tracker configured. Task files are the source of truth.");
}
