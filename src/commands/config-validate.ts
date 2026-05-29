import { loadConfig } from "../core/config.js";
import { getRepoRoot } from "../util/paths.js";
import { logSuccess, logWarn } from "../util/logging.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultMarkdown } from "../core/result-renderer.js";

export async function cmdConfigValidate(options?: { json?: boolean }): Promise<void> {
  const startTime = Date.now();
  const json = options?.json ?? false;
  const repoRoot = getRepoRoot();
  const issues: string[] = [];
  let config;

  try {
    config = loadConfig(repoRoot);
  } catch (err) {
    issues.push(`Failed to load config: ${err instanceof Error ? err.message : String(err)}`);
    if (json) {
      console.log(JSON.stringify({ ok: false, issues }, null, 2));
      return;
    }
    logWarn(`Config invalid: ${issues[0]}`);
    const result = failedResult({
      command: "config-validate",
      error: `Config invalid: ${issues[0]}`,
      code: "CONFIG_INVALID",
      nextCommands: getValidNextCommands("config-validate", "failed"),
      duration: Date.now() - startTime,
    });
    process.stdout.write(renderResultMarkdown(result) + "\n");
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
    if (json) console.log(JSON.stringify({ ok: true, issues: [] }, null, 2));
    else {
      logSuccess("Config is valid.");
      const result = successResult({
        command: "config-validate",
        guidance: "Config is valid.",
        nextCommands: getValidNextCommands("config-validate", "success"),
        duration: Date.now() - startTime,
      });
      process.stdout.write(renderResultMarkdown(result) + "\n");
    }
  } else {
    if (json) console.log(JSON.stringify({ ok: false, issues }, null, 2));
    else {
      issues.forEach((i) => logWarn(i));
      const result = failedResult({
        command: "config-validate",
        error: `Config validation failed: ${issues.join(", ")}`,
        code: "CONFIG_INVALID",
        nextCommands: getValidNextCommands("config-validate", "failed"),
        duration: Date.now() - startTime,
      });
      process.stdout.write(renderResultMarkdown(result) + "\n");
    }
  }
}
