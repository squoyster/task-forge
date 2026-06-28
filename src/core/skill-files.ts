import path from "node:path";
import fs from "node:fs";
import { writeGeneratedFile } from "./templates.js";

/**
 * Canonical TaskForge agent skills. Installed identically by every framework
 * adapter so any compatible agent (OpenCode, Claude, generic) can operate
 * TaskForge faithfully without loading broad repository documentation.
 *
 * R-E01-003: skill bodies are concise, imperative, and do NOT duplicate the
 * dynamic command contract (status graph, command map, framework permissions).
 * They defer to JSON command output as the live contract.
 */

export const WORK_TASK_SKILL_MD = `---
name: taskforge-work-task
description: Use when selecting, claiming, executing, verifying, or completing a TaskForge task. Triggers on "next task", "claim TASK-", "work on TASK-", or when taskforge next --json is available and returns a ready task. Does NOT handle doctor-lock or state repair — use taskforge-recover-state for those.
---

# Work a TaskForge Task

Select, execute, and complete one task at a time. JSON output from TaskForge
commands is the live contract — follow it; do not rely on memorized status
graphs or command lists.

## Positive triggers
- "What's next?" / "next task" / "claim a task"
- A \`TASK-\` ID is referenced and needs action
- You just finished a task step and need the next action

## Negative triggers (use the other skill)
- \`.doctor-lock\` exists, validate-state fails, ownership conflict, stale agent
  → use \`taskforge-recover-state\`

## Workflow

1. Run \`taskforge next --json\`. Read \`taskId\`, \`status\`, \`branch\`,
   \`worktree\`, \`nextActions\` (ordered, executable), \`prohibitedActions\`,
   and \`guidance\` from the packet.

2. Follow \`nextActions\` in listed order. Each is an executable command with a
   reason. If an action says claim, run \`taskforge claim <TASK-ID> --json\`.

3. Create your worktree and branch with direct git (claim does not do this):
   \`\`\`
   git worktree add -b <branch> <worktree> <base>
   \`\`\`
   Use the \`branch\`/\`worktree\` values from the JSON.

4. Implement inside the worktree, staying within the task's allowed files.
   Run gates before completing:
   \`\`\`
   npm run typecheck && npm run lint && npm run build && npm test -- --run
   \`\`\`

5. Commit and push (direct git):
   \`\`\`
   git add -A && git commit -m "<TASK-ID>: <summary>"
   git push -u origin <branch>
   \`\`\`

6. Complete per the task's own Acceptance Criteria and Continuation Policy.
   Re-run \`taskforge inspect <TASK-ID> --json\` if unsure of next steps.

## Hard rules
- One task at a time. Release (\`taskforge release <TASK-ID>\`) before claiming
  another.
- Direct git for all repo mutations (commit, push, branch, worktree). Never
  rewrite published history. Never push to protected branches (main).
- Obey \`prohibitedActions\` from the JSON. They are enforced at runtime.
`;

export const RECOVER_STATE_SKILL_MD = `---
name: taskforge-recover-state
description: Use when TaskForge state is broken or locked — .doctor-lock present, validate-state fails, ownership conflict, stale agent, or taskforge next --json returns an error. Requires read-only diagnosis before any mutation. Triggers on "doctor lock", "state is invalid", "stuck task", "ownership conflict", "stale agent".
---

# Recover TaskForge State

Diagnose and repair TaskForge state failures: doctor-locks, invalid state,
ownership conflicts, and stale agents. Always diagnose read-only first; only
the Doctor may mutate state, and only with evidence.

## Positive triggers
- \`.doctor-lock\` file exists in the repo
- \`taskforge validate-state --json\` reports errors
- \`taskforge next --json\` returns an error or noop with no ready task
- Two agents claim the same task (ownership conflict)
- An agent is stale (heartbeat expired, lease lapsed)

## Negative triggers (use the work skill)
- Normal task selection, execution, or completion
  → use \`taskforge-work-task\`

## Recovery protocol

1. **Diagnose (read-only, before any mutation):**
   \`\`\`
   taskforge doctor --check --json
   taskforge validate-state --strict --json
   taskforge agents --stale --json
   \`\`\`
   Read the diagnostics. Do not modify anything yet.

2. **Acquire the doctor lock** (only if diagnosis confirms a repairable failure
   and you are the Doctor):
   \`\`\`
   TASKFORGE_ACTOR=doctor taskforge doctor --lock --reason "<evidence>"
   \`\`\`

3. **Apply the repair** indicated by the diagnostics:
   - Invalid transition or corrupt state → \`taskforge doctor --fix --json\`
   - Stale agent → \`taskforge agents --recover --json\`
   - Blocked task → unblock with evidence or escalate to a human

4. **Release the lock** only after \`validate-state --strict\` passes and stale
   agents are recovered:
   \`\`\`
   taskforge doctor --unlock --json
   \`\`\`

## Hard rules
- Diagnose before mutating. No blind fixes.
- Only the Doctor actor acquires or releases the lock.
- Do not release the lock until \`validate-state --strict\` passes.
- If the failure is unclear or evidence is missing, escalate to a human — do
  not improvise.
`;

export interface SkillSpec {
  /** Path relative to project root, e.g. ".agents/skills/taskforge-work-task/SKILL.md" */
  relativePath: string;
  content: string;
}

export const TASKFORGE_SKILLS: SkillSpec[] = [
  { relativePath: path.join(".agents", "skills", "taskforge-work-task", "SKILL.md"), content: WORK_TASK_SKILL_MD },
  { relativePath: path.join(".agents", "skills", "taskforge-recover-state", "SKILL.md"), content: RECOVER_STATE_SKILL_MD },
];

/**
 * Install both canonical skill files under `.agents/skills/`.
 * Idempotent: overwrites managed content with the canonical source, leaving
 * unmanaged neighboring skills untouched (AC #6).
 */
export function installSkillFiles(projectRoot: string, dryRun: boolean): void {
  for (const skill of TASKFORGE_SKILLS) {
    if (dryRun) continue;
    const filePath = path.join(projectRoot, skill.relativePath);
    writeGeneratedFile(filePath, skill.content);
  }
}

/** Plan entries for framework adapter `plan()` methods. */
export function getSkillFilePlanEntries(
  projectRoot: string,
): Array<{ path: string; action: "create" | "update"; description: string }> {
  return TASKFORGE_SKILLS.map((skill) => {
    const fullPath = path.join(projectRoot, skill.relativePath);
    return {
      path: skill.relativePath,
      action: fs.existsSync(fullPath) ? ("update" as const) : ("create" as const),
      description: "Portable TaskForge skill (cross-framework)",
    };
  });
}

/**
 * Drift diagnostic for a single managed skill. Structurally compatible with
 * DoctorIssue/DoctorRepair so adapters can spread it without mapping.
 */
export interface SkillFileDiagnostic {
  severity: "error" | "warn" | "info";
  code: string;
  message: string;
  relativePath: string;
}

/**
 * Detect drift of managed skill files (R-E03-002). A managed skill is healthy
 * when present with byte-identical canonical content. Drift classes:
 *  - SKILL_MISSING: file absent or unreadable.
 *  - SKILL_STALE:   present but content differs from canonical source.
 * Byte-equality implies valid frontmatter (canonical source is validated by
 * skill-files.test.ts), so no separate malformed class is needed.
 */
export function doctorSkillFiles(projectRoot: string): SkillFileDiagnostic[] {
  const diags: SkillFileDiagnostic[] = [];
  for (const skill of TASKFORGE_SKILLS) {
    const fullPath = path.join(projectRoot, skill.relativePath);
    if (!fs.existsSync(fullPath)) {
      diags.push({
        severity: "error",
        code: "SKILL_MISSING",
        message: `Managed skill missing: ${skill.relativePath} — run 'taskforge doctor --fix' to reinstall`,
        relativePath: skill.relativePath,
      });
      continue;
    }
    let content: string;
    try {
      content = fs.readFileSync(fullPath, "utf-8");
    } catch {
      diags.push({
        severity: "error",
        code: "SKILL_MISSING",
        message: `Managed skill unreadable: ${skill.relativePath}`,
        relativePath: skill.relativePath,
      });
      continue;
    }
    if (content !== skill.content) {
      diags.push({
        severity: "warn",
        code: "SKILL_STALE",
        message: `Managed skill drifted from canonical source: ${skill.relativePath}`,
        relativePath: skill.relativePath,
      });
    }
  }
  return diags;
}

/**
 * Idempotently repair managed skill drift (R-E03-002, R-E03-003). Reinstalls
 * ONLY the canonical managed files via installSkillFiles; unmanaged neighbors
 * are untouched. Returns one repair entry per detected drift; a no-drift call
 * returns [] and writes nothing.
 */
export function fixSkillFiles(projectRoot: string): Array<{ code: string; message: string }> {
  const diags = doctorSkillFiles(projectRoot);
  if (diags.length === 0) return [];
  installSkillFiles(projectRoot, false);
  return diags.map((d) => ({
    code: d.code,
    message: `Reinstalled ${d.relativePath} from canonical source`,
  }));
}
