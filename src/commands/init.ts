import fs from "node:fs";
import path from "node:path";
import { getRepoRoot, getTaskforgeDir } from "../util/paths.js";
import {
  TASKFORGE_TEMPLATE,
  TASK_TEMPLATE,
  TASKS_README_TEMPLATE,
} from "../markdown/templates.js";
import { ensureTaskStateBranch } from "../core/git.js";
import { logSuccess, logInfo } from "../util/logging.js";

interface FileSpec {
  path: string;
  label: string;
  content: string;
}

export async function cmdInit(_force = false): Promise<void> {
  const repoRoot = getRepoRoot();
  const taskforgeDir = getTaskforgeDir(repoRoot);

  // Create directories (skipped silently if present)
  const dirs = [
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

  // Create / recreate missing files in main repo
  const mainFiles: FileSpec[] = [
    {
      path: path.join(repoRoot, "TASKFORGE.md"),
      label: "TASKFORGE.md",
      content: TASKFORGE_TEMPLATE,
    },
  ];

  for (const file of mainFiles) {
    if (!fs.existsSync(file.path)) {
      fs.writeFileSync(file.path, file.content, "utf-8");
      logSuccess(`Created ${file.label}`);
    } else {
      logInfo(`${file.label} already exists`);
    }
  }

  // Create the task-state branch and worktree
  logInfo("Setting up task-state branch...");
  const stateDir = await ensureTaskStateBranch(repoRoot);
  logSuccess(`Task-state worktree at: ${stateDir}`);

  // Seed task-state worktree with template files
  const stateFiles: FileSpec[] = [
    {
      path: path.join(stateDir, "README.md"),
      label: "task-state/README.md",
      content: TASKS_README_TEMPLATE,
    },
    {
      path: path.join(stateDir, "TEMPLATE.md"),
      label: "task-state/TEMPLATE.md",
      content: TASK_TEMPLATE,
    },
  ];

  let hasNewStateFiles = false;
  for (const file of stateFiles) {
    if (!fs.existsSync(file.path)) {
      fs.writeFileSync(file.path, file.content, "utf-8");
      logSuccess(`Created ${file.label}`);
      hasNewStateFiles = true;
    } else {
      logInfo(`${file.label} already exists`);
    }
  }

  // Commit and push initial state
  if (hasNewStateFiles) {
    const { commitAndPushTaskState } = await import("../core/git.js");
    await commitAndPushTaskState(repoRoot, "chore: initialize task state");
  }

  // Migrate any existing task files from tasks/ to task-state/
  const tasksDir = path.join(repoRoot, "tasks");
  if (fs.existsSync(tasksDir)) {
    const migrated = migrateExistingTasks(tasksDir, stateDir);
    if (migrated > 0) {
      logSuccess(`Migrated ${migrated} task file(s) from tasks/ to task-state/`);
      const { commitAndPushTaskState } = await import("../core/git.js");
      await commitAndPushTaskState(repoRoot, "chore: migrate task files from tasks/ to task-state branch");
    }
  }

  // Create config (preserves existing)
  const configPath = path.join(taskforgeDir, "config.json");
  if (!fs.existsSync(configPath)) {
    let defaultBranch = "main";
    try {
      const git = await import("simple-git");
      const branchResult = await git.default(repoRoot).branch();
      defaultBranch = branchResult.current;
    } catch {
      // Not a git repo or other error — use sensible default
    }
    const config = {
      project: { name: path.basename(repoRoot), defaultBranch },
      tasks: { stateBranch: "task-state", stateDir: "../task-state", directory: "tasks", idPrefix: "TASK", template: "TEMPLATE.md" },
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

function migrateExistingTasks(tasksDir: string, stateDir: string): number {
  if (!fs.existsSync(tasksDir)) return 0;

  let count = 0;
  for (const entry of fs.readdirSync(tasksDir)) {
    if (!entry.endsWith(".md")) continue;
    if (entry === "README.md" || entry === "TEMPLATE.md") continue;

    const src = path.join(tasksDir, entry);
    const dest = path.join(stateDir, entry);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      count++;
    }
  }
  return count;
}
