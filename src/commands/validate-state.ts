import { loadAllTasks } from "../core/task-store.js";
import { validateTaskState } from "../core/state-validator.js";
import { logSuccess, logWarn, logInfo, logHeader, logDivider, logError, logSub } from "../util/logging.js";
import { emitResult } from "../core/command-result.js";
import { successResult, failedResult } from "../core/result-builder.js";

export interface ValidateStateOptions {
  json?: boolean;
  strict?: boolean;
  /** When true, never call process.exit (used by the MCP bridge, which runs
   *  commands in-process and reads results from the result sink). */
  emitOnly?: boolean;
}

export async function cmdValidateState(options?: ValidateStateOptions): Promise<void> {
  const tasks = loadAllTasks();
  const result = validateTaskState(tasks);
  const strict = options?.strict ?? false;
  const hasIssues = result.errors.length > 0 || (strict && result.warnings.length > 0);

  if (options?.json) {
    if (hasIssues) {
      emitResult(failedResult({
        command: "validate-state",
        error: strict
          ? `${result.errors.length} error(s), ${result.warnings.length} warning(s) found (strict mode).`
          : `${result.errors.length} error(s) found.`,
        code: "VALIDATION_ERROR",
        nextCommands: [
          {
            command: "taskforge doctor --json",
            purpose: "Diagnose and get repair guidance for validation issues.",
            when: "on validation failure",
            allowedFor: "all",
            priority: 1,
          },
          ...(result.errors.length > 0
            ? [{
                command: "taskforge validate-state --json",
                purpose: "Re-run validation after fixing issues.",
                when: "after fixing issues",
                allowedFor: "all" as const,
                priority: 2,
              }]
            : []),
        ],
      }), options.json);
    } else {
      emitResult(successResult({
        command: "validate-state",
        guidance: "State is valid — no issues found.",
        nextCommands: [
          {
            command: "taskforge next",
            purpose: "State is valid — find the next task to work on.",
            when: "on valid state",
            allowedFor: "all",
            priority: 1,
          },
        ],
      }), options.json);
    }

    if (hasIssues && !options?.emitOnly) {
      process.exit(1);
    }
    return;
  }

  if (result.errors.length === 0 && result.warnings.length === 0) {
    logSuccess("State is valid — no issues found.");
    logDivider();
    logInfo("Valid next actions:");
    logSub("1. taskforge next");
    logSub("   Reason: State is valid — find the next task to work on.");
    logSub("   Safety: safe");
    return;
  }

  if (result.errors.length > 0) {
    logHeader("# Task-State Validation");
    logDivider();
    for (const e of result.errors) {
      logError(`✗ [${e.code}] ${e.taskId ? `[${e.taskId}] ` : ""}${e.message}`);
    }
    for (const w of result.warnings) {
      logWarn(`⚠ [${w.code}] ${w.taskId ? `[${w.taskId}] ` : ""}${w.message}`);
    }
    logDivider();
    logError(`${result.errors.length} error(s), ${result.warnings.length} warning(s) found.`);
    if (strict) {
      logError("Strict mode enabled — exiting with error code.");
    }
    logDivider();
    logInfo("Valid next actions:");
    logSub("1. taskforge doctor --json");
    logSub("   Reason: Diagnose and get repair guidance for validation issues.");
    logSub("   Safety: safe");
    logSub("2. taskforge validate-state --json");
    logSub("   Reason: Re-run validation after fixing issues.");
    logSub("   Safety: safe");
  } else if (strict && result.warnings.length > 0) {
    logHeader("# Task-State Validation");
    logDivider();
    for (const w of result.warnings) {
      logError(`⚠ [${w.code}] ${w.taskId ? `[${w.taskId}] ` : ""}${w.message}`);
    }
    logDivider();
    logError(`${result.warnings.length} warning(s) found (strict mode — warnings treated as errors).`);
    logDivider();
    logInfo("Valid next actions:");
    logSub("1. taskforge doctor --json");
    logSub("   Reason: Diagnose and get repair guidance for validation warnings.");
    logSub("   Safety: safe");
    logSub("2. taskforge validate-state --json");
    logSub("   Reason: Re-run validation after resolving warnings.");
    logSub("   Safety: safe");
  } else {
    logHeader("# Task-State Validation");
    logDivider();
    for (const w of result.warnings) {
      logWarn(`⚠ [${w.code}] ${w.taskId ? `[${w.taskId}] ` : ""}${w.message}`);
    }
    logDivider();
    logInfo(`${result.warnings.length} warning(s) found. Run with --strict to treat warnings as errors.`);
    logDivider();
    logInfo("Valid next actions:");
    logSub("1. taskforge doctor --json");
    logSub("   Reason: Diagnose and get repair guidance for validation warnings.");
    logSub("   Safety: safe");
    logSub("2. taskforge validate-state --strict --json");
    logSub("   Reason: Re-run validation in strict mode.");
    logSub("   Safety: safe");
  }

  if (hasIssues && !options?.emitOnly) {
    process.exit(1);
  }
}
