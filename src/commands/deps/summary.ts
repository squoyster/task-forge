import { generateDepsPlan } from "./plan.js";
import { logHeader, logSub, logDivider } from "../../util/logging.js";
import { formatTimestampMarkdown } from "../../util/timestamp.js";

export async function cmdDepsSummary(): Promise<void> {
  const plan = await generateDepsPlan();

  logHeader(`# Dependency Steward Summary`);
  logDivider();
  logSub(`Generated: ${formatTimestampMarkdown(new Date())}`);
  logDivider();

  // Critical / High
  logHeader(`## Critical / High Security Findings`);
  logDivider();
  const criticalHigh = [...plan.critical, ...plan.high];
  if (criticalHigh.length === 0) {
    logSub("None");
  } else {
    for (const f of criticalHigh) {
      logSub(`- **${f.package}** [${f.severity}]${f.direct ? " (direct)" : " (transitive)"} — ${f.title}`);
    }
  }
  logDivider();

  // Deprecated
  logHeader(`## Deprecated Packages`);
  logDivider();
  if (plan.deprecated.length === 0) {
    logSub("None");
  } else {
    for (const d of plan.deprecated) {
      logSub(`- **${d.package}@${d.version}**: ${d.deprecationMessage}`);
    }
  }
  logDivider();

  // Outdated
  logHeader(`## Outdated Direct Dependencies`);
  logDivider();
  if (plan.outdated.length === 0) {
    logSub("None");
  } else {
    for (const o of plan.outdated) {
      const risk = o.isMajor ? "major" : "minor/patch";
      logSub(`- **${o.package}**: ${o.current} → ${o.latest} (${risk})`);
    }
  }
  logDivider();

  // Summary counts
  logHeader(`## Summary`);
  logDivider();
  logSub(`- Critical: ${plan.critical.length}`);
  logSub(`- High: ${plan.high.length}`);
  logSub(`- Medium: ${plan.medium.length}`);
  logSub(`- Low: ${plan.low.length}`);
  logSub(`- Deprecated: ${plan.deprecated.length}`);
  logSub(`- Outdated: ${plan.outdated.length}`);
  logDivider();

  // Recommendation
  logHeader(`## Recommended Next Action`);
  logDivider();
  if (plan.critical.length > 0) {
    logSub(`Remediate ${plan.critical.length} critical vulnerability(ies) immediately.`);
  } else if (plan.high.length > 0) {
    logSub(`Address ${plan.high.length} high severity vulnerability(ies).`);
  } else if (plan.deprecated.length > 0) {
    logSub(`Replace ${plan.deprecated.length} deprecated package(s).`);
  } else if (plan.outdated.length > 0) {
    logSub(`Update ${plan.outdated.length} outdated package(s).`);
  } else {
    logSub("All dependencies are healthy.");
  }
}
