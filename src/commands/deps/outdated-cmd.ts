import { runOutdated } from "./outdated.js";
import { loadConfig } from "../../core/config.js";
import { getRepoRoot } from "../../util/paths.js";
import { logHeader, logSub, logDivider } from "../../util/logging.js";
import { successResult, noopResult } from "../../core/result-builder.js";
import { getValidNextCommands } from "../../core/next-command-maps.js";
import { renderResultMarkdown } from "../../core/result-renderer.js";

export async function cmdDepsOutdated(): Promise<void> {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);
  const pm = config.dependencies?.packageManager ?? "pnpm";

  logHeader(`## Outdated Dependencies`);
  logDivider();

  const result = await runOutdated(pm, repoRoot);

  if (result.packages.length === 0) {
    logSub("All packages are up to date.");
    const noop = noopResult({
      command: "deps outdated",
      reason: "All packages are up to date.",
      nextCommands: getValidNextCommands("deps outdated", "success"),
    });
    process.stdout.write(renderResultMarkdown(noop) + "\n");
    return;
  }

  const major = result.packages.filter((p) => p.isMajor);
  const minor = result.packages.filter((p) => !p.isMajor);

  if (major.length > 0) {
    logHeader(`### Major Updates (${major.length})`);
    logDivider();
    for (const p of major) {
      logSub(`- **${p.package}**: ${p.current} → ${p.latest}`);
    }
    logDivider();
  }

  if (minor.length > 0) {
    logHeader(`### Minor/Patch Updates (${minor.length})`);
    logDivider();
    for (const p of minor) {
      logSub(`- **${p.package}**: ${p.current} → ${p.latest}`);
    }
    logDivider();
  }

  logSub(`Total outdated: ${result.packages.length}`);

  const success = successResult({
    command: "deps outdated",
    guidance: `Found ${result.packages.length} outdated package(s) (${major.length} major, ${minor.length} minor/patch).`,
    nextCommands: getValidNextCommands("deps outdated", "success"),
  });
  process.stdout.write(renderResultMarkdown(success) + "\n");
}
