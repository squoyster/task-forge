import fs from "node:fs";
import path from "node:path";
import { getRepoRoot, getTasksDir, getTaskforgeDir } from "../util/paths.js";
import {
  TASKFORGE_TEMPLATE,
  TASK_TEMPLATE,
  TASKS_README_TEMPLATE,
} from "../markdown/templates.js";
import { logSuccess, logInfo } from "../util/logging.js";

interface FileSpec {
  path: string;
  label: string;
  content: string;
}

export async function cmdInit(_force = false): Promise<void> {
  const repoRoot = getRepoRoot();
  const tasksDir = getTasksDir(repoRoot);
  const taskforgeDir = getTaskforgeDir(repoRoot);

  // Create directories (skipped silently if present)
  const dirs = [
    tasksDir,
    taskforgeDir,
    path.join(repoRoot, "specs"),
    path.join(repoRoot, "docs", "decisions"),
    path.join(repoRoot, "logs", "taskforge"),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Create / recreate missing files
  const files: FileSpec[] = [
    {
      path: path.join(repoRoot, "TASKFORGE.md"),
      label: "TASKFORGE.md",
      content: TASKFORGE_TEMPLATE,
    },
    {
      path: path.join(tasksDir, "README.md"),
      label: "tasks/README.md",
      content: TASKS_README_TEMPLATE,
    },
    {
      path: path.join(tasksDir, "TEMPLATE.md"),
      label: "tasks/TEMPLATE.md",
      content: TASK_TEMPLATE,
    },
  ];

  for (const file of files) {
    if (!fs.existsSync(file.path)) {
      fs.writeFileSync(file.path, file.content, "utf-8");
      logSuccess(`Created ${file.label}`);
    } else {
      logInfo(`${file.label} already exists`);
    }
  }

  // Create config (preserves existing)
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
