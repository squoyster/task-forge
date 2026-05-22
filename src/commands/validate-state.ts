import { loadAllTasks } from "../core/task-store.js";
import { validateTaskState } from "../core/state-validator.js";
import { logSuccess, logWarn, logInfo } from "../util/logging.js";

export async function cmdValidateState(options?: { json?: boolean; strict?: boolean }): Promise<void> {
  const tasks = loadAllTasks();
  const result = validateTaskState(tasks);

  if (options?.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.errors.length === 0 && result.warnings.length === 0) {
    logSuccess("State is valid — no issues found.");
    return;
  }

  for (const e of result.errors) {
    logWarn(`✗ [${e.code}] ${e.taskId ? `[${e.taskId}] ` : ""}${e.message}`);
  }
  for (const w of result.warnings) {
    logInfo(`⚠ [${w.code}] ${w.taskId ? `[${w.taskId}] ` : ""}${w.message}`);
  }
}
