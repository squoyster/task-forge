import matter from "gray-matter";
import fs from "node:fs";
import { TaskSchema, type Task, STATUS } from "./task.js";
import { getTaskFilePath, getTaskStateDir, getRepoRoot } from "../util/paths.js";
import { logWarn } from "../util/logging.js";

export interface ParsedTask extends Task {
  body: string;
  filePath: string;
}

export function parseTaskFile(filePath: string): ParsedTask | null {
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = matter(content, { date: false } as Record<string, unknown>);

  const frontmatter = parsed.data as Record<string, unknown>;

  // Extract id from frontmatter or filename
  let id = frontmatter.id as string | undefined;
  if (!id) {
    const basename = filePath.split("/").pop()!.replace(".md", "");
    id = basename;
  }

  // Map frontmatter fields to schema fields
  const taskData: Record<string, unknown> = {
    id,
    type: frontmatter.type ?? "Task",
    status: frontmatter.status ?? STATUS.INBOX,
    priority: frontmatter.priority ?? "P2",
    agentRole: frontmatter.agentRole ?? frontmatter.agent_role,
    riskLevel: frontmatter.riskLevel ?? frontmatter.risk_level ?? "Low",
    humanInterventionRequired:
      frontmatter.humanInterventionRequired ??
      frontmatter.human_intervention_required ??
      false,
    dependsOn: frontmatter.dependsOn,
    assignee: frontmatter.assignee as string | undefined,
    claimed_at: frontmatter.claimed_at as string | Date | undefined,
    blocked_reason: frontmatter.blocked_reason as string | undefined,
    blocked_by: frontmatter.blocked_by as string | undefined,
    blocked_since: frontmatter.blocked_since as string | Date | undefined,
    block_category: frontmatter.block_category as string | undefined,
    context_hash: frontmatter.context_hash as string | undefined,
    branch: frontmatter.branch,
    worktree: frontmatter.worktree,
    issue: frontmatter.issue ? Number(frontmatter.issue) : undefined,
    pr: frontmatter.pr ? Number(frontmatter.pr) : undefined,
  };

  const result = TaskSchema.safeParse(taskData);
  if (!result.success) {
    logWarn(`Invalid task file ${filePath}: ${result.error.message}`);
    return null;
  }

  return {
    ...result.data,
    body: parsed.content,
    filePath,
  };
}

export function writeTaskFile(
  task: ParsedTask,
  body?: string,
): void {
  const frontmatter: Record<string, unknown> = {
    id: task.id,
    type: task.type,
    status: task.status,
    priority: task.priority,
    agentRole: task.agentRole,
    riskLevel: task.riskLevel,
    humanInterventionRequired: task.humanInterventionRequired,
    dependsOn: task.dependsOn,
    assignee: task.assignee,
    claimed_at: task.claimed_at,
    blocked_reason: task.blocked_reason,
    blocked_by: task.blocked_by,
    blocked_since: task.blocked_since,
    block_category: task.block_category,
    context_hash: task.context_hash,
    branch: task.branch,
    worktree: task.worktree,
    issue: task.issue,
    pr: task.pr,
  };

  // Remove undefined values — gray-matter can't serialize them
  for (const key of Object.keys(frontmatter)) {
    if (frontmatter[key] === undefined) {
      delete frontmatter[key];
    }
  }

  const content = matter.stringify(body ?? task.body, frontmatter);
  fs.writeFileSync(task.filePath, content, "utf-8");
}

export function updateTaskStatus(
  filePath: string,
  newStatus: string,
): ParsedTask | null {
  const task = parseTaskFile(filePath);
  if (!task) return null;

  task.status = newStatus as Task["status"];
  writeTaskFile(task);
  return task;
}

export function updateTaskIssue(
  filePath: string,
  issueNumber: number,
): ParsedTask | null {
  const task = parseTaskFile(filePath);
  if (!task) return null;

  task.issue = issueNumber;
  writeTaskFile(task);
  return task;
}

export function updateTaskLock(
  filePath: string,
  sessionId: string,
): ParsedTask | null {
  const task = parseTaskFile(filePath);
  if (!task) return null;

  task.assignee = sessionId;
  // Use a YAML-safe format: YYYY-MM-DD HH:MM:SS (not ISO, avoids YAML Date auto-parsing)
  const now = new Date();
  task.claimed_at = now.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
  writeTaskFile(task);
  return task;
}

export function clearTaskLock(
  filePath: string,
): ParsedTask | null {
  const task = parseTaskFile(filePath);
  if (!task) return null;

  task.assignee = undefined;
  task.claimed_at = undefined;
  writeTaskFile(task);
  return task;
}

export function appendAgentNote(
  filePath: string,
  date: string,
  role: string,
  notes: string[],
): void {
  const task = parseTaskFile(filePath);
  if (!task) return;

  const noteBlock = `\n### ${date} ${role}\n${notes.map((n) => `- ${n}`).join("\n")}`;

  // Find or create Agent Notes section
  if (task.body.includes("## Agent Notes")) {
    task.body = task.body.replace(
      /(## Agent Notes\n)/,
      `$1${noteBlock}\n`,
    );
  } else {
    task.body += `\n## Agent Notes\n${noteBlock}\n`;
  }

  writeTaskFile(task);
}

export function listTaskFiles(repoRoot?: string): string[] {
  const tasksDir = getTaskStateDir(repoRoot ?? getRepoRoot());
  if (!fs.existsSync(tasksDir)) return [];

  return fs
    .readdirSync(tasksDir)
    .filter((f) => f.endsWith(".md") && f !== "README.md" && f !== "TEMPLATE.md")
    .map((f) => `${tasksDir}/${f}`);
}

export function loadAllTasks(repoRoot?: string): ParsedTask[] {
  return listTaskFiles(repoRoot)
    .map((f) => parseTaskFile(f))
    .filter((t): t is ParsedTask => t !== null);
}

export function loadTaskById(id: string, repoRoot?: string): ParsedTask | null {
  const filePath = getTaskFilePath(repoRoot ?? getRepoRoot(), id);
  return parseTaskFile(filePath);
}

export function hasAcceptanceCriteriaSection(body: string): boolean {
  return /## Acceptance Criteria/i.test(body);
}

export function getNextId(repoRoot?: string): string {
  const tasks = loadAllTasks(repoRoot);
  const maxNum = tasks.reduce((max, t) => {
    const match = t.id.match(/-(\d+)$/);
    if (!match) return max;
    const num = parseInt(match[1], 10);
    return num > max ? num : max;
  }, 0);
  const next = maxNum + 1;
  return `TASK-${String(next).padStart(3, "0")}`;
}
