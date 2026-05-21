import { runAudit } from "./audit.js";
import { loadConfig } from "../../core/config.js";
import { getRepoRoot } from "../../util/paths.js";
import { logInfo, logHeader, logSub, logDivider } from "../../util/logging.js";

export async function cmdDepsAudit(): Promise<void> {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);
  const pm = config.dependencies?.packageManager ?? "pnpm";

  logHeader(`## Dependency Audit`);
  logDivider();

  const result = await runAudit(pm, repoRoot);

  if (result.ok && result.findings.length === 0) {
    logSub("No vulnerabilities found.");
    return;
  }

  if (result.findings.length > 0) {
    const bySeverity: Record<string, typeof result.findings> = {};
    for (const f of result.findings) {
      if (!bySeverity[f.severity]) bySeverity[f.severity] = [];
      bySeverity[f.severity].push(f);
    }

    for (const [severity, findings] of Object.entries(bySeverity)) {
      logHeader(`### ${severity.toUpperCase()} (${findings.length})`);
      logDivider();
      for (const f of findings) {
        logSub(`- **${f.package}**: ${f.title}${f.direct ? " (direct)" : " (transitive)"}`);
        if (f.patchedVersions) logSub(`  Patched: ${f.patchedVersions}`);
        if (f.url) logSub(`  ${f.url}`);
      }
      logDivider();
    }
  }

  logSub(`Total findings: ${result.findings.length}`);
}
