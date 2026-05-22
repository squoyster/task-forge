import { generateDepsPlan, formatPlan } from "./plan.js";
import { loadConfig } from "../../core/config.js";
import { getRepoRoot } from "../../util/paths.js";
import { logInfo, logHeader, logSub, logDivider } from "../../util/logging.js";

export async function cmdDepsScan(): Promise<void> {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);

  logHeader(`# Dependency Scan`);
  logDivider();
  logSub(`Package manager: ${config.dependencies?.packageManager ?? "pnpm"}`);
  logSub(`OSV-Scanner: ${config.dependencies?.scan?.osv !== false ? "enabled" : "disabled"}`);
  logSub(`Audit: ${config.dependencies?.scan?.packageAudit !== false ? "enabled" : "disabled"}`);
  logSub(`Outdated: ${config.dependencies?.scan?.outdated !== false ? "enabled" : "disabled"}`);
  logSub(`Deprecated: ${config.dependencies?.scan?.deprecated !== false ? "enabled" : "disabled"}`);
  logDivider();

  // Run all enabled scans
  const plan = await generateDepsPlan();

  // OSV-Scanner if enabled
  if (config.dependencies?.scan?.osv !== false) {
    logHeader(`## OSV-Scanner`);
    logDivider();
    logSub("OSV-Scanner not yet installed. Install with: go install github.com/google/osv-scanner/cmd/osv-scanner@latest");
    logDivider();
  }

  // Print full plan
  logInfo(formatPlan(plan));
}
