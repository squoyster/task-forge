import { loadAllTasks } from "../core/task-store.js";
import { validateTaskState } from "../core/state-validator.js";
import { logSuccess, logWarn, logInfo, logHeader, logDivider, logError, logSub } from "../util/logging.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultMarkdown } from "../core/result-renderer.js";

export interface ValidateStateOptions {
  json?: boolean;
  strict?: boolean;
}

export async function cmdValidateState(options?: ValidateStateOptions): Promise<void> {
  const startTime = Date.now();
  const json = options?.json ?? false;
  const tasks = loadAllTasks();
  const result = validateTaskState(tasks);
  const strict = options?.strict ?? false;
  const hasIssues = result.errors.length > 0 || (strict && result.warnings.length > 0);

  if (json) {
    if (hasIssues) {
      const errorOutput = {
        ok: false,
        error: strict
          ? `${result.errors.length} error(s), ${result.warnings.length} warning(s) found (strict mode).`
          : `${result.errors.length} error(s) found.`,
        code: "VALIDATION_ERROR" as const,
        errors: result.errors,
        warnings: result.warnings,
        nextActions: [
          {
            command: "taskforge doctor --json",
            reason: "Diagnose and get repair guidance for validation issues.",
            safety: "safe" as const,
            preferred: true,
          },
          ...(result.errors.length > 0
            ? [{
                command: "taskforge validate-state --json",
                reason: "Re-run validation after fixing issues.",
                safety: "safe" as const,
                preferred: false,
              }]
            : []),
        ],
      };
      console.log(JSON.stringify(errorOutput, null, 2));
    } else {
      const successOutput = {
        ok: true,
        errors: result.errors,
        warnings: result.warnings,
        nextActions: [
          {
            command: "taskforge next",
            reason: "State is valid — find the next task to work on.",
            safety: "safe" as const,
            preferred: true,
          },
        ],
      };
      console.log(JSON.stringify(successOutput, null, 2));
    }

    if (hasIssues) {
      process.exit(1);
    }
    return;
  }

  const commandResult = hasIssues
    ? failedResult({
        command: "validate-state",
        error: strict
          ? `${result.errors.length} error(s), ${result.warnings.length} warning(s) found (strict mode).`
          : `${result.errors.length} error(s) found.`,
        code: "VALIDATION_ERROR",
        nextCommands: getValidNextCommands("validate-state", "failed"),
        duration: Date.now() - startTime,
      })
    : successResult({
        command: "validate-state",
        guidance: "State is valid — no issues found.",
        nextCommands: getValidNextCommands("validate-state", "success"),
        duration: Date.now() - startTime,
      });

  if (result.errors.length === 0 && result.warnings.length === 0) {
    logSuccess("State is valid — no issues found.");
    logDivider();
    logInfo("Valid next actions:");
    logSub("1. taskforge next");
    logSub("   Reason: State is valid — find the next task to work on.");
    logSub("   Safety: safe");
    process.stdout.write(renderResultMarkdown(commandResult) + "\n");
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

  process.stdout.write(renderResultMarkdown(commandResult) + "\n");

  if (hasIssues) {
    process.exit(1);
  }
}
