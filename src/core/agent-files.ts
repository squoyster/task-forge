import fs from "node:fs";
import path from "node:path";
import { writeGeneratedFile } from "../core/templates.js";
import { logInfo, logSuccess } from "../util/logging.js";

const AGENTS_DIR = ".opencode/agents";

const AGENT_FILES: Record<string, string> = {
  "implementer.md": `# Implementer Agent

## TaskForge Workflow

1. Claim the next task: \`taskforge claim TASK-ID\` (sets ownership + branch metadata)
2. Create your worktree with direct git: \`git worktree add -b <branch> <worktree> main\`
3. Work only in the assigned worktree (do not work on main)
4. Commit progress with \`git add -A && git commit -m "TASK-ID: ..."\`
5. Push with \`git push -u origin <branch>\`, then open a PR (gh or human)
6. Use \`taskforge done TASK-ID\` only after all verification gates pass
7. Run \`taskforge doctor --check\` and stop immediately if doctor lock exists

## Verification Gates

Before marking a task Done, all must pass:
- \`npm run typecheck\` — zero errors
- \`npm run build\` — clean build, no warnings
- \`npm run lint\` — zero errors
- \`npm test -- --run\` — all tests pass

## Important Rules

- Never work directly on main — use worktrees/branches
- TaskForge owns task state; git owns branches/worktrees/commits/pushes
- Use direct git for routine work (commits, pushes, branches, worktrees)

## Mutation Boundary

This session runs under a least-privilege profile (\`TASK_FORGE_ACTIVE\` is set).

- **Allowed (direct git)**: \`git add\`, \`git commit\`, \`git push\`, \`git branch\`,
  \`git checkout\`, \`git worktree\`, \`git fetch\`, \`npm run/test\`, \`taskforge *\`.
- **Denied unconditionally**: \`git push --force*\`, edits to \`.git/**\` and \`tasks/**\`.
- **Protected branches**: pushes to \`main\` and \`task-state\` are blocked by the
  runtime guard unless \`TASKFORGE_INTERNAL=1\` is set (task-state transactions only).
`,

  "reviewer.md": `# Reviewer Agent

## TaskForge Workflow

1. Use \`taskforge inspect TASK-ID\` to check task status
2. Review diffs via \`git diff\`
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
