import fs from "node:fs";
import path from "node:path";
import { getRepoRoot, getTasksDir, getTaskforgeDir } from "../util/paths.js";
import {
  TASKFORGE_TEMPLATE,
  TASK_TEMPLATE,
  TASKS_README_TEMPLATE,
} from "../markdown/templates.js";
import { logSuccess, logInfo } from "../util/logging.js";

export async function cmdInit(): Promise<void> {
  const repoRoot = getRepoRoot();
  const tasksDir = getTasksDir(repoRoot);
  const taskforgeDir = getTaskforgeDir(repoRoot);

  // Create directories
  for (const dir of [tasksDir, taskforgeDir, path.join(repoRoot, "specs"), path.join(repoRoot, "docs", "decisions"), path.join(repoRoot, "logs", "taskforge")]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Create TASKFORGE.md if not exists
  const taskforgePath = path.join(repoRoot, "TASKFORGE.md");
  if (!fs.existsSync(taskforgePath)) {
    fs.writeFileSync(taskforgePath, TASKFORGE_TEMPLATE, "utf-8");
    logSuccess("Created TASKFORGE.md");
  } else {
    logInfo("TASKFORGE.md already exists");
  }

  // Create tasks/README.md if not exists
  const readmePath = path.join(tasksDir, "README.md");
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, TASKS_README_TEMPLATE, "utf-8");
    logSuccess("Created tasks/README.md");
  } else {
    logInfo("tasks/README.md already exists");
  }

  // Create tasks/TEMPLATE.md if not exists
  const templatePath = path.join(tasksDir, "TEMPLATE.md");
  if (!fs.existsSync(templatePath)) {
    fs.writeFileSync(templatePath, TASK_TEMPLATE, "utf-8");
    logSuccess("Created tasks/TEMPLATE.md");
  } else {
    logInfo("tasks/TEMPLATE.md already exists");
  }

  // Create default config
  const configPath = path.join(taskforgeDir, "config.json");
  if (!fs.existsSync(configPath)) {
    const config = {
      project: { name: path.basename(repoRoot), defaultBranch: "main" },
      tasks: { directory: "tasks", idPrefix: "TASK", template: "tasks/TEMPLATE.md" },
      worktrees: { root: "../worktrees", branchPrefix: "agent" },
      github: { enabled: false },
      opencode: { enabled: true, command: "opencode" },
      continuation: { autoContinue: true, maxTaskFixIterations: 3, allowDraftPr: true, allowCommit: true, allowPush: false },
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    logSuccess("Created .taskforge/config.json");
  } else {
    logInfo(".taskforge/config.json already exists");
  }

  logSuccess("\nTaskForge initialized successfully.");
  logInfo("Run 'taskforge next' to find the next task to work on.");
}
