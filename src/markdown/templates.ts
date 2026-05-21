export const TASK_TEMPLATE = `# {{id}}: {{title}}

## Type
{{type}}

## Status
{{status}}

## Priority
{{priority}}

## Human Owner
Optional.

## Agent Role
{{agentRole}}

## Goal
Describe the desired outcome.

## Background
Relevant context, constraints, prior decisions, and links.

## Scope
Allowed files/directories:
-

Disallowed files/directories:
-

## Acceptance Criteria
- [ ]

## Test / Verification Command
\`\`\`bash
# command here
\`\`\`

## Expected Output / Behavior
Describe expected result.

## Dependencies
None

## Risk Level
Low

## Risks
Known risks.

## Human Intervention Required?
No

## Continuation Policy
Auto-continue unless a stopping condition occurs.

## Agent Notes

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Test Log:
`;

export const TASKFORGE_TEMPLATE = `# TaskForge Autonomous Coding Board

A repo-centered task management and execution system for agentic software development.

## Core Mission

TaskForge exists to manage software work for an agentic coding team. It combines:

- A human-visible task board
- Repo-native Markdown task specifications
- Isolated agent workspaces using git worktrees
- Task branches and pull requests
- Automatic continuation policies
- Explicit human-intervention gates
- Project status summaries

## Operating Model

Three layers:

1. **Human-visible board** — GitHub Issues/Projects, Plane, Linear, Jira, or repo-native Markdown
2. **Repo-native task specs** — the execution contract (these Markdown files)
3. **Agent execution in isolated worktrees** — the isolation boundary

## Task Workflow

\`\`\`
Inbox → Needs Spec → Ready → In Progress → Review → Verify → Done
                         ↓
                      Blocked
\`\`\`

## CLI Commands

| Command | Description |
|---|---|
| \`taskforge init\` | Initialize TaskForge in this repo |
| \`taskforge next\` | Return highest-priority safe task |
| \`taskforge start TASK-123\` | Set up worktree, branch, begin task |
| \`taskforge status\` | Show project status summary |
| \`taskforge summary\` | Show full project summary |
| \`taskforge block TASK-123 "reason"\` | Mark task as blocked |
| \`taskforge done TASK-123\` | Mark task as done |

See the full specification for agent roles, continuation policy, and integration details.
`;

export const TASKS_README_TEMPLATE = `# TaskForge Tasks

This directory contains repo-native task specifications for TaskForge Autonomous Coding Board.

The external project board is for visibility. These Markdown files are the agent execution contracts.

## Status Flow

\`\`\`
Inbox → Needs Spec → Ready → In Progress → Review → Verify → Done
                         ↓
                      Blocked
\`\`\`

## Rules

- Agents may only implement tasks in \`Ready\` or \`In Progress\`.
- Vague items must be converted into agent-ready specs before implementation.
- Each implementation task should use its own branch.
- Use git worktrees by default.
- Update Agent Notes before ending a session.
- Do not mark Done without verification.
- Stop for human input only when required by the Human Intervention policy in \`TASKFORGE.md\`.
`;

export const DEP_TASK_TEMPLATE = `---
id: {{id}}
type: Dependency
status: Ready
priority: P2
agentRole: Dependency Steward
riskLevel: Low
humanInterventionRequired: false
package:
  name: {{packageName}}
  ecosystem: npm
  currentVersion: {{currentVersion}}
  targetVersion: {{targetVersion}}
---

# {{id}}: Update {{packageName}} from {{currentVersion}} to {{targetVersion}}

## Goal

Update \`{{packageName}}\` to the latest compatible version.

## Package

- Package: {{packageName}}
- Ecosystem: npm
- Current version: {{currentVersion}}
- Target version: {{targetVersion}}
- Direct dependency: yes

## Scope

Allowed files/directories:
- package.json
- pnpm-lock.yaml
- package-lock.json
- yarn.lock

Disallowed files/directories:
- unrelated source files

## Acceptance Criteria

- [ ] Package is updated to the selected target version.
- [ ] Lockfile is updated.
- [ ] No unrelated dependency churn.
- [ ] Relevant tests pass.
- [ ] Audit/scanner no longer reports the finding, or residual risk is documented.
- [ ] PR summary explains the finding and remediation.

## Test / Verification Command
\`\`\`bash
pnpm install --frozen-lockfile
pnpm test
pnpm audit
\`\`\`

## Risk Level
Low

## Human Intervention Required?
No

## Continuation Policy
Auto-continue for low-risk patch/minor updates if tests pass.

## Agent Notes

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Advisory:
`;

export const SEC_TASK_TEMPLATE = `---
id: {{id}}
type: Security
status: Ready
priority: P1
agentRole: Dependency Steward
riskLevel: High
humanInterventionRequired: false
package:
  name: {{packageName}}
  ecosystem: npm
  currentVersion: {{currentVersion}}
  targetVersion: {{targetVersion}}
  advisory: {{advisory}}
  cve: {{cve}}
  ghsa: {{ghsa}}
  directDependency: true
---

# {{id}}: Remediate vulnerability in {{packageName}}

## Goal

Remediate the known vulnerability affecting \`{{packageName}}\`.

## Vulnerability Summary

- Package: {{packageName}}
- Ecosystem: npm
- Current version: {{currentVersion}}
- Fixed version: {{targetVersion}}
- Advisory: {{advisory}}
- CVE: {{cve}}
- GHSA: {{ghsa}}
- Direct dependency: yes

## Impact

Describe the likely impact in this repository.

Separate confirmed impact from inferred impact.

## Remediation Plan

Preferred remediation:

1. Update to the minimum fixed compatible version.
2. Refresh lockfile.
3. Run audit/scanner.
4. Run relevant tests.
5. Open focused PR.

Fallback remediation:

- Override/resolution if transitive and safe.
- Replace package if no safe fixed version exists.
- Mark blocked if human decision is required.

## Scope

Allowed files/directories:
- package.json
- pnpm-lock.yaml
- package-lock.json
- yarn.lock
- tests/**

## Acceptance Criteria

- [ ] Vulnerability no longer appears in OSV/package-manager audit, or residual finding is documented.
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

## Human Intervention Required?
No unless the remediation requires a major upgrade, package replacement, architecture change, paid service, license change, or broad migration.

## Continuation Policy
Auto-continue for low-risk patch/minor updates if tests pass. Stop for human intervention on high-risk cases.

## Agent Notes

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Advisory:
`;
