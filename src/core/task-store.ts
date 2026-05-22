import matter from "gray-matter";
import fs from "node:fs";
import { TaskSchema, type Task } from "./task.js";
import { getTaskFilePath, getTasksDir, getRepoRoot } from "../util/paths.js";
import { logWarn } from "../util/logging.js";

export interface ParsedTask extends Task {
  body: string;
  filePath: string;
}

export function parseTaskFile(filePath: string): ParsedTask | null {
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = matter(content);

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
    status: frontmatter.status ?? "Inbox",
    priority: frontmatter.priority ?? "P2",
    agentRole: frontmatter.agentRole ?? frontmatter.agent_role,
    riskLevel: frontmatter.riskLevel ?? frontmatter.risk_level ?? "Low",
    humanInterventionRequired:
      frontmatter.humanInterventionRequired ??
      frontmatter.human_intervention_required ??
      false,
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
  const tasksDir = getTasksDir(repoRoot ?? getRepoRoot());
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
