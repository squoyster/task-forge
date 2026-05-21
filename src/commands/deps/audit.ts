import { execa } from "execa";
import fs from "node:fs";
import path from "node:path";
import { getRepoRoot } from "../../util/paths.js";
import type { Config } from "../../core/config.js";

export interface AuditResult {
  ok: boolean;
  findings: AuditFinding[];
  raw: string;
}

export interface AuditFinding {
  id: string;
  package: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  url?: string;
  vulnerableVersions?: string;
  patchedVersions?: string;
  direct: boolean;
}

export async function runAudit(
  packageManager: string,
  repoRoot: string,
): Promise<AuditResult> {
  const pm = packageManager === "npm" ? "npm" : "pnpm";
  const cmd = pm === "npm" ? "npm" : "pnpm";

  try {
    const result = await execa(cmd, ["audit", "--json"], {
      cwd: repoRoot,
      reject: false,
    });

    const raw = result.stdout;
    let findings: AuditFinding[] = [];

    try {
      const parsed = JSON.parse(raw);

      if (pm === "npm" && parsed.auditReportVersion) {
        // npm v3+ audit format
        const vulnerabilities = parsed.vulnerabilities ?? {};
        for (const [pkgName, vuln] of Object.entries(vulnerabilities) as [string, Record<string, unknown>][]) {
          const via = (vuln.via as Array<Record<string, unknown>> | undefined) ?? [];
          for (const v of via) {
            if (typeof v.source === "number") continue; // skip numeric entries
            findings.push({
              id: `npm-${pkgName}-${v.name ?? "unknown"}`,
              package: pkgName,
              severity: (v.severity as AuditFinding["severity"]) ?? "medium",
              title: (v.title as string) ?? v.name ?? "Unknown vulnerability",
              url: (v.url as string) ?? undefined,
              vulnerableVersions: (v.vulnerableVersions as string) ?? undefined,
              patchedVersions: (v.patchedVersions as string) ?? undefined,
              direct: (vuln.isDirect as boolean) ?? false,
            });
          }
        }
      } else if (parsed.metadata) {
        // pnpm audit format
        const advisories = parsed.advisories ?? {};
        for (const [advId, adv] of Object.entries(advisories) as [string, Record<string, unknown>][]) {
          findings.push({
            id: advId,
            package: (adv.moduleName as string) ?? (adv.package as string) ?? "unknown",
            severity: (adv.severity as AuditFinding["severity"]) ?? "medium",
            title: (adv.title as string) ?? "Unknown vulnerability",
            url: (adv.url as string) ?? undefined,
            vulnerableVersions: (adv.vulnerableVersions as string) ?? undefined,
            patchedVersions: (adv.patchedVersions as string) ?? undefined,
            direct: (adv.directDependency as boolean) ?? false,
          });
        }
      }
    } catch {
      // If JSON parsing fails, return raw output
    }

    return {
      ok: result.exitCode === 0,
      findings,
      raw,
    };
  } catch {
    return { ok: false, findings: [], raw: "Audit command failed or not available." };
  }
}
