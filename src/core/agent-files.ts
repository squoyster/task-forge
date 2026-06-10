import fs from "node:fs";
import path from "node:path";
import { writeGeneratedFile } from "../core/templates.js";
import { logInfo, logSuccess } from "../util/logging.js";

const AGENTS_DIR = ".opencode/agents";

const AGENT_FILES: Record<string, string> = {
  "implementer.md": `# Implementer Agent

## TaskForge Workflow

1. Start work with \`taskforge start TASK-ID\`
2. Work only in the assigned worktree (do not work on main)
3. Use \`taskforge checkpoint TASK-ID --message "..."\` instead of direct git commits
4. Use \`taskforge submit TASK-ID\` instead of direct git push
5. Use \`taskforge done TASK-ID\` only after all verification gates pass
6. Run \`taskforge doctor --check\` and stop immediately if doctor lock exists

## Verification Gates

Before marking a task Done, all must pass:
- \`npm run typecheck\` — zero errors
- \`npm run build\` — clean build, no warnings
- \`npm run lint\` — zero errors
- \`npm test -- --run\` — all tests pass

## Important Rules

- Never work directly on main — use worktrees/branches
- Never edit files under ../task-state/ directly — use TaskForge CLI
- Never run git directly — use taskforge facade commands

## Mutation Boundary

This session is running in a managed agent context (\`TASK_FORGE_ACTIVE\` is set).
The following restrictions are enforced:

- **Denied**: \`git commit\`, \`git push\`, \`git merge\`, \`git rebase\`, \`git cherry-pick\`,
  \`git reset\`, \`git branch -d/-D\`, \`git worktree add/remove\`, \`git update-ref\`,
  and direct edits to \`task-state/\` files.
- **Allowed**: \`git status\`, \`git diff\`, \`git log\`, \`git show\`, \`git branch\`,
  \`git rev-parse\`, \`git fetch\`, \`git ls-remote\`, and other read-only commands.
- **Override**: A Human or Doctor may authorise specific mutations via
  \`taskforge guard override TASK-ID COMMAND "reason"\` with a structured reason. Overrides are
  audited and time-limited.

If a command is blocked, use the suggested TaskForge replacement:
- \`git commit\` → \`taskforge checkpoint TASK-ID --message "..."\`
- \`git push\` → \`taskforge submit TASK-ID\`
- \`git branch -d/-D\` → \`taskforge done TASK-ID --delete-branch\`
- \`git worktree add\` → \`taskforge start TASK-ID\`
- \`git worktree remove\` → \`taskforge done TASK-ID --cleanup\`
`,

  "reviewer.md": `# Reviewer Agent

## TaskForge Workflow

1. Use \`taskforge inspect TASK-ID\` to check task status
2. Review diffs via \`taskforge diff TASK-ID\`
3. Prefer comments and findings over direct edits
4. Avoid direct mutation unless explicitly tasked
5. Report findings through TaskForge agent notes

## Review Checks

- Acceptance criteria met
- Scope compliance (no out-of-scope changes)
- Test coverage maintained
- No security regressions
- No breaking changes to configuration
`,

  "qa.md": `# QA Agent

## TaskForge Workflow

1. Run verification gates for the task
2. Report failures through TaskForge agent notes
3. Avoid changing production code unless explicitly tasked
4. Verify acceptance criteria are met

## Gate Checks

- TypeScript typecheck passes
- Lint passes
- Build succeeds
- All tests pass
- No new warnings introduced
`,

  "doctor.md": `# Doctor Agent

## Diagnostic Protocol

1. Run \`taskforge doctor --check\` first for diagnostics
2. If critical issues found, acquire doctor lock: \`TASKFORGE_ACTOR=doctor taskforge doctor --lock --reason "..."\`
3. Work the recovery task assigned by the doctor
4. Minimize direct task-state edits — prefer TaskForge commands
5. After repair, complete the recovery task: \`taskforge done TASK-ID\`
6. Doctor lock auto-removes on recovery task completion

## Doctor Permissions

Allowed read-only operations:
- \`git status\`, \`git diff\`, \`git log\`, \`git show\`, \`git fetch\`

Ask-gated operations (require approval):
- \`git pull\`, \`git commit\`, \`git push\`, \`git reset\`, \`git rebase\`

Denied unconditionally:
- \`git push --force\`

## Recovery Protocol

- Never force push to main or task-state
- Always go through the transaction layer for task-state changes
- Release doctor lock by completing the recovery task
- All normal agents resume automatically when lock is removed
`,
};

export function installAgentFiles(projectRoot: string, dryRun: boolean): void {
  const agentsDir = path.join(projectRoot, AGENTS_DIR);

  for (const [filename, content] of Object.entries(AGENT_FILES)) {
    const filePath = path.join(agentsDir, filename);

    if (dryRun) {
      logInfo(`Would ${fs.existsSync(filePath) ? "update" : "create"} ${AGENTS_DIR}/${filename}`);
      continue;
    }

    writeGeneratedFile(filePath, content);
  }

  if (!dryRun) {
    logSuccess(`Agent files installed in ${AGENTS_DIR}/`);
  }
}
