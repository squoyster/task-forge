import { logInfo } from "../../util/logging.js";

export async function cmdDepsPr(): Promise<void> {
  logInfo("Dependency PR creation is not yet implemented.");
  logInfo("");
  logInfo("This command will create focused dependency update PRs for low-risk cases:");
  logInfo("- Patch updates with passing tests");
  logInfo("- Minor updates within compatible semver range");
  logInfo("- Security fixes with available fixed versions");
  logInfo("- Lockfile-only transitive fixes");
  logInfo("");
  logInfo("High-risk updates (major versions, framework upgrades, auth packages)");
  logInfo("require human review and will not be auto-created.");
}
