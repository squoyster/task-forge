import fs from "node:fs";
import path from "node:path";
import { getRepoRoot, getTaskforgeDir } from "../util/paths.js";
import {
  TASKFORGE_TEMPLATE,
  TASK_TEMPLATE,
  TASKS_README_TEMPLATE,
} from "../markdown/templates.js";
import { ensureTaskStateBranch } from "../core/git.js";
import { logSuccess, logInfo, logWarn } from "../util/logging.js";
import { getAdapter } from "../agent-frameworks/registry.js";
import { loadConfig } from "../core/config.js";
import { InitAuditLog } from "../core/init-audit.js";

interface FileSpec {
  path: string;
  label: string;
  content: string;
}

export interface InitOptions {
  force?: boolean;
  agentFramework?: string;
  policy?: "permissive" | "managed" | "locked-down";
  installHooks?: boolean;
  audit?: boolean;
  guard?: boolean;
  dryRun?: boolean;
  repair?: boolean;
}

export async function cmdInit(options: InitOptions = {}): Promise<void> {
  const repoRoot = getRepoRoot();
  const auditLog = new InitAuditLog(repoRoot);
  const config = loadConfig(repoRoot);
  const agentFramework = options.agentFramework ?? config.agentFramework.id ?? "auto";
  const policy = options.policy ?? config.agentFramework.policy ?? "managed";
  const installHooks = options.installHooks ?? config.agentFramework.installHooks ?? true;
  const audit = options.audit ?? config.agentFramework.audit ?? true;
  const guard = options.guard ?? config.agentFramework.guard ?? true;
  const dryRun = options.dryRun ?? false;
  const taskforgeDir = getTaskforgeDir(repoRoot);

  auditLog.record("init.start", "info", `framework=${agentFramework} policy=${policy} dryRun=${dryRun}`);

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
  auditLog.record("init.dirs", "success");

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
      auditLog.record("init.file", "success", file.label);
    } else {
      logInfo(`${file.label} already exists`);
      auditLog.record("init.file", "info", `${file.label} already exists`);
    }
  }

  // Create the task-state branch and worktree
  logInfo("Setting up task-state branch...");
  const stateDir = await ensureTaskStateBranch(repoRoot);
  logSuccess(`Task-state worktree at: ${stateDir}`);
  auditLog.record("init.task-state", "success", stateDir);

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
      auditLog.record("init.state-file", "success", file.label);
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
    auditLog.record("init.config", "success", `branch=${defaultBranch}`);
  } else {
    logInfo(".taskforge/config.json already exists");
  }

  // Agent framework initialization
  if (agentFramework !== "none") {
    logInfo(`\nInitializing agent framework: ${agentFramework} (policy: ${policy})`);
    await initAgentFramework(repoRoot, {
      agentFramework,
      policy,
      installHooks,
      audit,
      guard,
      dryRun,
    });
    auditLog.record("init.agent-framework", "success", `${agentFramework}/${policy}`);
  }

  auditLog.complete();
  logInfo(`Audit log: ${auditLog.getSummary()}`);
  logSuccess("\nTaskForge initialized successfully.");
  logInfo("Run 'taskforge next' to find the next task to work on.");
}

async function initAgentFramework(
  repoRoot: string,
  options: {
    agentFramework: string;
    policy: "permissive" | "managed" | "locked-down";
    installHooks: boolean;
    audit: boolean;
    guard: boolean;
    dryRun: boolean;
  },
): Promise<void> {
  let frameworkId = options.agentFramework;

  if (frameworkId === "auto") {
    const { opencodeAdapter } = await import("../agent-frameworks/opencode.js");
    const detection = await opencodeAdapter.detect(repoRoot);
    frameworkId = detection.detected ? "opencode" : "generic";
    logInfo(`Auto-detected framework: ${frameworkId}`);
  }

  const adapter = getAdapter(frameworkId);
  if (!adapter) {
    logWarn(`Unknown agent framework: ${frameworkId}. Available: ${["generic", "opencode"].join(", ")}`);
    return;
  }

  const ctx = {
    projectRoot: repoRoot,
    configPaths: [],
    policy: options.policy,
    installHooks: options.installHooks,
    audit: options.audit,
    guard: options.guard,
    dryRun: options.dryRun,
  };

  if (options.dryRun) {
    const plan = await adapter.plan(ctx);
    logInfo("\nDry run — files that would be created/updated:");
    for (const file of plan.files) {
      logInfo(`  [${file.action}] ${file.path} — ${file.description}`);
    }
  } else {
    await adapter.apply(ctx);
    logSuccess(`Agent framework ${adapter.displayName} initialized.`);
  }
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
