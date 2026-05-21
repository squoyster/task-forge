import { checkDeprecated } from "./deprecated.js";
import { getRepoRoot } from "../../util/paths.js";
import { logInfo, logHeader, logSub, logDivider } from "../../util/logging.js";

export async function cmdDepsDeprecated(): Promise<void> {
  const repoRoot = getRepoRoot();

  logHeader(`## Deprecated Packages`);
  logDivider();

  const result = await checkDeprecated(repoRoot);

  if (result.packages.length === 0) {
    logSub("No deprecated packages found.");
    return;
  }

  for (const d of result.packages) {
    logSub(`- **${d.package}@${d.version}**: ${d.deprecationMessage}`);
  }

  logDivider();
  logSub(`Total deprecated: ${result.packages.length}`);
}
