import { checkDeprecated } from "./deprecated.js";
import { getRepoRoot } from "../../util/paths.js";
import { logHeader, logSub, logDivider } from "../../util/logging.js";
import { successResult, noopResult } from "../../core/result-builder.js";
import { getValidNextCommands } from "../../core/next-command-maps.js";
import { renderResultMarkdown } from "../../core/result-renderer.js";

export async function cmdDepsDeprecated(): Promise<void> {
  const repoRoot = getRepoRoot();

  logHeader(`## Deprecated Packages`);
  logDivider();

  const result = await checkDeprecated(repoRoot);

  if (result.packages.length === 0) {
    logSub("No deprecated packages found.");
    const noop = noopResult({
      command: "deps deprecated",
      reason: "No deprecated packages found.",
      nextCommands: getValidNextCommands("deps deprecated", "success"),
    });
    process.stdout.write(renderResultMarkdown(noop) + "\n");
    return;
  }

  for (const d of result.packages) {
    logSub(`- **${d.package}@${d.version}**: ${d.deprecationMessage}`);
  }

  logDivider();
  logSub(`Total deprecated: ${result.packages.length}`);

  const success = successResult({
    command: "deps deprecated",
    guidance: `Found ${result.packages.length} deprecated package(s).`,
    nextCommands: getValidNextCommands("deps deprecated", "success"),
  });
  process.stdout.write(renderResultMarkdown(success) + "\n");
}
