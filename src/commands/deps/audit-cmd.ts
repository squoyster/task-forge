import { runAudit } from "./audit.js";
import { loadConfig } from "../../core/config.js";
import { getRepoRoot } from "../../util/paths.js";
import { logHeader, logSub, logDivider, logError } from "../../util/logging.js";
import { cmdDepsCreateTasks } from "./create-tasks.js";
import { successResult, noopResult, failedResult } from "../../core/result-builder.js";
import { getValidNextCommands } from "../../core/next-command-maps.js";
import { renderResultMarkdown } from "../../core/result-renderer.js";

export async function cmdDepsAudit(
  severity?: string,
  createTasks = false
): Promise<void> {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);
  const pm = config.dependencies?.packageManager ?? "pnpm";

  logHeader(`## Dependency Audit`);
  logDivider();

  const auditResult = await runAudit(pm, repoRoot);

  if (!auditResult.ok) {
    logError(auditResult.raw);
    const errResult = failedResult({
      command: "deps audit",
      error: auditResult.raw,
      code: "AUDIT_FAILED",
      nextCommands: getValidNextCommands("deps audit", "failed"),
    });
    process.stdout.write(renderResultMarkdown(errResult) + "\n");
    return;
  }

  if (auditResult.findings.length === 0) {
    logSub("No vulnerabilities found.");
    const noop = noopResult({
      command: "deps audit",
      reason: "No vulnerabilities found.",
      nextCommands: getValidNextCommands("deps audit", "success"),
    });
    process.stdout.write(renderResultMarkdown(noop) + "\n");
    return;
  }

  // Filter by severity if specified
  let findings = auditResult.findings;
  if (severity) {
    const validSeverities = ["critical", "high", "medium", "low", "info"];
    if (!validSeverities.includes(severity)) {
      logError(`Invalid severity level: ${severity}. Must be one of: ${validSeverities.join(", ")}`);
      const errResult = failedResult({
        command: "deps audit",
        error: `Invalid severity level: ${severity}.`,
        code: "INVALID_SEVERITY",
        nextCommands: getValidNextCommands("deps audit", "failed"),
      });
      process.stdout.write(renderResultMarkdown(errResult) + "\n");
      return;
    }
    findings = auditResult.findings.filter(f => f.severity === severity);
    if (findings.length === 0) {
      logSub(`No vulnerabilities found with severity: ${severity}`);
      const noop = noopResult({
        command: "deps audit",
        reason: `No vulnerabilities found with severity: ${severity}`,
        nextCommands: getValidNextCommands("deps audit", "success"),
      });
      process.stdout.write(renderResultMarkdown(noop) + "\n");
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

  const success = successResult({
    command: "deps audit",
    guidance: `Found ${findings.length} vulnerability(ies)${severity ? ` (severity: ${severity})` : ""}.`,
    nextCommands: getValidNextCommands("deps audit", "success"),
  });
  process.stdout.write(renderResultMarkdown(success) + "\n");

  // Automatically create tasks if requested
  if (createTasks && findings.length > 0) {
    logSub("Creating tasks for found vulnerabilities...");
    await cmdDepsCreateTasks();
  }
}
