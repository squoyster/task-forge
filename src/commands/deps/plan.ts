import { runAudit, type AuditFinding } from "./audit.js";
import { runOutdated, type OutdatedPackage } from "./outdated.js";
import { checkDeprecated, type DeprecatedPackage } from "./deprecated.js";
import { loadConfig } from "../../core/config.js";
import { getRepoRoot } from "../../util/paths.js";
import { logInfo } from "../../util/logging.js";
import { successResult } from "../../core/result-builder.js";
import { getValidNextCommands } from "../../core/next-command-maps.js";
import { renderResultMarkdown } from "../../core/result-renderer.js";

export interface DepsPlan {
  critical: AuditFinding[];
  high: AuditFinding[];
  medium: AuditFinding[];
  low: AuditFinding[];
  deprecated: DeprecatedPackage[];
  outdated: OutdatedPackage[];
  summary: string;
}

export async function generateDepsPlan(): Promise<DepsPlan> {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);
  const pm = config.dependencies?.packageManager ?? "pnpm";

  const [auditResult, outdatedResult, deprecatedResult] = await Promise.all([
    config.dependencies?.scan?.packageAudit !== false
      ? runAudit(pm, repoRoot)
      : Promise.resolve({ ok: true, findings: [], raw: "Audit disabled" }),
    config.dependencies?.scan?.outdated !== false
      ? runOutdated(pm, repoRoot)
      : Promise.resolve({ packages: [], raw: "Outdated check disabled" }),
    config.dependencies?.scan?.deprecated !== false
      ? checkDeprecated(repoRoot)
      : Promise.resolve({ packages: [], raw: "Deprecated check disabled" }),
  ]);

  const critical = auditResult.findings.filter((f) => f.severity === "critical");
  const high = auditResult.findings.filter((f) => f.severity === "high");
  const medium = auditResult.findings.filter((f) => f.severity === "medium");
  const low = auditResult.findings.filter((f) => f.severity === "low" || f.severity === "info");

  const summary = generateSummary(auditResult, outdatedResult, deprecatedResult);

  return {
    critical,
    high,
    medium,
    low,
    deprecated: deprecatedResult.packages,
    outdated: outdatedResult.packages,
    summary,
  };
}

export function formatPlan(plan: DepsPlan): string {
  const lines: string[] = [];

  lines.push("# Dependency Health Plan");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString().replace("T", " ").slice(0, 19)}`);
  lines.push("");

  // Critical
  lines.push("## Critical Security Findings");
  lines.push("");
  if (plan.critical.length === 0) {
    lines.push("None");
  } else {
    for (const f of plan.critical) {
      lines.push(`- **${f.package}**: ${f.title} [${f.severity}]${f.direct ? " (direct)" : " (transitive)"}`);
      if (f.patchedVersions) lines.push(`  - Patched in: ${f.patchedVersions}`);
      if (f.url) lines.push(`  - Advisory: ${f.url}`);
    }
  }
  lines.push("");

  // High
  lines.push("## High Security Findings");
  lines.push("");
  if (plan.high.length === 0) {
    lines.push("None");
  } else {
    for (const f of plan.high) {
      lines.push(`- **${f.package}**: ${f.title} [${f.severity}]${f.direct ? " (direct)" : " (transitive)"}`);
      if (f.patchedVersions) lines.push(`  - Patched in: ${f.patchedVersions}`);
    }
  }
  lines.push("");

  // Deprecated
  lines.push("## Deprecated Packages");
  lines.push("");
  if (plan.deprecated.length === 0) {
    lines.push("None");
  } else {
    for (const d of plan.deprecated) {
      lines.push(`- **${d.package}@${d.version}**: ${d.deprecationMessage}`);
    }
  }
  lines.push("");

  // Outdated
  lines.push("## Outdated Direct Dependencies");
  lines.push("");
  if (plan.outdated.length === 0) {
    lines.push("None");
  } else {
    for (const o of plan.outdated) {
      const risk = o.isMajor ? "major upgrade" : "minor/patch";
      lines.push(`- **${o.package}**: ${o.current} → ${o.latest} (${risk})`);
    }
  }
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  lines.push(plan.summary);

  return lines.join("\n");
}

function generateSummary(
  audit: { ok: boolean; findings: AuditFinding[] },
  outdated: { packages: OutdatedPackage[] },
  deprecated: { packages: DeprecatedPackage[] },
): string {
  const parts: string[] = [];

  if (!audit.ok) {
    parts.push("Audit failed or not available.");
  } else if (audit.findings.length > 0) {
    parts.push(`${audit.findings.length} vulnerability(ies) found.`);
  } else {
    parts.push("No known vulnerabilities.");
  }

  if (outdated.packages.length > 0) {
    parts.push(`${outdated.packages.length} outdated package(s).`);
  }

  if (deprecated.packages.length > 0) {
    parts.push(`${deprecated.packages.length} deprecated package(s).`);
  }

  if (parts.length === 0) {
    return "All dependencies are healthy.";
  }

  return parts.join(" ");
}

export async function cmdDepsPlan(): Promise<void> {
  const plan = await generateDepsPlan();
  const formatted = formatPlan(plan);
  logInfo(formatted);

  const result = successResult({
    command: "deps plan",
    guidance: plan.summary,
    nextCommands: getValidNextCommands("deps plan", "success"),
  });
  process.stdout.write(renderResultMarkdown(result) + "\n");
}
