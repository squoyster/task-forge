import { loadConfig } from "../core/config.js";
import { getRepoRoot } from "../util/paths.js";
import { logSuccess, logWarn } from "../util/logging.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { writeResult } from "../util/write-command-result.js";

export async function cmdConfigValidate(options?: { json?: boolean }): Promise<void> {
  const repoRoot = getRepoRoot();
  const issues: string[] = [];
  let config;

  try {
    config = loadConfig(repoRoot);
  } catch (err) {
    issues.push(`Failed to load config: ${err instanceof Error ? err.message : String(err)}`);
    if (options?.json) {
      writeResult(failedResult({
        command: "config-validate",
        error: issues[0],
        code: "CONFIG_INVALID",
        guidance: `Config validation failed: ${issues[0]}`,
      }), options.json);
      return;
    }
    logWarn(`Config invalid: ${issues[0]}`);
    return;
  }

  if (config?.gates) {
    for (const [name, cmd] of Object.entries(config.gates)) {
      if (typeof cmd !== "string" || cmd.trim().length === 0) {
        issues.push(`Gate '${name}' is not a valid command string`);
      }
    }
  }

  if (issues.length === 0) {
    if (options?.json) writeResult(successResult({ command: "config-validate", guidance: "Config is valid." }), options.json);
    else logSuccess("Config is valid.");
  } else {
    if (options?.json) writeResult(failedResult({
      command: "config-validate",
      error: issues.join("; "),
      code: "CONFIG_INVALID",
      guidance: `Config validation failed: ${issues.join("; ")}`,
    }), options.json);
    else issues.forEach((i) => logWarn(i));
  }
}
