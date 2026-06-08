import { generateDepsPlan } from "./plan.js";
import { getNextId, loadAllTasks, writeTaskFile } from "../../core/task-store.js";
import { STATUS } from "../../util/status-constants.js";
import { getTaskStateDir, getRepoRoot } from "../../util/paths.js";
import { commitAndPushTaskState } from "../../core/git.js";
import { logInfo, logSuccess, logDivider } from "../../util/logging.js";
import { successResult, noopResult } from "../../core/result-builder.js";
import { getValidNextCommands } from "../../core/next-command-maps.js";
import { renderResultMarkdown } from "../../core/result-renderer.js";
import path from "node:path";

export async function cmdDepsCreateTasks(): Promise<void> {
  const repoRoot = getRepoRoot();
  const plan = await generateDepsPlan();
  const existingTasks = loadAllTasks(repoRoot);
  const existingPackages = new Set<string>();

  // Find existing dependency tasks to avoid duplicates
  for (const t of existingTasks) {
    if (t.type === "Dependency" || t.type === "Security" || t.type === "Maintenance") {
      const pkgMatch = t.body.match(/Package:\s*(\S+)/);
      if (pkgMatch) existingPackages.add(pkgMatch[1]);
    }
  }

  let created = 0;

  // Create SEC tasks for critical/high vulnerabilities
  for (const finding of [...plan.critical, ...plan.high]) {
    if (existingPackages.has(finding.package)) continue;

    const id = getNextId(repoRoot);
    const isCritical = plan.critical.includes(finding);
    const body = generateSecTaskBody(id, finding, isCritical);

    const filePath = path.join(getTaskStateDir(repoRoot), `${id}.md`);
    writeTaskFile({
      id,
      type: "Security",
       status: STATUS.READY,
      priority: isCritical ? "P0" : "P1",
      agentRole: "Dependency Steward",
      riskLevel: isCritical ? "High" : "Medium",
      humanInterventionRequired: false,
      body,
      filePath,
    });

    logSuccess(`Created ${id}: Remediate vulnerability in ${finding.package}`);
    created++;
  }

  // Create DEP tasks for deprecated packages
  for (const dep of plan.deprecated) {
    if (existingPackages.has(dep.package)) continue;

    const id = getNextId(repoRoot);
    const body = generateDepTaskBody(id, dep);

    const filePath = path.join(getTaskStateDir(repoRoot), `${id}.md`);
    writeTaskFile({
      id,
      type: "Dependency",
       status: STATUS.READY,
      priority: "P2",
      agentRole: "Dependency Steward",
      riskLevel: "Medium",
      humanInterventionRequired: false,
      body,
      filePath,
    });

    logSuccess(`Created ${id}: Replace deprecated package ${dep.package}`);
    created++;
  }

  // Create DEP tasks for outdated direct dependencies (minor/patch only)
  for (const outdated of plan.outdated) {
    if (existingPackages.has(outdated.package)) continue;
    if (outdated.isMajor) continue; // Major upgrades need human review

    const id = getNextId(repoRoot);
    const body = generateOutdatedTaskBody(id, outdated);

    const filePath = path.join(getTaskStateDir(repoRoot), `${id}.md`);
    writeTaskFile({
      id,
      type: "Dependency",
       status: STATUS.READY,
      priority: "P2",
      agentRole: "Dependency Steward",
      riskLevel: "Low",
      humanInterventionRequired: false,
      body,
      filePath,
    });

    logSuccess(`Created ${id}: Update ${outdated.package} to ${outdated.latest}`);
    created++;
  }

  logDivider();
  if (created === 0) {
    logInfo("No new dependency tasks to create.");
  } else {
    logSuccess(`Created ${created} dependency task(s).`);
  }

  // Push new task files to shared task-state branch
  if (created > 0) {
    const statusMsg = `chore: create ${created} dependency task(s)`;
    await commitAndPushTaskState(repoRoot, statusMsg);
  }

  const result = created === 0
    ? noopResult({
        command: "deps create-tasks",
        reason: "No new dependency tasks needed.",
        nextCommands: getValidNextCommands("deps create-tasks", "success"),
      })
    : successResult({
        command: "deps create-tasks",
        guidance: `Created ${created} dependency task(s).`,
        nextCommands: getValidNextCommands("deps create-tasks", "success"),
      });
  process.stdout.write(renderResultMarkdown(result) + "\n");
}

function generateSecTaskBody(
  id: string,
  finding: { package: string; severity: string; title: string; url?: string; patchedVersions?: string; direct: boolean },
  isCritical: boolean,
): string {
  return `# ${id}: Remediate vulnerability in ${finding.package}

## Goal

Remediate the known ${finding.severity} vulnerability affecting \`${finding.package}\`.

## Vulnerability Summary

- Package: ${finding.package}
- Severity: ${finding.severity}
- Title: ${finding.title}
- Direct dependency: ${finding.direct ? "yes" : "no"}
${finding.url ? `- Advisory: ${finding.url}` : ""}
${finding.patchedVersions ? `- Fixed version: ${finding.patchedVersions}` : ""}

## Remediation Plan

1. Update to the minimum fixed compatible version.
2. Refresh lockfile.
3. Run audit/scanner.
4. Run relevant tests.
5. Open focused PR.

## Scope

Allowed files/directories:
- package.json
- pnpm-lock.yaml
- package-lock.json
- yarn.lock
- tests/**

Disallowed files/directories:
- unrelated source files unless required by migration

## Acceptance Criteria

- [ ] Vulnerability no longer appears in audit.
- [ ] Package is updated to a safe version.
- [ ] Lockfile is updated.
- [ ] Relevant tests pass.
- [ ] PR explains vulnerability and fix.
- [ ] No unrelated dependency churn.

## Test / Verification Command
\`\`\`bash
pnpm install --frozen-lockfile
pnpm audit
pnpm test
\`\`\`

## Risk Level
${isCritical ? "High" : "Medium"}

## Human Intervention Required?
${isCritical ? "Yes — critical vulnerability may require migration review." : "No"}

## Continuation Policy
Auto-continue for patch/minor updates if tests pass. Stop for human intervention on major upgrades.

## Agent Notes

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Advisory: ${finding.url ?? ""}
`;
}

function generateDepTaskBody(
  id: string,
  dep: { package: string; version: string; deprecationMessage: string },
): string {
  return `# ${id}: Replace deprecated package ${dep.package}

## Goal

Replace or update the deprecated package \`${dep.package}\`.

## Finding

- Package: ${dep.package}
- Current version: ${dep.version}
- Deprecation message: ${dep.deprecationMessage}

## Scope

Allowed files/directories:
- package.json
- pnpm-lock.yaml
- tests/**

Disallowed files/directories:
- unrelated source files

## Acceptance Criteria

- [ ] Deprecated package is replaced or updated.
- [ ] Lockfile is updated.
- [ ] Relevant tests pass.
- [ ] No unrelated dependency churn.

## Test / Verification Command
\`\`\`bash
pnpm install --frozen-lockfile
pnpm test
\`\`\`

## Risk Level
Medium

## Human Intervention Required?
No unless replacement requires significant code changes.

## Continuation Policy
Auto-continue if replacement is clearly drop-in and tests pass.

## Agent Notes

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
`;
}

function generateOutdatedTaskBody(
  id: string,
  outdated: { package: string; current: string; latest: string },
): string {
  return `# ${id}: Update ${outdated.package} from ${outdated.current} to ${outdated.latest}

## Goal

Update \`${outdated.package}\` to the latest compatible version.

## Package

- Package: ${outdated.package}
- Current version: ${outdated.current}
- Target version: ${outdated.latest}
- Direct dependency: yes

## Scope

Allowed files/directories:
- package.json
- pnpm-lock.yaml

Disallowed files/directories:
- unrelated source files

## Acceptance Criteria

- [ ] Package is updated to target version.
- [ ] Lockfile is updated.
- [ ] No unrelated dependency churn.
- [ ] Relevant tests pass.

## Test / Verification Command
\`\`\`bash
pnpm install --frozen-lockfile
pnpm test
\`\`\`

## Risk Level
Low

## Human Intervention Required?
No

## Continuation Policy
Auto-continue if tests pass.

## Agent Notes

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
`;
}
