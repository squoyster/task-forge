import { loadConfig } from "../core/config.js";
import { getRepoRoot } from "../util/paths.js";
import { logSuccess, logWarn } from "../util/logging.js";

export async function cmdConfigValidate(options?: { json?: boolean }): Promise<void> {
  const repoRoot = getRepoRoot();
  const issues: string[] = [];
  let config;

  try {
    config = loadConfig(repoRoot);
  } catch (err) {
    issues.push(`Failed to load config: ${err instanceof Error ? err.message : String(err)}`);
    if (options?.json) {
      console.log(JSON.stringify({ ok: false, issues }, null, 2));
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
    if (options?.json) console.log(JSON.stringify({ ok: true, issues: [] }, null, 2));
    else logSuccess("Config is valid.");
  } else {
    if (options?.json) console.log(JSON.stringify({ ok: false, issues }, null, 2));
    else issues.forEach((i) => logWarn(i));
  }
}
