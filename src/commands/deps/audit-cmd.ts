import { runAudit } from "./audit.js";
import { loadConfig } from "../../core/config.js";
import { getRepoRoot } from "../../util/paths.js";
import { logHeader, logSub, logDivider, logError } from "../../util/logging.js";
import { cmdDepsCreateTasks } from "./create-tasks.js";

export async function cmdDepsAudit(
  severity?: string,
  createTasks = false
): Promise<void> {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);
  const pm = config.dependencies?.packageManager ?? "pnpm";

  logHeader(`## Dependency Audit`);
  logDivider();

  const result = await runAudit(pm, repoRoot);

  if (!result.ok) {
    logError(result.raw);
    return;
  }

  if (result.findings.length === 0) {
    logSub("No vulnerabilities found.");
    return;
  }

  // Filter by severity if specified
  let findings = result.findings;
  if (severity) {
    const validSeverities = ["critical", "high", "medium", "low", "info"];
    if (!validSeverities.includes(severity)) {
      logError(`Invalid severity level: ${severity}. Must be one of: ${validSeverities.join(", ")}`);
      return;
    }
    findings = result.findings.filter(f => f.severity === severity);
    if (findings.length === 0) {
      logSub(`No vulnerabilities found with severity: ${severity}`);
      return;
    }
  }

  if (findings.length > 0) {
    const bySeverity: Record<string, typeof findings> = {};
    for (const f of findings) {
      if (!bySeverity[f.severity]) bySeverity[f.severity] = [];
      bySeverity[f.severity].push(f);
    }

    for (const [severityLevel, findings] of Object.entries(bySeverity)) {
      logHeader(`### ${severityLevel.toUpperCase()} (${findings.length})`);
      logDivider();
      for (const f of findings) {
        logSub(`- **${f.package}**: ${f.title}${f.direct ? " (direct)" : " (transitive)"}`);
        if (f.patchedVersions) logSub(`  Patched: ${f.patchedVersions}`);
        if (f.url) logSub(`  ${f.url}`);
      }
      logDivider();
    }
  }

  logSub(`Total findings: ${findings.length}`);

  // Automatically create tasks if requested
  if (createTasks && findings.length > 0) {
    logSub("Creating tasks for found vulnerabilities...");
    await cmdDepsCreateTasks();
  }
}
