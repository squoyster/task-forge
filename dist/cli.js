#!/usr/bin/env node
import {
  opencodeAdapter
} from "./chunk-K4MANGZW.js";
import {
  ACTIVE_STATUSES,
  ALL_STATUSES,
  ForceRequiresHumanOrDoctorError,
  STATUS,
  appendAgentNote,
  assertCanForce,
  blockedResult,
  clearTaskLock,
  doctorRequiredResult,
  failedResult,
  getForceRejectionNextActions,
  getNextId,
  getValidNextCommands,
  hasAcceptanceCriteriaSection,
  hasBlankAcceptanceCriteria,
  hasUncheckedAcceptanceCriteria,
  loadAllTasks,
  loadTaskById,
  noopResult,
  normalizeStatus,
  parseTaskFile,
  renderResultJson,
  renderResultMarkdown,
  resolveAuthority,
  successResult,
  updateTaskIssue,
  updateTaskStatus,
  validateTaskState,
  writeResult,
  writeTaskFile
} from "./chunk-EG2PFJX7.js";
import {
  checkUncommittedWorktrees,
  commitAndPushTaskState,
  createWorktree,
  ensureTaskStateBranch,
  getBranchCommitsAhead,
  getCurrentBranch,
  getWorktreeDirtyFiles,
  listWorktrees,
  pullTaskState,
  removeBranch,
  removeWorktree
} from "./chunk-RYDMXDO2.js";
import {
  installAgentsMd,
  loadConfig
} from "./chunk-QBLAIQUG.js";
import {
  installOpenCodeConfig
} from "./chunk-F6MGWUO6.js";
import {
  checkHooks,
  run
} from "./chunk-SNMMMNDR.js";
import {
  DENIED_GIT_COMMANDS,
  READ_ONLY_GIT_COMMANDS,
  checkMutationAllowed,
  isManagedSession,
  recordOverride
} from "./chunk-AYOSERB3.js";
import {
  getRepoRoot,
  getTaskStateDir,
  getTaskforgeDir,
  getWorktreePath,
  makeBranchName
} from "./chunk-46G2ACH2.js";
import {
  hasManagedBlock
} from "./chunk-5JWCMI7A.js";
import {
  logDivider,
  logError,
  logHeader,
  logInfo,
  logSub,
  logSuccess,
  logWarn
} from "./chunk-OPCWHN3N.js";

// src/cli.ts
import { Command } from "commander";

// src/commands/init.ts
import fs2 from "fs";
import path2 from "path";

// src/markdown/templates.ts
var TASK_TEMPLATE = `# {{id}}: {{title}}

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
var TASKFORGE_TEMPLATE = `# TaskForge Autonomous Coding Board

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

1. **Human-visible board** \u2014 GitHub Issues/Projects, Plane, Linear, Jira, or repo-native Markdown
2. **Repo-native task specs** \u2014 the execution contract (these Markdown files)
3. **Agent execution in isolated worktrees** \u2014 the isolation boundary

## Task Workflow

\`\`\`
Inbox \u2192 Needs Spec \u2192 Ready \u2192 In Progress \u2192 Review \u2192 Verify \u2192 Done
                         \u2193
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
var TASKS_README_TEMPLATE = `# TaskForge Tasks

This directory contains repo-native task specifications for TaskForge Autonomous Coding Board.

The external project board is for visibility. These Markdown files are the agent execution contracts.

## Status Flow

\`\`\`
Inbox \u2192 Needs Spec \u2192 Ready \u2192 In Progress \u2192 Review \u2192 Verify \u2192 Done
                         \u2193
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

// src/agent-frameworks/generic.ts
var genericAdapter = {
  id: "generic",
  displayName: "Generic (CLI-Only)",
  async detect(_projectRoot) {
    return { detected: true, frameworkId: "generic", configPaths: [] };
  },
  async plan(_ctx) {
    return { files: [] };
  },
  async apply(_ctx) {
  },
  async doctor(_ctx) {
    return [{ severity: "pass", check: "generic-adapter", message: "Generic adapter is always available." }];
  }
};

// src/agent-frameworks/registry.ts
var builtinAdapters = [genericAdapter, opencodeAdapter];
var customAdapters = [];
function getAdapter(id) {
  return [...builtinAdapters, ...customAdapters].find((a) => a.id === id);
}

// src/core/init-audit.ts
import fs from "fs";
import path from "path";
import os from "os";
var SECRET_PATTERNS = [
  /ghp_[a-zA-Z0-9]{36,}/g,
  /gho_[a-zA-Z0-9]{36,}/g,
  /github_pat_[a-zA-Z0-9_]{40,}/g,
  /(?:api[_-]?key|token|secret|password|passwd|auth)\s*[:=]\s*\S+/gi,
  /\b[a-f0-9]{40}\b/g
];
function elide(text) {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}
function getAuditDir(repoRoot) {
  return path.join(repoRoot, "logs", "taskforge", "audit");
}
function getAuditPath(repoRoot) {
  const dir = getAuditDir(repoRoot);
  const date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  return path.join(dir, `init-${date}.jsonl`);
}
var InitAuditLog = class {
  repoRoot;
  entries = [];
  sessionStart;
  constructor(repoRoot) {
    this.repoRoot = repoRoot;
    this.sessionStart = Date.now();
  }
  record(step, outcome, detail) {
    const entry = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      step,
      outcome,
      detail: detail ? elide(detail) : void 0,
      durationMs: Date.now() - this.sessionStart
    };
    this.entries.push(entry);
  }
  flush() {
    const auditPath = getAuditPath(this.repoRoot);
    const dir = path.dirname(auditPath);
    fs.mkdirSync(dir, { recursive: true });
    const hostname = os.hostname();
    const line = JSON.stringify({
      hostname,
      sessionStart: new Date(this.sessionStart).toISOString(),
      entries: this.entries
    }) + "\n";
    fs.appendFileSync(auditPath, line, "utf-8");
  }
  complete() {
    this.record("init.complete", "success");
    this.flush();
  }
  getSummary() {
    const successCount = this.entries.filter((e) => e.outcome === "success").length;
    const warnCount = this.entries.filter((e) => e.outcome === "warning").length;
    const errorCount = this.entries.filter((e) => e.outcome === "error").length;
    return `${this.entries.length} steps: ${successCount} success, ${warnCount} warnings, ${errorCount} errors`;
  }
};

// src/commands/init.ts
async function cmdInit(options = {}) {
  const opts = typeof options === "boolean" ? { force: options } : options;
  const repoRoot = getRepoRoot();
  const auditLog = new InitAuditLog(repoRoot);
  const config = loadConfig(repoRoot);
  if (opts.force) {
    const authority = resolveAuthority();
    try {
      assertCanForce(authority);
    } catch {
      const nextCommands = getForceRejectionNextActions().map((a) => ({
        command: a.command,
        purpose: a.reason,
        priority: a.preferred ? 1 : 2,
        when: "needs:human",
        allowedFor: a.safety === "safe" ? "all" : "human"
      }));
      if (opts.json) {
        writeResult(failedResult({ command: "init", error: "Normal agents may not use --force.", code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR", nextCommands }), opts.json);
        return;
      }
      logError("Normal agents may not use --force. Use 'taskforge doctor --json' or block for human authorization.");
      return;
    }
  }
  const agentFramework = opts.agentFramework ?? config.agentFramework.id ?? "auto";
  const policy = opts.policy ?? config.opencode.policy ?? "managed";
  const installHooks = opts.installHooks ?? config.agentFramework.installHooks ?? true;
  const audit = opts.audit ?? config.opencode.audit ?? true;
  const guard2 = opts.guard ?? config.opencode.guard ?? true;
  const dryRun = opts.dryRun ?? false;
  const taskforgeDir = getTaskforgeDir(repoRoot);
  auditLog.record("init.start", "info", `framework=${agentFramework} policy=${policy} dryRun=${dryRun}`);
  const dirs = [
    taskforgeDir,
    path2.join(repoRoot, "specs"),
    path2.join(repoRoot, "docs", "decisions"),
    path2.join(repoRoot, "logs", "taskforge")
  ];
  for (const dir of dirs) {
    if (!fs2.existsSync(dir)) {
      fs2.mkdirSync(dir, { recursive: true });
    }
  }
  auditLog.record("init.dirs", "success");
  const mainFiles = [
    {
      path: path2.join(repoRoot, "TASKFORGE.md"),
      label: "TASKFORGE.md",
      content: TASKFORGE_TEMPLATE
    }
  ];
  for (const file of mainFiles) {
    if (!fs2.existsSync(file.path)) {
      fs2.writeFileSync(file.path, file.content, "utf-8");
      logSuccess(`Created ${file.label}`);
      auditLog.record("init.file", "success", file.label);
    } else {
      logInfo(`${file.label} already exists`);
      auditLog.record("init.file", "info", `${file.label} already exists`);
    }
  }
  logInfo("Setting up task-state branch...");
  const stateDir = await ensureTaskStateBranch(repoRoot);
  logSuccess(`Task-state worktree at: ${stateDir}`);
  auditLog.record("init.task-state", "success", stateDir);
  const stateFiles = [
    {
      path: path2.join(stateDir, "README.md"),
      label: "task-state/README.md",
      content: TASKS_README_TEMPLATE
    },
    {
      path: path2.join(stateDir, "TEMPLATE.md"),
      label: "task-state/TEMPLATE.md",
      content: TASK_TEMPLATE
    }
  ];
  let hasNewStateFiles = false;
  for (const file of stateFiles) {
    if (!fs2.existsSync(file.path)) {
      fs2.writeFileSync(file.path, file.content, "utf-8");
      logSuccess(`Created ${file.label}`);
      hasNewStateFiles = true;
      auditLog.record("init.state-file", "success", file.label);
    } else {
      logInfo(`${file.label} already exists`);
    }
  }
  if (hasNewStateFiles) {
    const { commitAndPushTaskState: commitAndPushTaskState2 } = await import("./git-P7MCGWA5.js");
    await commitAndPushTaskState2(repoRoot, "chore: initialize task state");
  }
  const tasksDir = path2.join(repoRoot, "tasks");
  if (fs2.existsSync(tasksDir)) {
    const migrated = migrateExistingTasks(tasksDir, stateDir);
    if (migrated > 0) {
      logSuccess(`Migrated ${migrated} task file(s) from tasks/ to task-state/`);
      const { commitAndPushTaskState: commitAndPushTaskState2 } = await import("./git-P7MCGWA5.js");
      await commitAndPushTaskState2(repoRoot, "chore: migrate task files from tasks/ to task-state branch");
    }
  }
  const configPath = path2.join(taskforgeDir, "config.json");
  if (!fs2.existsSync(configPath)) {
    let defaultBranch = "main";
    try {
      const git = await import("simple-git");
      const branchResult = await git.default(repoRoot).branch();
      defaultBranch = branchResult.current;
    } catch {
    }
    const config2 = {
      project: { name: path2.basename(repoRoot), defaultBranch },
      tasks: { stateBranch: "task-state", stateDir: "../task-state", directory: "tasks", idPrefix: "TASK", template: "TEMPLATE.md" },
      worktrees: { root: "../worktrees", branchPrefix: "agent" },
      github: { enabled: false },
      opencode: { enabled: true, command: "opencode" },
      continuation: { autoContinue: true, maxTaskFixIterations: 3, allowDraftPr: true, allowCommit: true, allowPush: false }
    };
    fs2.writeFileSync(configPath, JSON.stringify(config2, null, 2), "utf-8");
    logSuccess("Created .taskforge/config.json");
    auditLog.record("init.config", "success", `branch=${defaultBranch}`);
  } else {
    logInfo(".taskforge/config.json already exists");
  }
  if (agentFramework !== "none") {
    logInfo(`
Initializing agent framework: ${agentFramework} (policy: ${policy})`);
    await initAgentFramework(repoRoot, {
      agentFramework,
      policy,
      installHooks,
      audit,
      guard: guard2,
      dryRun
    });
    auditLog.record("init.agent-framework", "success", `${agentFramework}/${policy}`);
  }
  auditLog.complete();
  logInfo(`Audit log: ${auditLog.getSummary()}`);
  logSuccess("\nTaskForge initialized successfully.");
  logInfo("Run 'taskforge next' to find the next task to work on.");
  writeResult(successResult({
    command: "init",
    guidance: "TaskForge initialized successfully. Run 'taskforge next' to find the next task to work on."
  }), opts.json ?? false);
}
async function initAgentFramework(repoRoot, options) {
  let frameworkId = options.agentFramework;
  if (frameworkId === "auto") {
    const { opencodeAdapter: opencodeAdapter2 } = await import("./opencode-V53MEGGL.js");
    const detection = await opencodeAdapter2.detect(repoRoot);
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
    dryRun: options.dryRun
  };
  if (options.dryRun) {
    const plan = await adapter.plan(ctx);
    logInfo("\nDry run \u2014 files that would be created/updated:");
    for (const file of plan.files) {
      logInfo(`  [${file.action}] ${file.path} \u2014 ${file.description}`);
    }
  } else {
    await adapter.apply(ctx);
    logSuccess(`Agent framework ${adapter.displayName} initialized.`);
  }
}
function migrateExistingTasks(tasksDir, stateDir) {
  if (!fs2.existsSync(tasksDir)) return 0;
  let count = 0;
  for (const entry of fs2.readdirSync(tasksDir)) {
    if (!entry.endsWith(".md")) continue;
    if (entry === "README.md" || entry === "TEMPLATE.md") continue;
    const src = path2.join(tasksDir, entry);
    const dest = path2.join(stateDir, entry);
    if (!fs2.existsSync(dest)) {
      fs2.copyFileSync(src, dest);
      count++;
    }
  }
  return count;
}

// src/core/scheduler.ts
var STATUS_PRIORITY = {
  [STATUS.IN_PROGRESS]: 7,
  [STATUS.VERIFY]: 6,
  [STATUS.REVIEW]: 5,
  [STATUS.READY]: 4,
  [STATUS.BLOCKED]: 0,
  [STATUS.INBOX]: 0,
  [STATUS.NEEDS_SPEC]: 0,
  [STATUS.DONE]: 0,
  [STATUS.REJECTED]: 0,
  [STATUS.DEFERRED]: 0
};
var PRIORITY_WEIGHT = {
  P0: 40,
  P1: 30,
  P2: 20,
  P3: 10
};
function scoreTask(task) {
  const statusScore = STATUS_PRIORITY[task.status] ?? 0;
  const priorityScore = PRIORITY_WEIGHT[task.priority] ?? 0;
  return statusScore * 100 + priorityScore;
}
function hasUnmetDependencies(task, allTasks) {
  if (!task.dependsOn || task.dependsOn.length === 0) return [];
  const unmet = [];
  for (const depId of task.dependsOn) {
    const dep = allTasks.find((t) => t.id === depId);
    if (!dep) {
      unmet.push(depId);
    } else if (dep.status !== STATUS.DONE && dep.status !== STATUS.REJECTED && dep.status !== STATUS.DEFERRED) {
      unmet.push(depId);
    }
  }
  return unmet;
}
function getDependents(taskId, allTasks) {
  return allTasks.filter(
    (t) => t.dependsOn && t.dependsOn.includes(taskId)
  );
}
function detectCircularDependencies(tasks) {
  const cycles = [];
  const visited = /* @__PURE__ */ new Set();
  const inStack = /* @__PURE__ */ new Set();
  function dfs(nodeId, path17) {
    if (inStack.has(nodeId)) {
      const cycleStart = path17.indexOf(nodeId);
      const cycle = [...path17.slice(cycleStart), nodeId];
      cycles.push(`Circular dependency: ${cycle.join(" \u2192 ")}`);
      return;
    }
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    inStack.add(nodeId);
    path17.push(nodeId);
    const task = tasks.find((t) => t.id === nodeId);
    if (task?.dependsOn) {
      for (const depId of task.dependsOn) {
        if (tasks.some((t) => t.id === depId)) {
          dfs(depId, path17);
        }
      }
    }
    path17.pop();
    inStack.delete(nodeId);
  }
  for (const task of tasks) {
    if (!visited.has(task.id)) {
      dfs(task.id, []);
    }
  }
  return cycles;
}
function warnOnCircularDependencies(tasks) {
  const cycles = detectCircularDependencies(tasks);
  for (const cycle of cycles) {
    logWarn(cycle);
  }
}
function selectNextTask(tasks) {
  warnOnCircularDependencies(tasks);
  const actionable = tasks.filter(
    (t) => ACTIVE_STATUSES.includes(t.status) && hasUnmetDependencies(t, tasks).length === 0
  );
  if (actionable.length === 0) return null;
  actionable.sort((a, b) => scoreTask(b) - scoreTask(a));
  return actionable[0];
}

// src/core/task-state-transaction.ts
import { execa } from "execa";
import simpleGit from "simple-git";

// src/core/event-log.ts
import fs3 from "fs";
import path3 from "path";
function getEventsDir(repoRoot) {
  return path3.join(getTaskStateDir(repoRoot ?? getRepoRoot()), "events");
}
function getEventLogPath(taskId, repoRoot) {
  return path3.join(getEventsDir(repoRoot), `${taskId}.ndjson`);
}
function appendEvent(taskId, event, repoRoot) {
  const eventsDir = getEventsDir(repoRoot);
  fs3.mkdirSync(eventsDir, { recursive: true });
  const logPath = getEventLogPath(taskId, repoRoot);
  const line = JSON.stringify(event) + "\n";
  fs3.appendFileSync(logPath, line, "utf-8");
}
function eventLogEvent(taskId, eventName, extra = {}, repoRoot) {
  appendEvent(taskId, {
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    actor: extra.sessionId ? `agent:${extra.sessionId}` : "agent:implementer",
    event: eventName,
    ...extra
  }, repoRoot);
}

// src/core/status-transition.ts
var TRANSITIONS = {
  [STATUS.INBOX]: [STATUS.NEEDS_SPEC, STATUS.REJECTED],
  [STATUS.NEEDS_SPEC]: [STATUS.READY, STATUS.DEFERRED],
  [STATUS.READY]: [STATUS.IN_PROGRESS, STATUS.BLOCKED, STATUS.DEFERRED],
  [STATUS.IN_PROGRESS]: [
    STATUS.IMPLEMENTATION_COMPLETE,
    STATUS.BLOCKED,
    STATUS.DEFERRED
  ],
  [STATUS.BLOCKED]: [STATUS.READY, STATUS.IN_PROGRESS],
  [STATUS.IMPLEMENTATION_COMPLETE]: [
    STATUS.IN_PROGRESS,
    STATUS.SUBMITTED,
    STATUS.REVIEW,
    STATUS.BLOCKED,
    STATUS.DEFERRED
  ],
  [STATUS.SUBMITTED]: [
    STATUS.IMPLEMENTATION_COMPLETE,
    STATUS.REVIEW,
    STATUS.MERGE_READY,
    STATUS.BLOCKED,
    STATUS.DEFERRED
  ],
  [STATUS.REVIEW]: [
    STATUS.SUBMITTED,
    STATUS.MERGE_READY,
    STATUS.BLOCKED,
    STATUS.DEFERRED
  ],
  [STATUS.MERGE_READY]: [
    STATUS.REVIEW,
    STATUS.VERIFY,
    STATUS.BLOCKED,
    STATUS.DEFERRED
  ],
  [STATUS.VERIFY]: [
    STATUS.MERGE_READY,
    STATUS.DONE,
    STATUS.BLOCKED,
    STATUS.DEFERRED
  ],
  [STATUS.DONE]: [STATUS.IN_PROGRESS],
  [STATUS.REJECTED]: [],
  [STATUS.DEFERRED]: [STATUS.READY]
};
function isValidTransition(from, to) {
  const allowed = TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}
function getAllowedTransitions(from) {
  return TRANSITIONS[from] ?? [];
}
function validateTransition(from, to) {
  if (isValidTransition(from, to)) return null;
  const allowed = getAllowedTransitions(from);
  if (allowed.length === 0) {
    return `Cannot transition from "${from}" \u2014 terminal state`;
  }
  return `Cannot transition from "${from}" to "${to}". Allowed: ${allowed.join(", ")}`;
}

// src/core/task-state-transaction.ts
var TransactionImpl = class {
  tasks = /* @__PURE__ */ new Map();
  notesAppended = /* @__PURE__ */ new Map();
  modified = false;
  modifiedTaskIds = /* @__PURE__ */ new Set();
  actor;
  command;
  constructor(tasks, actor, command) {
    for (const t of tasks) {
      this.tasks.set(t.id, t);
    }
    this.actor = actor;
    this.command = command;
  }
  loadTask(id) {
    return this.tasks.get(id) ?? null;
  }
  loadAllTasks() {
    return [...this.tasks.values()];
  }
  /** Return only the tasks that were modified during this transaction.
   *  If no tasks were modified, returns all tasks (defensive fallback). */
  getModifiedTasks() {
    if (this.modifiedTaskIds.size === 0) {
      return [...this.tasks.values()];
    }
    const result = [];
    for (const id of this.modifiedTaskIds) {
      const task = this.tasks.get(id);
      if (task) result.push(task);
    }
    return result;
  }
  updateTask(task) {
    this.tasks.set(task.id, task);
    this.modified = true;
    this.modifiedTaskIds.add(task.id);
  }
  appendNote(taskId, role, notes) {
    const existing = this.notesAppended.get(taskId) ?? [];
    this.notesAppended.set(taskId, [...existing, ...notes]);
  }
  appendEvent(taskId, event, data) {
    eventLogEvent(taskId, event, {
      ...data,
      sessionId: this.actor,
      command: this.command
    });
  }
  assertCanTransition(task, targetStatus) {
    const err = validateTransition(task.status, targetStatus);
    if (err) throw new Error(err);
  }
  claimTask(taskId, sessionId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    task.assignee = sessionId;
    task.claimed_at = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
    if (task.status === STATUS.READY) task.status = STATUS.IN_PROGRESS;
    this.modified = true;
    this.modifiedTaskIds.add(taskId);
  }
  clearClaim(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.assignee = void 0;
    task.claimed_at = void 0;
    this.modified = true;
    this.modifiedTaskIds.add(taskId);
  }
  commit(stateDir, message) {
    return this.persistAndCommit(stateDir, message);
  }
  async persistAndCommit(stateDir, message) {
    if (!this.modified) return;
    for (const task of this.tasks.values()) {
      writeTaskFile(task);
    }
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    for (const [taskId, notes] of this.notesAppended) {
      const task = this.tasks.get(taskId);
      if (task) {
        appendAgentNote(task.filePath, today, "System", notes);
      }
    }
    const git = simpleGit(stateDir);
    await git.add(".");
    await git.commit(message);
  }
};
async function withTaskStateTransaction(options, mutate) {
  const root = options.repoRoot ?? getRepoRoot();
  const stateDir = getTaskStateDir(root);
  const maxRetries = options.maxRetries ?? 3;
  const jitterMin = options.jitterMinMs ?? 2e3;
  const jitterMax = options.jitterMaxMs ?? 1e4;
  const command = options.command ?? "mutate";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await execa("git", ["pull", "--rebase", "origin", "task-state"], { cwd: stateDir });
    } catch {
    }
    const tasks = loadAllTasks(root);
    const actor = options.actor ?? "system";
    const tx = new TransactionImpl(tasks, actor, command);
    const result = await mutate(tx);
    const modifiedTasks = tx.getModifiedTasks();
    const allTasks = tx.loadAllTasks();
    const validation = validateTaskState(modifiedTasks, allTasks);
    if (!validation.ok) {
      const details = validation.errors.map((e) => `[${e.code}] ${e.message}${e.taskId ? ` (${e.taskId})` : ""}`).join("; ");
      throw new Error(`Transaction aborted: invalid task-state \u2014 ${details}`);
    }
    try {
      await tx.commit(stateDir, `chore: ${command}`);
    } catch (e) {
      if (attempt >= maxRetries) throw e;
      logWarn(`Transaction commit failed (attempt ${attempt + 1}): ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    try {
      await execa("git", ["push", "origin", "task-state"], { cwd: stateDir });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();
      if (lower.includes("non-fast-forward") || lower.includes("rejected") || lower.includes("fetch first")) {
        if (attempt >= maxRetries) throw err;
        const delay = jitterMin + Math.floor(Math.random() * (jitterMax - jitterMin + 1));
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Transaction failed after ${maxRetries} retries`);
}

// src/core/sweeper.ts
var STALE_THRESHOLD_MS = 4 * 60 * 60 * 1e3;
function parseClaimedAt(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }
  const str = value;
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    const [, year, month, day, hour, min, sec] = match.map(Number);
    return new Date(Date.UTC(year, month - 1, day, hour, min, sec));
  }
  const iso = Date.parse(str);
  if (!isNaN(iso)) return new Date(iso);
  return null;
}
async function sweepStaleTasks(repoRoot, options) {
  const root = repoRoot ?? getRepoRoot();
  const now = options?.now ?? /* @__PURE__ */ new Date();
  const threshold = options?.staleThresholdMs ?? STALE_THRESHOLD_MS;
  const skipAssignee = options?.skipAssignee;
  const shouldCommit = options?.commit ?? true;
  const dryRun = options?.dryRun ?? false;
  const force = options?.force ?? false;
  const inspectTaskFn = options?.inspectTask;
  const tasks = loadAllTasks(root);
  const staleTasks = tasks.filter((t) => {
    if (t.status !== STATUS.IN_PROGRESS) return false;
    if (!t.assignee || !t.claimed_at) return false;
    if (skipAssignee && t.assignee === skipAssignee) return false;
    const claimedTime = parseClaimedAt(t.claimed_at);
    if (!claimedTime) return false;
    const age = now.getTime() - claimedTime.getTime();
    return age > threshold;
  });
  const swept = [];
  let changedCount = 0;
  for (const task of staleTasks) {
    const claimedTime = parseClaimedAt(task.claimed_at);
    const ageMs = now.getTime() - claimedTime.getTime();
    let action = "reset";
    let reason;
    if (!force && inspectTaskFn) {
      try {
        const insp = await inspectTaskFn(task, root);
        if (insp.dirty) {
          action = "skipped";
          reason = "dirty worktree \u2014 uncommitted changes";
        } else if (insp.aheadOfMain > 0) {
          action = "review";
          reason = `worktree has ${insp.aheadOfMain} commit(s) ahead of main \u2014 moving to Review`;
        }
      } catch {
      }
    }
    const entry = {
      id: task.id,
      previousAssignee: task.assignee,
      claimedAt: task.claimed_at,
      ageMs,
      filePath: task.filePath,
      action,
      reason
    };
    swept.push(entry);
    if (action === "skipped") continue;
    if (!dryRun) {
      if (action === "review") {
        updateTaskStatus(task.filePath, STATUS.REVIEW);
      } else {
        updateTaskStatus(task.filePath, STATUS.READY);
      }
      clearTaskLock(task.filePath);
      const today = now.toISOString().split("T")[0];
      const ageHours = (ageMs / (60 * 60 * 1e3)).toFixed(1);
      const actionLabel = action === "review" ? "moved to Review" : "reset to Ready";
      appendAgentNote(task.filePath, today, "System", [
        `Task swept by Sweeper Protocol \u2014 ${actionLabel}. Claim by "${task.assignee}" was ${ageHours}h old (threshold: 4h).` + (reason ? ` Reason: ${reason}` : "")
      ]);
    }
    changedCount++;
  }
  let pushed = true;
  if (!dryRun && swept.length > 0 && shouldCommit) {
    pushed = await withTaskStateTransaction(
      { command: `sweep ${swept.length} task(s)`, maxRetries: 3 },
      (tx) => {
        for (const s of swept) {
          if (s.action === "review") {
            const t = tx.loadTask(s.id);
            if (t) {
              t.status = STATUS.REVIEW;
              tx.updateTask(t);
              tx.clearClaim(s.id);
            }
          } else if (s.action === "reset") {
            const t = tx.loadTask(s.id);
            if (t) {
              t.status = STATUS.READY;
              tx.updateTask(t);
              tx.clearClaim(s.id);
            }
          }
        }
      }
    ).then(() => true).catch(() => false);
  }
  return {
    scanned: tasks.length,
    stale: swept,
    changed: changedCount,
    pushed,
    dryRun
  };
}

// src/core/session.ts
import crypto from "crypto";

// src/core/errors.ts
var TaskForgeError = class extends Error {
  code;
  exitCode;
  constructor(message, code = "TASKFORGE_ERROR", exitCode = 1) {
    super(message);
    this.name = "TaskForgeError";
    this.code = code;
    this.exitCode = exitCode;
  }
};
var TaskNotFoundError = class extends TaskForgeError {
  constructor(taskId) {
    super(`Task ${taskId} not found.`, "TASK_NOT_FOUND");
  }
};
var InvalidStatusTransitionError = class extends TaskForgeError {
  constructor(from, to, allowed) {
    super(
      `Cannot transition from "${from}" to "${to}". Allowed: ${allowed.join(", ")}`,
      "INVALID_STATUS_TRANSITION"
    );
  }
};
var WorktreeError = class extends TaskForgeError {
  constructor(message) {
    super(message, "WORKTREE_ERROR");
  }
};
var MissingAcceptanceCriteriaError = class extends TaskForgeError {
  constructor(taskId) {
    super(
      `Task ${taskId} cannot be marked Done: no "## Acceptance Criteria" section found. Add acceptance criteria to the task file before completing, or request clarification if the ACs are ambiguous.`,
      "MISSING_ACCEPTANCE_CRITERIA"
    );
  }
};
var BlankAcceptanceCriteriaError = class extends TaskForgeError {
  constructor(taskId) {
    super(
      `Task ${taskId} cannot be marked Done: one or more acceptance criteria are blank. Replace placeholder checkboxes with verifiable conditions before completing.`,
      "BLANK_ACCEPTANCE_CRITERIA"
    );
  }
};
var UncheckedAcceptanceCriteriaError = class extends TaskForgeError {
  constructor(taskId) {
    super(
      `Task ${taskId} cannot be marked Done: one or more acceptance criteria remain unchecked. Check off each criterion with evidence before completing.`,
      "UNCHECKED_ACCEPTANCE_CRITERIA"
    );
  }
};

// src/core/session.ts
function generateSessionId() {
  return crypto.randomBytes(5).toString("hex");
}
async function resolveSessionId(repoRoot) {
  const branch = await getCurrentBranch(repoRoot);
  const existing = parseSessionIdFromBranch(branch);
  if (existing) return existing;
  return generateSessionId();
}
function parseSessionIdFromBranch(branch) {
  const match = branch.match(/--([a-f0-9]{10})$/);
  return match ? match[1] : null;
}
async function assertTaskOwnership(task, repoRoot) {
  if (!task.assignee) return;
  const branch = await getCurrentBranch(repoRoot);
  const agentSession = parseSessionIdFromBranch(branch);
  if (!agentSession) {
    throw new TaskForgeError(
      `Cannot determine session ID from branch "${branch}". Expected format: agent/TASK-NNN-<session-id>`,
      "OWNERSHIP_UNKNOWN"
    );
  }
  if (agentSession !== task.assignee) {
    throw new TaskForgeError(
      `Task ${task.id} is assigned to session "${task.assignee}", but this worktree's branch "${branch}" identifies as "${agentSession}". Normal agents must not use force unlock. Valid next commands: taskforge inspect ${task.id} --json, taskforge doctor --json, or taskforge block ${task.id} "Ownership mismatch requires human or doctor recovery" --category unsafe_operation --blocked-by human.`,
      "OWNERSHIP_MISMATCH"
    );
  }
}
async function checkOutstandingSessionTasks(tasks, repoRoot, excludeTaskId) {
  try {
    const branch = await getCurrentBranch(repoRoot);
    const sessionId = parseSessionIdFromBranch(branch);
    if (!sessionId) return null;
    for (const t of tasks) {
      if (t.id === excludeTaskId) continue;
      if (t.assignee === sessionId && t.status === STATUS.IN_PROGRESS) {
        return t.id;
      }
      if (t.assignee === sessionId && t.status !== STATUS.IN_PROGRESS) {
        return t.id;
      }
    }
  } catch {
    return null;
  }
  return null;
}

// src/core/doctor-lock.ts
import fs4 from "fs";
import path4 from "path";
var LOCK_FILENAME = ".doctor-lock";
var DEFAULT_TTL_HOURS = 1;
function getLockPath(repoRoot) {
  return path4.join(getTaskStateDir(repoRoot ?? getRepoRoot()), LOCK_FILENAME);
}
function createDoctorLock(reason, options) {
  const lockPath = getLockPath(options?.repoRoot);
  const data = {
    reason,
    created: (/* @__PURE__ */ new Date()).toISOString(),
    ttl_hours: options?.ttlHours ?? DEFAULT_TTL_HOURS,
    recoveryTaskId: options?.recoveryTaskId
  };
  fs4.writeFileSync(lockPath, JSON.stringify(data, null, 2), "utf-8");
}
function removeDoctorLock(repoRoot) {
  const lockPath = getLockPath(repoRoot);
  if (fs4.existsSync(lockPath)) {
    fs4.unlinkSync(lockPath);
  }
}
function isDoctorLocked(repoRoot) {
  const lockPath = getLockPath(repoRoot);
  if (!fs4.existsSync(lockPath)) return { locked: false };
  try {
    const raw = fs4.readFileSync(lockPath, "utf-8");
    const data = JSON.parse(raw);
    const created = new Date(data.created).getTime();
    const now = Date.now();
    const ttlMs = (data.ttl_hours ?? DEFAULT_TTL_HOURS) * 60 * 60 * 1e3;
    if (now - created > ttlMs) {
      return { locked: false, reason: data.reason, expired: true };
    }
    return { locked: true, reason: data.reason };
  } catch {
    return { locked: false };
  }
}

// src/util/json-result.ts
function statusToJson(status) {
  return status.toLowerCase().replace(/ /g, "_");
}
function buildJsonTask(task) {
  const titleMatch = task.body.match(/^#\s+\S+:\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : task.id;
  return {
    id: task.id,
    status: statusToJson(task.status),
    statusLabel: task.status,
    priority: task.priority,
    title
  };
}

// src/commands/next.ts
function getNextTaskCommands(task) {
  if (task.status === STATUS.VERIFY) {
    return [
      {
        command: `taskforge resume ${task.id}`,
        purpose: "Enter the verification workspace",
        when: "Before running QA or acceptance checks",
        allowedFor: "all",
        priority: 1
      },
      {
        command: "taskforge gates --json",
        purpose: "Run verification gates",
        when: "After entering the task worktree",
        allowedFor: "all",
        priority: 2
      },
      {
        command: `taskforge done ${task.id}`,
        purpose: "Mark task done after verification passes",
        when: "Only after gates and acceptance criteria pass",
        allowedFor: "all",
        priority: 3
      }
    ];
  }
  if (task.status === STATUS.REVIEW) {
    return [
      {
        command: `taskforge diff ${task.id}`,
        purpose: "Review the task changes",
        when: "Before approving or returning work",
        allowedFor: "all",
        priority: 1
      },
      {
        command: `taskforge resume ${task.id}`,
        purpose: "Enter the review workspace if deeper inspection is needed",
        when: "After reviewing task metadata",
        allowedFor: "all",
        priority: 2
      }
    ];
  }
  if (task.status === STATUS.IN_PROGRESS || task.worktree) {
    return [
      {
        command: `taskforge resume ${task.id}`,
        purpose: "Continue the existing task workspace",
        when: "After selecting already-started work",
        allowedFor: "all",
        priority: 1
      },
      {
        command: `taskforge heartbeat ${task.id}`,
        purpose: "Refresh the task lease",
        when: "Before continuing active work",
        allowedFor: "all",
        priority: 2
      }
    ];
  }
  return getValidNextCommands("next", "success");
}
function getNextTaskGuidance(task) {
  if (task.status === STATUS.VERIFY) {
    return `Next task: ${task.id} is in Verify. Run 'taskforge resume ${task.id}' and verify it; do not run start.`;
  }
  if (task.status === STATUS.REVIEW) {
    return `Next task: ${task.id} is in Review. Run 'taskforge diff ${task.id}' or 'taskforge resume ${task.id}' to review it.`;
  }
  if (task.status === STATUS.IN_PROGRESS) {
    return `Next task: ${task.id} is already In Progress. Run 'taskforge resume ${task.id}' to continue.`;
  }
  return `Next task: ${task.id}. Run 'taskforge start ${task.id}' to begin.`;
}
async function cmdNext(options) {
  const startTime = Date.now();
  await pullTaskState();
  await sweepStaleTasks(void 0, { commit: true });
  const tasks = loadAllTasks();
  const repoRoot = getRepoRoot();
  const lock = isDoctorLocked();
  if (lock.locked) {
    const result2 = doctorRequiredResult({
      command: "next",
      reason: lock.reason ?? "System is in recovery mode",
      nextCommands: getValidNextCommands("next", "failed"),
      duration: Date.now() - startTime
    });
    if (options?.json) {
      process.stdout.write(renderResultJson(result2) + "\n");
      return;
    }
    process.stdout.write(renderResultMarkdown(result2) + "\n");
    return;
  }
  const outstandingTask = await checkOutstandingSessionTasks(tasks, repoRoot);
  if (outstandingTask) {
    const result2 = blockedResult({
      command: "next",
      reason: `You have an outstanding task: ${outstandingTask}. Complete or release it before starting new work.`,
      nextCommands: getValidNextCommands("next", "failed"),
      duration: Date.now() - startTime
    });
    if (options?.json) {
      process.stdout.write(renderResultJson(result2) + "\n");
      return;
    }
    process.stdout.write(renderResultMarkdown(result2) + "\n");
    return;
  }
  if (tasks.length === 0) {
    const result2 = noopResult({
      command: "next",
      reason: "No task files found.",
      nextCommands: getValidNextCommands("next", "noop"),
      duration: Date.now() - startTime
    });
    if (options?.json) {
      process.stdout.write(renderResultJson(result2) + "\n");
      return;
    }
    logInfo("No task files found.");
    process.stdout.write(renderResultMarkdown(result2) + "\n");
    return;
  }
  const uncommittedWorktrees = await checkUncommittedWorktrees(repoRoot, tasks);
  if (uncommittedWorktrees.length > 0) {
    const dirty = uncommittedWorktrees[0];
    const result2 = blockedResult({
      command: "next",
      reason: `Task ${dirty.taskId} has uncommitted changes. Commit or complete it first.`,
      nextCommands: getValidNextCommands("next", "failed"),
      duration: Date.now() - startTime
    });
    if (options?.json) {
      process.stdout.write(renderResultJson(result2) + "\n");
      return;
    }
    process.stdout.write(renderResultMarkdown(result2) + "\n");
    return;
  }
  const next = selectNextTask(tasks);
  if (!next) {
    const result2 = noopResult({
      command: "next",
      reason: "No actionable tasks found.",
      nextCommands: getValidNextCommands("next", "noop"),
      duration: Date.now() - startTime
    });
    if (options?.json) {
      process.stdout.write(renderResultJson(result2) + "\n");
      return;
    }
    logInfo("No actionable tasks found.");
    logDivider();
    logInfo("All tasks are in Inbox, Needs Spec, Blocked, Done, Rejected, Deferred, or blocked by dependencies.");
    process.stdout.write(renderResultMarkdown(result2) + "\n");
    return;
  }
  const unmet = hasUnmetDependencies(next, tasks);
  const result = successResult({
    command: "next",
    taskId: next.id,
    guidance: getNextTaskGuidance(next),
    nextCommands: getNextTaskCommands(next),
    duration: Date.now() - startTime
  });
  if (options?.json) {
    const jsonOutput = JSON.parse(renderResultJson(result));
    jsonOutput.task = buildJsonTask(next);
    jsonOutput.score = scoreTask(next);
    if (unmet.length > 0) {
      jsonOutput.waitingOn = unmet;
    }
    if (next.worktree || next.branch) {
      jsonOutput.workspace = {
        worktree: next.worktree,
        branch: next.branch
      };
    }
    process.stdout.write(JSON.stringify(jsonOutput, null, 2) + "\n");
    return;
  }
  logHeader(`## Next Task`);
  logDivider();
  logSub(`**ID:** ${next.id}`);
  logSub(`**Status:** ${next.status}`);
  logSub(`**Priority:** ${next.priority}`);
  logSub(`**Agent Role:** ${next.agentRole ?? "Implementer"}`);
  logSub(`**Score:** ${scoreTask(next)}`);
  if (unmet.length > 0) {
    logSub(`**Waiting on:** ${unmet.join(", ")}`);
  }
  const dependents = tasks.filter(
    (t) => t.dependsOn && t.dependsOn.includes(next.id)
  );
  if (dependents.length > 0) {
    logSub(`**Blocks:** ${dependents.map((d) => d.id).join(", ")}`);
  }
  const goalMatch = next.body.match(/## Goal\n([\s\S]*?)(?=##|\n\n\n|$)/);
  if (goalMatch) {
    logSub(`**Goal:** ${goalMatch[1].trim().slice(0, 120)}${goalMatch[1].trim().length > 120 ? "..." : ""}`);
  }
  logSub(`**File:** ${next.filePath}`);
  if (next.worktree) {
    logSub(`**Worktree:** ${next.worktree}`);
    logSub(`**Branch:** ${next.branch ?? "none"}`);
  }
  logDivider();
  process.stdout.write(renderResultMarkdown(result) + "\n");
}

// src/core/control-files.ts
import crypto2 from "crypto";
import fs5 from "fs";
import path5 from "path";
var DEFAULT_CONTROL_FILES = [
  "AGENTS.md",
  "TASKFORGE.md",
  "README.md",
  "CHANGELOG.md",
  "package.json",
  "tsconfig.json",
  "tsup.config.ts",
  ".taskforge/config.json"
];
function getControlFiles(repoRoot) {
  const root = repoRoot ?? getRepoRoot();
  const config = loadConfig(root);
  const configured = config?.controlFiles ?? [];
  return [.../* @__PURE__ */ new Set([...DEFAULT_CONTROL_FILES, ...configured])];
}
function hashControlFiles(repoRoot) {
  const root = repoRoot ?? getRepoRoot();
  const files = getControlFiles(root);
  const hash = crypto2.createHash("sha256");
  for (const file of files.sort()) {
    const filePath = path5.join(root, file);
    if (fs5.existsSync(filePath)) {
      hash.update(file);
      hash.update(fs5.readFileSync(filePath, "utf-8"));
    }
  }
  return hash.digest("hex").substring(0, 16);
}

// src/core/command-states.ts
function success(state, nextAction, guidance, context) {
  return { ok: true, state, nextAction, guidance, context };
}
function error(state, errorCode, nextAction, guidance, context) {
  return { ok: false, state, errorCode, nextAction, guidance, context };
}
var ClaimStates = {
  TASK_CLAIMED: "task_claimed",
  TASK_NOT_FOUND: "task_not_found",
  INVALID_STATUS: "invalid_status",
  ALREADY_CLAIMED: "already_claimed",
  PUSH_FAILED: "push_failed",
  DOCTOR_LOCKED: "doctor_locked",
  OUTSTANDING_TASK: "outstanding_task",
  UNCOMMITTED_CHANGES: "uncommitted_changes"
};
function claimStateMachine(conditions) {
  if (conditions.doctorLocked) {
    return error(
      ClaimStates.DOCTOR_LOCKED,
      "DOCTOR_LOCKED",
      "wait",
      `System is in doctor recovery mode: ${conditions.doctorReason ?? "unknown"}. All agents are paused. Wait until recovery is complete.`
    );
  }
  if (conditions.hasOutstandingTask && conditions.outstandingTaskId) {
    return error(
      ClaimStates.OUTSTANDING_TASK,
      "OUTSTANDING_TASK",
      "complete_current_then_next",
      `You still own task ${conditions.outstandingTaskId}. Close it first with 'taskforge done ${conditions.outstandingTaskId}'.`
    );
  }
  if (conditions.uncommittedWorktrees && conditions.uncommittedWorktrees.length > 0) {
    const dirty = conditions.uncommittedWorktrees[0];
    const isBlocked = dirty.status === "Blocked";
    if (isBlocked) {
      return error(
        ClaimStates.UNCOMMITTED_CHANGES,
        "UNCOMMITTED_BLOCKED_TASK",
        "commit_then_next",
        `Task ${dirty.taskId} has ${dirty.dirtyFiles} uncommitted file(s) and is in Blocked status. 1. Commit your current changes: taskforge checkpoint -m "WIP: save progress on ${dirty.taskId}"
2. Look for the next task that resolves the block: taskforge next
3. If no resolving task is available, continue with the next available task.`,
        { taskId: dirty.taskId, dirtyFiles: dirty.dirtyFiles }
      );
    }
    return error(
      ClaimStates.UNCOMMITTED_CHANGES,
      "UNCOMMITTED_CHANGES",
      "complete_current_then_next",
      `Task ${dirty.taskId} has ${dirty.dirtyFiles} uncommitted file(s). Complete the current task before claiming a new one. Run 'taskforge done ${dirty.taskId}' when ready, or 'taskforge checkpoint' to save progress.`,
      { taskId: dirty.taskId, dirtyFiles: dirty.dirtyFiles }
    );
  }
  if (!conditions.taskFound) {
    return error(
      ClaimStates.TASK_NOT_FOUND,
      "TASK_NOT_FOUND",
      "request_human_input",
      `Task ${conditions.taskId} not found. The task file may have been deleted or the ID is incorrect. Request human input to verify the task exists.`,
      { taskId: conditions.taskId }
    );
  }
  if (conditions.taskStatus !== "Ready" && conditions.taskStatus !== "In Progress") {
    return error(
      ClaimStates.INVALID_STATUS,
      "INVALID_STATUS",
      "request_human_input",
      `Cannot claim task with status "${conditions.taskStatus}". Must be "Ready" or "In Progress". If the task should be claimable, request human input to correct its status.`,
      { taskId: conditions.taskId, status: conditions.taskStatus }
    );
  }
  if (conditions.taskAssignee && !conditions.force) {
    return error(
      ClaimStates.ALREADY_CLAIMED,
      "ALREADY_CLAIMED",
      "request_human_input",
      `Task ${conditions.taskId} is already claimed by session "${conditions.taskAssignee}" since ${conditions.taskClaimedAt ?? "unknown"}. Normal agents may not use --force. Valid next commands: taskforge doctor --json, taskforge inspect ${conditions.taskId} --json, or taskforge block ${conditions.taskId} "Already claimed; override requires human or doctor authority" --category unsafe_operation --blocked-by human.`,
      { taskId: conditions.taskId, assignee: conditions.taskAssignee }
    );
  }
  if (!conditions.pushSucceeded) {
    return error(
      ClaimStates.PUSH_FAILED,
      "PUSH_FAILED",
      "retry",
      `Failed to push claim for ${conditions.taskId}. The task may have been claimed by another agent. Run 'taskforge next' to find the next available task, or retry with 'taskforge claim ${conditions.taskId}' after a brief wait.`,
      { taskId: conditions.taskId }
    );
  }
  if (conditions.worktreeExists && conditions.worktreePath) {
    return success(
      ClaimStates.TASK_CLAIMED,
      "work_on_task",
      `Task ${conditions.taskId} claimed. Session: ${conditions.sessionId}. Worktree: ${conditions.worktreePath}. cd ${conditions.worktreePath} to begin work. Run 'taskforge prompt ${conditions.taskId}' for task context.`,
      { taskId: conditions.taskId, sessionId: conditions.sessionId, worktree: conditions.worktreePath }
    );
  }
  return success(
    ClaimStates.TASK_CLAIMED,
    "request_human_input",
    `Task ${conditions.taskId} claimed. Session: ${conditions.sessionId}. Worktree creation did not complete. Valid next commands: taskforge doctor --json, taskforge inspect ${conditions.taskId} --json, or taskforge block ${conditions.taskId} "Claim succeeded but worktree creation failed" --category unsafe_operation --blocked-by human. Do NOT run 'taskforge start ${conditions.taskId}' \u2014 the task is already assigned.`,
    { taskId: conditions.taskId, sessionId: conditions.sessionId }
  );
}
var StartStates = {
  TASK_STARTED: "task_started",
  TASK_NOT_FOUND: "task_not_found",
  INVALID_STATUS: "invalid_status",
  ALREADY_ASSIGNED: "already_assigned",
  PUSH_FAILED: "push_failed",
  WORKTREE_FAILED: "worktree_failed",
  DOCTOR_LOCKED: "doctor_locked",
  OUTSTANDING_TASK: "outstanding_task",
  UNCOMMITTED_CHANGES: "uncommitted_changes"
};
function startStateMachine(conditions) {
  if (conditions.doctorLocked) {
    return error(
      StartStates.DOCTOR_LOCKED,
      "DOCTOR_LOCKED",
      "wait",
      `System is in doctor recovery mode: ${conditions.doctorReason ?? "unknown"}. All agents are paused. Wait until recovery is complete.`
    );
  }
  if (conditions.hasOutstandingTask && conditions.outstandingTaskId) {
    return error(
      StartStates.OUTSTANDING_TASK,
      "OUTSTANDING_TASK",
      "complete_current_then_next",
      `You still own task ${conditions.outstandingTaskId}. Close it first with 'taskforge done ${conditions.outstandingTaskId}'.`
    );
  }
  if (conditions.uncommittedWorktrees && conditions.uncommittedWorktrees.length > 0) {
    const dirty = conditions.uncommittedWorktrees[0];
    const isBlocked = dirty.status === "Blocked";
    if (isBlocked) {
      return error(
        StartStates.UNCOMMITTED_CHANGES,
        "UNCOMMITTED_BLOCKED_TASK",
        "commit_then_next",
        `Task ${dirty.taskId} has ${dirty.dirtyFiles} uncommitted file(s) and is in Blocked status. 1. Commit your current changes: taskforge checkpoint -m "WIP: save progress on ${dirty.taskId}"
2. Look for the next task that resolves the block: taskforge next
3. If no resolving task is available, continue with the next available task.`,
        { taskId: dirty.taskId, dirtyFiles: dirty.dirtyFiles }
      );
    }
    return error(
      StartStates.UNCOMMITTED_CHANGES,
      "UNCOMMITTED_CHANGES",
      "complete_current_then_next",
      `Task ${dirty.taskId} has ${dirty.dirtyFiles} uncommitted file(s). Complete the current task before starting a new one. Run 'taskforge done ${dirty.taskId}' when ready, or 'taskforge checkpoint' to save progress.`,
      { taskId: dirty.taskId, dirtyFiles: dirty.dirtyFiles }
    );
  }
  if (!conditions.taskFound) {
    return error(
      StartStates.TASK_NOT_FOUND,
      "TASK_NOT_FOUND",
      "request_human_input",
      `Task ${conditions.taskId} not found. Request human input to verify the task exists.`,
      { taskId: conditions.taskId }
    );
  }
  if (conditions.taskStatus !== "Ready" && conditions.taskStatus !== "In Progress" && conditions.taskStatus !== "Review" && conditions.taskStatus !== "Verify") {
    return error(
      StartStates.INVALID_STATUS,
      "INVALID_STATUS",
      "request_human_input",
      `Cannot start task with status "${conditions.taskStatus}". Must be "Ready", "In Progress", "Review", or "Verify". Request human input to correct the task status.`,
      { taskId: conditions.taskId, status: conditions.taskStatus }
    );
  }
  if (conditions.taskAssignee && !conditions.force) {
    return error(
      StartStates.ALREADY_ASSIGNED,
      "ALREADY_ASSIGNED",
      "request_human_input",
      `Task ${conditions.taskId} is assigned to session "${conditions.taskAssignee}" since ${conditions.taskClaimedAt ?? "unknown"}. Normal agents may not use --force. Valid next commands: taskforge resume ${conditions.taskId}, taskforge inspect ${conditions.taskId} --json, taskforge doctor --json, or taskforge block ${conditions.taskId} "Task already assigned; human or doctor recovery required" --category unsafe_operation --blocked-by human.`,
      { taskId: conditions.taskId, assignee: conditions.taskAssignee }
    );
  }
  if (!conditions.pushSucceeded) {
    return error(
      StartStates.PUSH_FAILED,
      "PUSH_FAILED",
      "retry",
      `Failed to push claim for ${conditions.taskId}. The task may have been claimed by another agent. Run 'taskforge next' to find the next available task, or retry with 'taskforge start ${conditions.taskId}' after a brief wait.`,
      { taskId: conditions.taskId }
    );
  }
  if (!conditions.worktreeCreated) {
    return error(
      StartStates.WORKTREE_FAILED,
      "WORKTREE_FAILED",
      "request_human_input",
      `Could not create worktree for ${conditions.taskId}. Claim was pushed successfully but workspace creation failed. The task is claimed. Request human input to resolve the worktree issue, or run 'taskforge start ${conditions.taskId}' to retry.`,
      { taskId: conditions.taskId }
    );
  }
  return success(
    StartStates.TASK_STARTED,
    "work_on_task",
    `Task ${conditions.taskId} started. Worktree: ${conditions.worktreePath}. Branch: ${conditions.branch}. cd ${conditions.worktreePath} and begin work. Read TASKFORGE.md and AGENTS.md for guidance.`,
    {
      taskId: conditions.taskId,
      sessionId: conditions.sessionId,
      worktree: conditions.worktreePath,
      branch: conditions.branch
    }
  );
}
var CheckpointStates = {
  CHANGES_COMMIT: "changes_committed",
  NO_CHANGES: "no_changes",
  COMMIT_FAILED: "commit_failed",
  NOT_IN_WORKTREE: "not_in_worktree"
};
function checkpointStateMachine(conditions) {
  if (!conditions.inWorktree) {
    return error(
      CheckpointStates.NOT_IN_WORKTREE,
      "NOT_IN_WORKTREE",
      "request_human_input",
      "Not in a task worktree. Run 'taskforge start TASK-ID' to create a worktree first."
    );
  }
  if (!conditions.hasChanges) {
    return error(
      CheckpointStates.NO_CHANGES,
      "NO_CHANGES",
      "work_on_task",
      "No changes to commit. Continue working on the task, then run 'taskforge checkpoint' again."
    );
  }
  if (!conditions.commitSucceeded) {
    return error(
      CheckpointStates.COMMIT_FAILED,
      "COMMIT_FAILED",
      "request_human_input",
      `Failed to commit changes: ${conditions.errorMessage ?? "unknown error"}. If the correct action cannot be cleanly inferred, request human input.`,
      { taskId: conditions.taskId }
    );
  }
  return success(
    CheckpointStates.CHANGES_COMMIT,
    "run_gates",
    `Changes committed for ${conditions.taskId}. Run 'taskforge gates' to verify, then 'taskforge submit' to create a PR.`,
    { taskId: conditions.taskId }
  );
}
var GatesStates = {
  ALL_PASSED: "all_passed",
  SOME_FAILED: "some_failed",
  NO_GATES: "no_gates"
};
function gatesStateMachine(conditions) {
  if (conditions.totalGates === 0) {
    return success(
      GatesStates.NO_GATES,
      "create_pr",
      "No gates configured. Proceed to create a PR with 'taskforge submit'."
    );
  }
  if (conditions.failedGates.length > 0) {
    const failedNames = conditions.failedGates.map((g) => g.name).join(", ");
    return error(
      GatesStates.SOME_FAILED,
      "GATE_FAILURE",
      "work_on_task",
      `${conditions.failedGates.length}/${conditions.totalGates} gate(s) failed: ${failedNames}. Fix the issues and re-run 'taskforge gates'. If gates cannot be satisfied, request human input.`,
      { failedGates: conditions.failedGates }
    );
  }
  return success(
    GatesStates.ALL_PASSED,
    "create_pr",
    `All ${conditions.totalGates} gate(s) passed. Run 'taskforge submit' to create a pull request.`
  );
}
var SubmitStates = {
  PR_CREATED: "pr_created",
  PR_FAILED: "pr_failed",
  PR_MANUAL: "pr_manual",
  NO_CHANGES: "no_changes"
};
function submitStateMachine(conditions) {
  if (conditions.prCreated && conditions.prNumber) {
    return success(
      SubmitStates.PR_CREATED,
      "complete_task",
      `Pull request created: #${conditions.prNumber} (${conditions.prUrl ?? "no URL"}). Run 'taskforge done ${conditions.taskId}' to mark the task complete.`,
      { taskId: conditions.taskId, prNumber: conditions.prNumber, prUrl: conditions.prUrl }
    );
  }
  if (conditions.githubConfigured && !conditions.prCreated) {
    return error(
      SubmitStates.PR_FAILED,
      "PR_FAILED",
      "request_human_input",
      `Failed to create pull request: ${conditions.errorMessage ?? "unknown error"}. If the correct action cannot be cleanly inferred, request human input.`,
      { taskId: conditions.taskId }
    );
  }
  if (!conditions.githubConfigured) {
    return success(
      SubmitStates.PR_MANUAL,
      "complete_task",
      `GitHub is not configured. Create the PR manually, then run 'taskforge done ${conditions.taskId}'.`,
      { taskId: conditions.taskId }
    );
  }
  return error(
    SubmitStates.NO_CHANGES,
    "NO_CHANGES",
    "work_on_task",
    "No changes to submit. Continue working on the task."
  );
}
var DoneStates = {
  TASK_DONE: "task_done",
  INVALID_TRANSITION: "invalid_transition",
  GATES_FAILED: "gates_failed",
  OWNERSHIP_MISMATCH: "ownership_mismatch",
  CONTROL_FILE_CHANGED: "control_file_changed",
  AC_MISSING: "ac_missing",
  AC_BLANK: "ac_blank",
  AC_UNCHECKED: "ac_unchecked",
  WORKTREE_DIRTY: "worktree_dirty",
  BRANCH_UNPUSHED: "branch_unpushed"
};
function doneStateMachine(conditions) {
  if (!conditions.validTransition) {
    return error(
      DoneStates.INVALID_TRANSITION,
      "INVALID_TRANSITION",
      "request_human_input",
      `Cannot transition from "${conditions.currentStatus}" to "Done". Request human input to correct the task status.`,
      { taskId: conditions.taskId, status: conditions.currentStatus }
    );
  }
  if (!conditions.gatesPassed) {
    return error(
      DoneStates.GATES_FAILED,
      "GATES_FAILED",
      "work_on_task",
      `Verification gates failed. Fix the issues and re-run 'taskforge gates', then try 'taskforge done ${conditions.taskId}' again.`,
      { taskId: conditions.taskId }
    );
  }
  if (!conditions.ownershipMatch) {
    return error(
      DoneStates.OWNERSHIP_MISMATCH,
      "OWNERSHIP_MISMATCH",
      "request_human_input",
      `Task ${conditions.taskId} is not owned by the current session. Request human input to resolve the ownership conflict.`,
      { taskId: conditions.taskId }
    );
  }
  if (!conditions.worktreeClean) {
    const fileCount = conditions.dirtyFiles?.length ?? 0;
    const fileList = conditions.dirtyFiles && conditions.dirtyFiles.length <= 5 ? `: ${conditions.dirtyFiles.join(", ")}` : conditions.dirtyFiles && conditions.dirtyFiles.length > 5 ? ` (showing first 5): ${conditions.dirtyFiles.slice(0, 5).join(", ")}...` : "";
    return error(
      DoneStates.WORKTREE_DIRTY,
      "WORKTREE_DIRTY",
      "work_on_task",
      `Task ${conditions.taskId} has ${fileCount} uncommitted file(s) in the worktree${fileList}. Done requires a clean worktree. Run 'taskforge checkpoint -m "your message"' to commit changes, then try 'taskforge done ${conditions.taskId}' again.`,
      { taskId: conditions.taskId, dirtyFiles: conditions.dirtyFiles }
    );
  }
  if (!conditions.branchPushed) {
    const ahead = conditions.commitsAhead ?? 0;
    return error(
      DoneStates.BRANCH_UNPUSHED,
      "BRANCH_UNPUSHED",
      "work_on_task",
      `Task ${conditions.taskId} has ${ahead} unpushed commit(s). Done requires all commits to be pushed. Run 'taskforge submit' to push and create a PR, then try 'taskforge done ${conditions.taskId}' again.`,
      { taskId: conditions.taskId, commitsAhead: conditions.commitsAhead }
    );
  }
  if (!conditions.controlFileHashMatch) {
    return error(
      DoneStates.CONTROL_FILE_CHANGED,
      "CONTROL_FILE_CHANGED",
      "request_human_input",
      `Control files (AGENTS.md, TASKFORGE.md, etc.) have changed since task start. Re-read the updated files and verify your work still complies. Request human input if unsure.`,
      { taskId: conditions.taskId }
    );
  }
  if (!conditions.hasAcSection) {
    return error(
      DoneStates.AC_MISSING,
      "MISSING_ACCEPTANCE_CRITERIA",
      "work_on_task",
      `Task ${conditions.taskId} is missing an "## Acceptance Criteria" section. Add acceptance criteria to the task file before marking done.`,
      { taskId: conditions.taskId }
    );
  }
  if (conditions.hasBlankAc) {
    return error(
      DoneStates.AC_BLANK,
      "BLANK_ACCEPTANCE_CRITERIA",
      "work_on_task",
      `Task ${conditions.taskId} has blank acceptance criteria items. Replace blank checkboxes with verifiable conditions.`,
      { taskId: conditions.taskId }
    );
  }
  if (conditions.hasUncheckedAc) {
    return error(
      DoneStates.AC_UNCHECKED,
      "UNCHECKED_ACCEPTANCE_CRITERIA",
      "work_on_task",
      `Task ${conditions.taskId} has unchecked acceptance criteria. Check off each criterion with evidence of how it was satisfied.`,
      { taskId: conditions.taskId }
    );
  }
  return success(
    DoneStates.TASK_DONE,
    "none",
    `Task ${conditions.taskId} marked as Done. Run 'taskforge next' to find the next task.`,
    { taskId: conditions.taskId }
  );
}
var NewStates = {
  TASK_CREATED: "task_created",
  PUSH_FAILED: "push_failed",
  WRITE_FAILED: "write_failed"
};
function newStateMachine(conditions) {
  if (!conditions.writeSucceeded) {
    return error(
      NewStates.WRITE_FAILED,
      "WRITE_FAILED",
      "request_human_input",
      `Failed to create task file: ${conditions.errorMessage ?? "unknown error"}. Request human input to resolve.`
    );
  }
  if (!conditions.pushSucceeded) {
    return error(
      NewStates.PUSH_FAILED,
      "PUSH_FAILED",
      "request_human_input",
      `Task ${conditions.taskId} was created locally but failed to push to remote. The task may not be visible to other agents. Run 'taskforge submit' or request human input to push the task-state branch.`,
      { taskId: conditions.taskId, filePath: conditions.filePath }
    );
  }
  return success(
    NewStates.TASK_CREATED,
    "none",
    `Created ${conditions.taskId}: ${conditions.filePath}. Run 'taskforge next' to see it in the queue.`,
    { taskId: conditions.taskId, filePath: conditions.filePath }
  );
}

// src/core/guidance-adapter.ts
var NoOpGuidanceAdapter = class {
  pushGuidance(_result) {
  }
};
var OpenCodeGuidanceAdapter = class {
  pushGuidance(result) {
    void result;
  }
};
function getDefaultGuidanceAdapter() {
  const adapter = process.env.TASKFORGE_GUIDANCE_ADAPTER;
  switch (adapter) {
    case "opencode":
      return new OpenCodeGuidanceAdapter();
    case "noop":
    default:
      return new NoOpGuidanceAdapter();
  }
}

// src/core/session-state.ts
import fs6 from "fs";
import path6 from "path";
var SESSION_FILE = ".taskforge-session.json";
function writeSessionState(worktreePath, state) {
  const filePath = path6.join(worktreePath, SESSION_FILE);
  if (!fs6.existsSync(worktreePath)) {
    fs6.mkdirSync(worktreePath, { recursive: true });
  }
  fs6.writeFileSync(filePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
}
function readSessionState(worktreePath) {
  const filePath = path6.join(worktreePath, SESSION_FILE);
  if (!fs6.existsSync(filePath)) return null;
  try {
    const content = fs6.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content);
    if (parsed.session_id && parsed.task_id) return parsed;
    return null;
  } catch {
    return null;
  }
}
function removeSessionState(worktreePath) {
  const filePath = path6.join(worktreePath, SESSION_FILE);
  if (fs6.existsSync(filePath)) {
    fs6.unlinkSync(filePath);
  }
}
function updateSessionHeartbeat(worktreePath) {
  const state = readSessionState(worktreePath);
  if (!state) return;
  state.last_heartbeat = (/* @__PURE__ */ new Date()).toISOString();
  writeSessionState(worktreePath, state);
}

// src/core/agent-registry.ts
import fs7 from "fs";
import path7 from "path";
import os2 from "os";
import { z } from "zod";
var AGENT_REGISTRY_FILE = "agent-registry.json";
var AgentStatusSchema = z.enum(["active", "idle", "stale", "crashed"]);
var AgentEntrySchema = z.object({
  session_id: z.string(),
  agent_id: z.string(),
  last_heartbeat: z.string(),
  current_task: z.string().nullable(),
  status: AgentStatusSchema,
  worktree_path: z.string().nullable(),
  registered_at: z.string()
});
var AgentRegistrySchema = z.object({
  agents: z.array(AgentEntrySchema),
  max_concurrent_agents: z.number().default(0),
  agent_history: z.array(z.string()).default([]),
  last_updated: z.string()
});
function getRegistryPath(repoRoot) {
  const root = repoRoot ?? getRepoRoot();
  return path7.join(root, ".taskforge", AGENT_REGISTRY_FILE);
}
function getAgentId() {
  const hostname = os2.hostname();
  const pid = process.pid;
  return `${hostname}:${pid}`;
}
function readAgentRegistry(repoRoot) {
  const registryPath = getRegistryPath(repoRoot);
  if (!fs7.existsSync(registryPath)) {
    return {
      agents: [],
      max_concurrent_agents: 0,
      agent_history: [],
      last_updated: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  try {
    const content = fs7.readFileSync(registryPath, "utf-8");
    const parsed = JSON.parse(content);
    return AgentRegistrySchema.parse(parsed);
  } catch {
    return {
      agents: [],
      max_concurrent_agents: 0,
      agent_history: [],
      last_updated: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
}
function writeAgentRegistry(registry, repoRoot) {
  const registryPath = getRegistryPath(repoRoot);
  const dir = path7.dirname(registryPath);
  if (!fs7.existsSync(dir)) {
    fs7.mkdirSync(dir, { recursive: true });
  }
  registry.last_updated = (/* @__PURE__ */ new Date()).toISOString();
  fs7.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n", "utf-8");
}
function registerAgent(sessionId, taskId, worktreePath, repoRoot) {
  const registry = readAgentRegistry(repoRoot);
  const agentId = getAgentId();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const entry = {
    session_id: sessionId,
    agent_id: agentId,
    last_heartbeat: now,
    current_task: taskId,
    status: "active",
    worktree_path: worktreePath,
    registered_at: now
  };
  registry.agents = registry.agents.filter((a) => a.session_id !== sessionId);
  registry.agents.push(entry);
  if (!registry.agent_history.includes(agentId)) {
    registry.agent_history.push(agentId);
  }
  const activeCount = registry.agents.filter((a) => a.status === "active").length;
  if (activeCount > registry.max_concurrent_agents) {
    registry.max_concurrent_agents = activeCount;
  }
  writeAgentRegistry(registry, repoRoot);
  return entry;
}
function updateAgentHeartbeat(sessionId, repoRoot) {
  const registry = readAgentRegistry(repoRoot);
  const agent = registry.agents.find((a) => a.session_id === sessionId);
  if (!agent) return;
  agent.last_heartbeat = (/* @__PURE__ */ new Date()).toISOString();
  agent.status = "active";
  writeAgentRegistry(registry, repoRoot);
}
function markAgentIdle(sessionId, repoRoot) {
  const registry = readAgentRegistry(repoRoot);
  const agent = registry.agents.find((a) => a.session_id === sessionId);
  if (!agent) return;
  agent.status = "idle";
  agent.current_task = null;
  agent.last_heartbeat = (/* @__PURE__ */ new Date()).toISOString();
  writeAgentRegistry(registry, repoRoot);
}
function findStaleAgents(thresholdMinutes = 15, repoRoot) {
  const registry = readAgentRegistry(repoRoot);
  const threshold = Date.now() - thresholdMinutes * 60 * 1e3;
  return registry.agents.filter((agent) => {
    if (agent.status !== "active") return false;
    const heartbeatTime = new Date(agent.last_heartbeat).getTime();
    return heartbeatTime < threshold;
  });
}
function markStaleAgentsAsCrashed(thresholdMinutes = 15, repoRoot) {
  const registry = readAgentRegistry(repoRoot);
  const threshold = Date.now() - thresholdMinutes * 60 * 1e3;
  const crashed = [];
  for (const agent of registry.agents) {
    if (agent.status !== "active") continue;
    const heartbeatTime = new Date(agent.last_heartbeat).getTime();
    if (heartbeatTime < threshold) {
      agent.status = "crashed";
      crashed.push(agent);
    }
  }
  if (crashed.length > 0) {
    writeAgentRegistry(registry, repoRoot);
  }
  return crashed;
}

// src/commands/start.ts
async function cmdStart(taskId, options) {
  const repoRoot = getRepoRoot();
  await pullTaskState(repoRoot);
  await sweepStaleTasks(repoRoot, { commit: true });
  const task = loadTaskById(taskId);
  const sessionId = await resolveSessionId(repoRoot);
  const lock = isDoctorLocked(repoRoot);
  if (lock.locked) {
    const result = startStateMachine({
      taskFound: !!task,
      taskStatus: task?.status,
      doctorLocked: true,
      doctorReason: lock.reason,
      hasOutstandingTask: false,
      pushSucceeded: false,
      worktreeCreated: false
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      writeResult(failedResult({ command: "start", error: result.guidance, code: result.errorCode ?? "DOCTOR_LOCKED" }), options.json);
      return;
    }
    logWarn(result.guidance);
    return;
  }
  if (!task) {
    const result = startStateMachine({
      taskFound: false,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      worktreeCreated: false,
      taskId
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      writeResult(failedResult({ command: "start", taskId, error: result.guidance, code: result.errorCode ?? "TASK_NOT_FOUND" }), options.json);
      return;
    }
    throw new TaskNotFoundError(taskId);
  }
  const startableStatuses = [STATUS.READY, STATUS.IN_PROGRESS, STATUS.REVIEW, STATUS.VERIFY];
  if (!startableStatuses.includes(task.status)) {
    const result = startStateMachine({
      taskFound: true,
      taskStatus: task.status,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      worktreeCreated: false,
      taskId
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      writeResult(failedResult({ command: "start", taskId, error: result.guidance, code: result.errorCode ?? "INVALID_STATUS" }), options.json);
      return;
    }
    throw new InvalidStatusTransitionError(
      task.status,
      STATUS.IN_PROGRESS,
      [STATUS.READY, STATUS.IN_PROGRESS, STATUS.REVIEW, STATUS.VERIFY]
    );
  }
  const outstanding = await checkOutstandingSessionTasks(loadAllTasks(repoRoot), repoRoot, taskId);
  if (outstanding) {
    const result = startStateMachine({
      taskFound: true,
      taskStatus: task.status,
      doctorLocked: false,
      hasOutstandingTask: true,
      outstandingTaskId: outstanding,
      pushSucceeded: false,
      worktreeCreated: false,
      taskId
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      writeResult(failedResult({ command: "start", taskId, error: result.guidance, code: result.errorCode ?? "OUTSTANDING_TASK" }), options.json);
      return;
    }
    logWarn(result.guidance);
    return;
  }
  const allTasks = loadAllTasks(repoRoot);
  const uncommittedWorktrees = await checkUncommittedWorktrees(repoRoot, allTasks);
  if (uncommittedWorktrees.length > 0) {
    const dirty = uncommittedWorktrees[0];
    const result = startStateMachine({
      taskFound: true,
      taskStatus: task.status,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      worktreeCreated: false,
      taskId,
      uncommittedWorktrees: [{
        taskId: dirty.taskId,
        status: dirty.status,
        dirtyFiles: dirty.dirtyFiles
      }]
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      writeResult(failedResult({ command: "start", taskId, error: result.guidance, code: result.errorCode ?? "UNCOMMITTED_CHANGES" }), options.json);
      return;
    }
    logWarn(result.guidance);
    return;
  }
  if (task.assignee && task.assignee !== sessionId && !options?.force) {
    const result = startStateMachine({
      taskFound: true,
      taskStatus: task.status,
      taskAssignee: task.assignee,
      taskClaimedAt: task.claimed_at ? String(task.claimed_at) : void 0,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      worktreeCreated: false,
      taskId
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      const nextCommands = getForceRejectionNextActions(taskId).map((a) => ({
        command: a.command,
        purpose: a.reason,
        when: a.reason,
        allowedFor: a.safety === "safe" ? "all" : a.safety === "requires_human" ? "human" : a.safety === "doctor_only" ? "doctor" : "all",
        priority: a.preferred ? 1 : 2
      }));
      writeResult(failedResult({ command: "start", taskId, error: result.guidance, code: result.errorCode ?? "ALREADY_ASSIGNED", nextCommands }), options.json);
      return;
    }
    logError(result.guidance);
    logDivider();
    logInfo("Valid next actions:");
    logSub("1. taskforge doctor --json");
    logSub("   Reason: Diagnose whether a recovery path exists.");
    logSub("   Safety: safe");
    logSub(`2. taskforge block ${taskId} "Force operation requires human or doctor-mode authorization" --category unsafe_operation --blocked-by human`);
    logSub("   Reason: Escalate unsafe operation without bypassing TaskForge.");
    logSub("   Safety: requires_human");
    return;
  }
  if (task.assignee && task.assignee !== sessionId && options?.force) {
    const authority = resolveAuthority();
    try {
      assertCanForce(authority);
    } catch (err) {
      if (err instanceof ForceRequiresHumanOrDoctorError) {
        const result = startStateMachine({
          taskFound: true,
          taskStatus: task.status,
          taskAssignee: task.assignee,
          taskClaimedAt: task.claimed_at ? String(task.claimed_at) : void 0,
          force: true,
          doctorLocked: false,
          hasOutstandingTask: false,
          pushSucceeded: false,
          worktreeCreated: false,
          taskId
        });
        getDefaultGuidanceAdapter().pushGuidance(result);
        if (options?.json) {
          const nextCommands = getForceRejectionNextActions(taskId).map((a) => ({
            command: a.command,
            purpose: a.reason,
            when: a.reason,
            allowedFor: a.safety === "safe" ? "all" : a.safety === "requires_human" ? "human" : a.safety === "doctor_only" ? "doctor" : "all",
            priority: a.preferred ? 1 : 2
          }));
          writeResult(failedResult({ command: "start", taskId, error: "Normal agents may not use --force.", code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR", nextCommands }), options.json);
          return;
        }
        logError("Normal agents may not use --force.");
        logDivider();
        logInfo("Valid next actions:");
        logSub("1. taskforge doctor --json");
        logSub("   Reason: Diagnose whether a recovery path exists.");
        logSub("   Safety: safe");
        logSub(`2. taskforge block ${taskId} "Force operation requires human or doctor-mode authorization" --category unsafe_operation --blocked-by human`);
        logSub("   Reason: Escalate unsafe operation without bypassing TaskForge.");
        logSub("   Safety: requires_human");
        return;
      }
      throw err;
    }
    if (!options?.json) {
      logWarn(`Overriding stale claim from session "${task.assignee}" (authorized: ${authority}).`);
    }
  }
  if (!task.branch) {
    const titleMatch = task.body.match(/^#\s+\S+:\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : taskId;
    task.branch = makeBranchName(taskId, title, sessionId);
  } else {
    const oldSession = parseSessionIdFromBranch(task.branch);
    if (oldSession && oldSession !== sessionId) {
      const titleMatch = task.body.match(/^#\s+\S+:\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : taskId;
      task.branch = makeBranchName(taskId, title, sessionId);
    }
  }
  const contextHash = hashControlFiles(repoRoot);
  const pushed = await withTaskStateTransaction(
    { command: `claim ${taskId}`, maxRetries: 3 },
    async (tx) => {
      const fresh = tx.loadTask(taskId);
      if (!fresh) throw new Error("Task disappeared");
      if (fresh.assignee && fresh.assignee !== sessionId && !options?.force) {
        throw new Error(`Claimed by ${fresh.assignee}`);
      }
      tx.claimTask(taskId, sessionId);
      fresh.branch = task.branch;
      fresh.context_hash = contextHash;
      tx.updateTask(fresh);
      tx.appendNote(taskId, "System", [
        `Task claimed via taskforge start ${taskId}${options?.force ? " (forced)" : ""}`,
        `Session: ${sessionId}`,
        `Branch: ${task.branch}`
      ]);
      return true;
    }
  ).catch(() => false);
  if (!pushed) {
    const result = startStateMachine({
      taskFound: true,
      taskStatus: task.status,
      taskAssignee: task.assignee,
      taskClaimedAt: task.claimed_at ? String(task.claimed_at) : void 0,
      force: options?.force,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      worktreeCreated: false,
      taskId
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      writeResult(failedResult({ command: "start", taskId, error: result.guidance, code: result.errorCode ?? "PUSH_FAILED" }), options.json);
      return;
    }
    logError(result.guidance);
    return;
  }
  const claimedTask = loadTaskById(taskId);
  if (!claimedTask) {
    logError(`Task ${taskId} disappeared after claim.`);
    return;
  }
  claimedTask.branch = task.branch;
  try {
    const result = await createWorktree(repoRoot, task);
    task.worktree = result.path;
    if (!options?.json) {
      if (result.created) {
        logSuccess(`Created worktree at: ${result.path}`);
        logSuccess(`Created branch: ${result.branch}`);
      } else {
        logInfo(`Worktree already exists at: ${result.path}`);
      }
    }
  } catch (err) {
    const result = startStateMachine({
      taskFound: true,
      taskStatus: task.status,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: true,
      worktreeCreated: false,
      taskId
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      writeResult(failedResult({ command: "start", taskId, error: result.guidance, code: result.errorCode ?? "WORKTREE_FAILED" }), options.json);
      return;
    }
    throw new WorktreeError(
      `Could not create worktree: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  await withTaskStateTransaction(
    { command: `start ${taskId} [workspace]`, maxRetries: 2 },
    (tx) => {
      const t = tx.loadTask(taskId);
      if (t) {
        t.worktree = task.worktree;
        tx.updateTask(t);
        tx.appendNote(taskId, "System", [`Worktree created: ${task.worktree}`]);
      }
    }
  );
  if (task.worktree) {
    writeSessionState(task.worktree, {
      session_id: sessionId,
      task_id: taskId,
      claimed_at: (/* @__PURE__ */ new Date()).toISOString(),
      worktree_path: task.worktree,
      last_heartbeat: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  registerAgent(sessionId, taskId, task.worktree ?? null, repoRoot);
  const startResult = startStateMachine({
    taskFound: true,
    taskStatus: task.status,
    doctorLocked: false,
    hasOutstandingTask: false,
    pushSucceeded: true,
    worktreeCreated: true,
    taskId,
    sessionId,
    worktreePath: task.worktree,
    branch: task.branch
  });
  getDefaultGuidanceAdapter().pushGuidance(startResult);
  if (options?.json) {
    writeResult(successResult({
      command: "start",
      taskId: task.id,
      sessionId,
      branch: task.branch,
      worktree: task.worktree ?? void 0,
      guidance: startResult.guidance,
      nextCommands: [
        { command: "opencode", purpose: "Begin working on the task", when: "Begin working on the task", allowedFor: "all", priority: 1 }
      ]
    }), options.json);
    return;
  }
  logDivider();
  logHeader(`## Task Started: ${taskId}`);
  logSub(`**Title:** ${taskId}`);
  logSub(`**Session:** ${sessionId}`);
  logSub(`**Branch:** ${task.branch}`);
  logSub(`**Worktree:** ${task.worktree ?? "not created"}`);
  logDivider();
  logHeader(`### Agent Instructions`);
  logDivider();
  logSub(`1. cd ${task.worktree ?? repoRoot}`);
  logSub(`2. Read ${repoRoot}/TASKFORGE.md`);
  logSub(`3. Read ${repoRoot}/AGENTS.md (if present)`);
  logSub(`4. Read ${task.filePath}`);
  logSub(`5. Work only on ${taskId}`);
  logSub(`6. Use the continuation policy from TASKFORGE.md`);
  logSub(`7. Do not stop unless a human-intervention condition occurs`);
  logSub(`8. Update task notes before ending`);
  logDivider();
  logHeader(`### Quick Start`);
  logDivider();
  logSub(`cd ${task.worktree ?? repoRoot}`);
  logSub(`opencode`);
  logDivider();
  logInfo(startResult.guidance);
}

// src/commands/status.ts
function printTable(header, rows) {
  logHeader(`## ${header}`);
  logDivider();
  if (rows.length === 0) {
    logSub("None");
  } else {
    for (const row of rows) {
      const extra = row.extra ? ` [${row.extra}]` : "";
      const workspace = row.worktree ? ` [Worktree: ${row.worktree}]` : "";
      const branch = row.branch ? ` [Branch: ${row.branch}]` : "";
      logSub(`- **${row.id}**: ${row.title} (Priority: ${row.priority})${extra}${workspace}${branch}`);
    }
  }
  logDivider();
}
function makeRow(t) {
  const titleMatch = t.body.match(/^#\s+\S+:\s+(.+)$/m);
  return {
    id: t.id,
    title: titleMatch ? titleMatch[1] : t.id,
    priority: t.priority,
    worktree: t.worktree,
    branch: t.branch
  };
}
function makeDependencyInfo(t, allTasks) {
  const unmet = hasUnmetDependencies(t, allTasks);
  const dependents = getDependents(t.id, allTasks);
  const parts = [];
  if (unmet.length > 0) {
    parts.push(`Waiting on: ${unmet.join(", ")}`);
  }
  if (dependents.length > 0) {
    parts.push(`Blocks: ${dependents.map((d) => d.id).join(", ")}`);
  }
  return {
    extra: parts.length > 0 ? parts.join(" | ") : void 0,
    blockedBy: unmet.length > 0 ? unmet : void 0,
    blockedDependents: dependents.length > 0 ? dependents.map((d) => d.id) : void 0
  };
}
function buildJson(tasks) {
  const byStatus = {};
  const taskEntries = [];
  for (const t of tasks) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    const r = makeRow(t);
    const depInfo = makeDependencyInfo(t, tasks);
    taskEntries.push({
      id: r.id,
      title: r.title,
      priority: r.priority,
      status: t.status,
      dependsOn: t.dependsOn,
      blockedBy: depInfo.blockedBy,
      blockedDependents: depInfo.blockedDependents,
      worktree: t.worktree ?? void 0,
      branch: t.branch ?? void 0
    });
  }
  return { total: tasks.length, byStatus, tasks: taskEntries };
}
async function cmdStatus(json) {
  const tasks = loadAllTasks();
  if (json) {
    const output = buildJson(tasks);
    writeResult(successResult({
      command: "status",
      guidance: `TaskForge Status: ${output.total} total tasks, ${Object.entries(output.byStatus).map(([s, c]) => `${s}: ${c}`).join(", ")}.`
    }), json);
    return;
  }
  if (tasks.length === 0) {
    logInfo("No task files found.");
    return;
  }
  logHeader("# TaskForge Status");
  logDivider();
  const active = tasks.filter((t) => t.status === STATUS.IN_PROGRESS);
  const blocked = tasks.filter((t) => t.status === STATUS.BLOCKED);
  const ready = tasks.filter((t) => t.status === STATUS.READY);
  const review = tasks.filter((t) => t.status === STATUS.REVIEW);
  const verify = tasks.filter((t) => t.status === STATUS.VERIFY);
  const inbox = tasks.filter((t) => t.status === STATUS.INBOX);
  const needsSpec = tasks.filter((t) => t.status === STATUS.NEEDS_SPEC);
  const done = tasks.filter((t) => t.status === STATUS.DONE);
  const humanNeeded = tasks.filter((t) => t.humanInterventionRequired);
  const depBlocked = tasks.filter(
    (t) => (t.status === STATUS.READY || t.status === STATUS.IN_PROGRESS || t.status === STATUS.REVIEW || t.status === STATUS.VERIFY) && hasUnmetDependencies(t, tasks).length > 0
  );
  printTable("Active Work", active.map((t) => {
    const depInfo = makeDependencyInfo(t, tasks);
    return { ...makeRow(t), extra: depInfo.extra, worktree: t.worktree, branch: t.branch };
  }));
  printTable(STATUS.BLOCKED, blocked.map(makeRow));
  printTable("Dependency-Blocked", depBlocked.map((t) => {
    const depInfo = makeDependencyInfo(t, tasks);
    return { ...makeRow(t), extra: depInfo.extra ?? "Waiting on dependencies" };
  }));
  printTable("Ready Next", ready.filter((t) => !depBlocked.includes(t)).map(makeRow));
  logHeader("## In Review");
  logDivider();
  if (review.length === 0 && verify.length === 0) {
    logSub("None");
  } else {
    for (const t of review) {
      const r = makeRow(t);
      const depInfo = makeDependencyInfo(t, tasks);
      const extra = depInfo.extra ? ` [${depInfo.extra}]` : "";
      logSub(`- **${r.id}**: ${r.title} (Priority: ${r.priority}) [Review]${extra}`);
    }
    for (const t of verify) {
      const r = makeRow(t);
      const depInfo = makeDependencyInfo(t, tasks);
      const extra = depInfo.extra ? ` [${depInfo.extra}]` : "";
      logSub(`- **${r.id}**: ${r.title} (Priority: ${r.priority}) [Verify]${extra}`);
    }
  }
  logDivider();
  printTable(STATUS.INBOX, inbox.map(makeRow));
  printTable(STATUS.NEEDS_SPEC, needsSpec.map(makeRow));
  printTable("Completed", done.map(makeRow));
  logHeader("## Human Action Needed");
  logDivider();
  if (humanNeeded.length === 0) {
    logSub("None");
  } else {
    for (const t of humanNeeded) {
      const r = makeRow(t);
      logSub(`- **${r.id}**: ${r.title} (Priority: ${r.priority})`);
    }
  }
  logDivider();
  logHeader("## Summary");
  logDivider();
  logSub(`- **Total tasks:** ${tasks.length}`);
  logSub(`- **Active:** ${active.length}`);
  logSub(`- **Blocked:** ${blocked.length}`);
  logSub(`- **Dependency-Blocked:** ${depBlocked.length}`);
  logSub(`- **Ready:** ${ready.length - depBlocked.filter((t) => t.status === STATUS.READY).length}`);
  logSub(`- **Done:** ${done.length}`);
}

// src/util/timestamp.ts
function formatTimestampJson(date) {
  if (!date) return "";
  if (date instanceof Date) {
    return date.toISOString();
  }
  if (date.endsWith("Z")) return date;
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return date;
  return parsed.toISOString();
}
function formatTimestampMarkdown(date) {
  return formatTimestampJson(date);
}
function parseTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// src/commands/summary.ts
function makeLine(t) {
  const titleMatch = t.body.match(/^#\s+\S+:\s+(.+)$/m);
  return {
    id: t.id,
    title: titleMatch ? titleMatch[1] : t.id,
    priority: t.priority,
    role: t.agentRole ?? "Implementer",
    worktree: t.worktree,
    branch: t.branch
  };
}
function buildJson2(tasks) {
  const now = /* @__PURE__ */ new Date();
  const byStatus = {};
  const taskEntries = [];
  for (const t of tasks) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    const info = makeLine(t);
    taskEntries.push({ ...info, status: t.status });
  }
  const active = tasks.filter((t) => t.status === STATUS.IN_PROGRESS);
  const review = tasks.filter((t) => t.status === STATUS.REVIEW);
  const verify = tasks.filter((t) => t.status === STATUS.VERIFY);
  const needsSpec = tasks.filter((t) => t.status === STATUS.NEEDS_SPEC);
  const inbox = tasks.filter((t) => t.status === STATUS.INBOX);
  const next = selectNextTask(tasks);
  let nextAction;
  if (active.length > 0) {
    nextAction = "Continue existing in-progress work.";
  } else if (verify.length > 0) {
    nextAction = "Run QA/verification on tasks in Verify status.";
  } else if (review.length > 0) {
    nextAction = "Review tasks in Review status.";
  } else if (next) {
    nextAction = `Start the highest-priority task: ${next.id}`;
  } else if (needsSpec.length > 0) {
    nextAction = "Create specs for tasks in Needs Spec.";
  } else if (inbox.length > 0) {
    nextAction = "Process inbox items into structured tasks.";
  } else {
    nextAction = "No actionable tasks. Add work to the inbox.";
  }
  return {
    generated: formatTimestampJson(now),
    total: tasks.length,
    byStatus,
    nextAction,
    tasks: taskEntries
  };
}
async function cmdSummary(json) {
  const tasks = loadAllTasks();
  if (json) {
    const output = buildJson2(tasks);
    const result = successResult({
      command: "summary",
      guidance: `TaskForge Summary: ${output.total} total tasks. Next: ${output.nextAction}`
    });
    result.data = output;
    writeResult(result, json);
    return;
  }
  if (tasks.length === 0) {
    logInfo("No task files found.");
    return;
  }
  const now = /* @__PURE__ */ new Date();
  logHeader("# TaskForge Summary");
  logDivider();
  logSub(`Generated: ${formatTimestampMarkdown(now)}`);
  logDivider();
  const active = tasks.filter((t) => t.status === STATUS.IN_PROGRESS);
  const blocked = tasks.filter((t) => t.status === STATUS.BLOCKED);
  const ready = tasks.filter((t) => t.status === STATUS.READY);
  const review = tasks.filter((t) => t.status === STATUS.REVIEW);
  const verify = tasks.filter((t) => t.status === STATUS.VERIFY);
  const inbox = tasks.filter((t) => t.status === STATUS.INBOX);
  const needsSpec = tasks.filter((t) => t.status === STATUS.NEEDS_SPEC);
  const done = tasks.filter((t) => t.status === STATUS.DONE);
  const humanNeeded = tasks.filter((t) => t.humanInterventionRequired);
  const displayLine = (t) => {
    const { id, title, priority, role, worktree, branch } = makeLine(t);
    const workspace = worktree ? ` [Worktree: ${worktree}]` : "";
    const br = branch ? ` [Branch: ${branch}]` : "";
    return `- **${id}**: ${title} (Priority: ${priority}, Role: ${role})${workspace}${br}`;
  };
  logHeader("## Active Work");
  logDivider();
  if (active.length === 0) logSub("None");
  else active.forEach((t) => logSub(displayLine(t)));
  logDivider();
  logHeader("## Blocked");
  logDivider();
  if (blocked.length === 0) logSub("None");
  else blocked.forEach((t) => logSub(displayLine(t)));
  logDivider();
  logHeader("## Ready Next");
  logDivider();
  if (ready.length === 0) logSub("None");
  else ready.forEach((t) => logSub(displayLine(t)));
  logDivider();
  logHeader("## In Review");
  logDivider();
  if (review.length === 0 && verify.length === 0) {
    logSub("None");
  } else {
    review.forEach((t) => logSub(`${displayLine(t)} [Review]`));
    verify.forEach((t) => logSub(`${displayLine(t)} [Verify]`));
  }
  logDivider();
  logHeader("## Completed");
  logDivider();
  if (done.length === 0) logSub("None");
  else done.forEach((t) => logSub(displayLine(t)));
  logDivider();
  logHeader("## Inbox");
  logDivider();
  if (inbox.length === 0) logSub("None");
  else inbox.forEach((t) => logSub(displayLine(t)));
  logDivider();
  logHeader("## Needs Spec");
  logDivider();
  if (needsSpec.length === 0) logSub("None");
  else needsSpec.forEach((t) => logSub(displayLine(t)));
  logDivider();
  logHeader("## Human Action Needed");
  logDivider();
  if (humanNeeded.length === 0) logSub("None");
  else humanNeeded.forEach((t) => logSub(displayLine(t)));
  logDivider();
  logHeader("## Recommended Next Action");
  logDivider();
  const next = selectNextTask(tasks);
  if (active.length > 0) {
    logSub("Continue existing in-progress work.");
  } else if (verify.length > 0) {
    logSub("Run QA/verification on tasks in Verify status.");
  } else if (review.length > 0) {
    logSub("Review tasks in Review status.");
  } else if (next) {
    logSub(`Start the highest-priority task: ${next.id}`);
  } else if (needsSpec.length > 0) {
    logSub("Create specs for tasks in Needs Spec.");
  } else if (inbox.length > 0) {
    logSub("Process inbox items into structured tasks.");
  } else {
    logSub("No actionable tasks. Add work to the inbox.");
  }
  logDivider();
  logHeader("## Summary");
  logDivider();
  logSub(`- **Total tasks:** ${tasks.length}`);
  logSub(`- **Active:** ${active.length}`);
  logSub(`- **Blocked:** ${blocked.length}`);
  logSub(`- **Ready:** ${ready.length}`);
  logSub(`- **Done:** ${done.length}`);
}

// src/commands/gates.ts
import { execa as execa2 } from "execa";
async function runGates(options) {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);
  const availableGates = {
    typecheck: config.gates?.typecheck ?? "npm run typecheck",
    lint: config.gates?.lint ?? "npm run lint",
    build: config.gates?.build ?? "npm run build",
    test: config.gates?.test ?? "npm test -- --run"
  };
  let gateNames;
  if (options?.only) {
    gateNames = options.only.split(",").map((g) => g.trim());
  } else {
    gateNames = Object.keys(availableGates);
  }
  const invalidGates = gateNames.filter((g) => !(g in availableGates));
  if (invalidGates.length > 0) {
    return { passed: false, results: [] };
  }
  const results = [];
  let allPassed = true;
  for (const name of gateNames) {
    const command = availableGates[name];
    const start = process.hrtime.bigint();
    try {
      await execa2(command, { shell: true, cwd: repoRoot });
      const duration = Number(process.hrtime.bigint() - start) / 1e6;
      results.push({ name, command, passed: true, duration });
    } catch {
      const duration = Number(process.hrtime.bigint() - start) / 1e6;
      results.push({ name, command, passed: false, duration });
      allPassed = false;
    }
  }
  return { passed: allPassed, results };
}
async function cmdGates(options) {
  const { passed, results } = await runGates(options);
  const failedGates = results.filter((r) => !r.passed).map((r) => ({ name: r.name, command: r.command }));
  const result = gatesStateMachine({
    totalGates: results.length,
    passedGates: results.filter((r) => r.passed).length,
    failedGates
  });
  getDefaultGuidanceAdapter().pushGuidance(result);
  if (!options?.json) {
    logHeader("# TaskForge Gates");
    logDivider();
    for (const r of results) {
      if (r.passed) {
        logSuccess(`\u2713 ${r.name} (${r.duration.toFixed(0)}ms): ${r.command}`);
      } else {
        logError(`\u2717 ${r.name} (${r.duration.toFixed(0)}ms): ${r.command}`);
      }
    }
    logDivider();
    logInfo(result.guidance);
  } else {
    writeResult(successResult({
      command: "gates",
      guidance: result.guidance
    }), options.json);
  }
  return passed;
}

// src/commands/block.ts
async function cmdBlock(taskId, reason, options = {}) {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);
  if (!task) {
    if (options.json) {
      writeResult(failedResult({ command: "block", taskId, error: `Task ${taskId} not found`, code: "TASK_NOT_FOUND" }), options.json);
      return;
    }
    throw new TaskNotFoundError(taskId);
  }
  const transitionError = validateTransition(task.status, STATUS.BLOCKED);
  if (transitionError) {
    const allowed = getAllowedTransitions(task.status);
    if (options.json) {
      const nextCommands = (allowed.includes("Done") ? ["done"] : ["start"]).map((cmd) => ({
        command: `taskforge ${cmd}${cmd === "done" ? ` ${taskId}` : ""}`,
        purpose: cmd === "done" ? "Mark the task as Done" : "Start the task",
        when: "after invalid transition attempt",
        allowedFor: "all",
        priority: 1
      }));
      writeResult(failedResult({
        command: "block",
        taskId,
        error: `Cannot transition from "${task.status}" to "${STATUS.BLOCKED}". Allowed: ${allowed.join(", ")}`,
        code: "INVALID_TRANSITION",
        nextCommands
      }), options.json);
      return;
    }
    throw new InvalidStatusTransitionError(task.status, STATUS.BLOCKED, allowed);
  }
  if (task.assignee) {
    await assertTaskOwnership(task, repoRoot);
  }
  const current = parseTaskFile(task.filePath);
  if (!current) {
    throw new TaskNotFoundError(taskId);
  }
  current.status = STATUS.BLOCKED;
  current.blocked_reason = reason;
  current.block_category = options.category ?? "unspecified";
  current.blocked_by = options.blockedBy ?? "unspecified";
  current.blocked_since = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
  writeTaskFile(current);
  clearTaskLock(task.filePath);
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const catLabel = options.category ? ` [${options.category}]` : "";
  appendAgentNote(task.filePath, today, "System", [
    `Task blocked${catLabel}: ${reason}`,
    options.blockedBy ? `Blocked by: ${options.blockedBy}` : ""
  ].filter(Boolean));
  await commitAndPushTaskState(repoRoot, `chore: block ${taskId} \u2014 ${reason}`);
  if (options.json) {
    writeResult(successResult({
      command: "block",
      taskId,
      guidance: `Task ${taskId} is now blocked. Run 'taskforge next' to find the next available task, or 'taskforge resume <taskId>' to continue working on another in-progress task.`,
      nextCommands: [
        { command: "taskforge next", purpose: "Find the next available task", when: "after blocking task", allowedFor: "all", priority: 1 },
        { command: `taskforge resume ${taskId}`, purpose: "Continue working on another in-progress task", when: "after blocking task", allowedFor: "all", priority: 2 }
      ]
    }), options.json);
    return;
  }
  logSuccess(`Task ${taskId} blocked: ${reason}`);
  if (options.category && options.category !== "unspecified") {
    logSub(`  Category: ${options.category}`);
  }
  logDivider();
  logInfo("Next actions:");
  logSub("  taskforge next          \u2014 Find the next available task");
  logSub("  taskforge resume <id>   \u2014 Continue working on another in-progress task");
}

// src/core/audit.ts
import fs8 from "fs";
import path8 from "path";

// src/core/audit-schema.ts
import { z as z2 } from "zod";
var AUDIT_EVENT_TYPES = [
  "task.command.started",
  "task.command.completed",
  "task.command.failed",
  "task.state.changed",
  "git.commit",
  "git.push",
  "tool.execute.before",
  "tool.execute.after",
  "tool.execute",
  "file.edited",
  "permission.asked",
  "permission.replied",
  "permission.requested",
  "permission.responded",
  "doctor.lock.created",
  "doctor.lock.released",
  "doctor.fix.applied",
  "verification.started",
  "verification.completed",
  "verification.failed",
  "session.started",
  "github.pr.created",
  "github.pr.manual",
  "github.pr.failed"
];
var AuditEventSchema = z2.object({
  timestamp: z2.string(),
  event: z2.enum(AUDIT_EVENT_TYPES),
  taskId: z2.string().optional(),
  sessionId: z2.string().optional(),
  agent: z2.string().optional(),
  summary: z2.string().optional(),
  metadata: z2.record(z2.unknown()).optional()
});

// src/core/audit.ts
var AUDIT_BASE = "logs/taskforge";
function auditDir(root) {
  const dir = path8.join(root, AUDIT_BASE, "audit");
  fs8.mkdirSync(dir, { recursive: true });
  return dir;
}
function taskAuditDir(root, taskId) {
  const dir = path8.join(root, AUDIT_BASE, "tasks", taskId);
  fs8.mkdirSync(dir, { recursive: true });
  return dir;
}
function appendAuditEvent(repoRoot, event) {
  const dir = auditDir(repoRoot);
  const filePath = path8.join(dir, "events.jsonl");
  writeJsonl(filePath, event);
}
function appendTaskTranscript(repoRoot, taskId, event) {
  const dir = taskAuditDir(repoRoot, taskId);
  const filePath = path8.join(dir, "transcript.jsonl");
  writeJsonl(filePath, event);
}
function readTaskAudit(repoRoot, taskId) {
  const filePath = path8.join(taskAuditDir(repoRoot, taskId), "transcript.jsonl");
  return readJsonl(filePath);
}
function summarizeTaskAudit(repoRoot, taskId) {
  const events = readTaskAudit(repoRoot, taskId);
  const byType = {};
  let firstTimestamp = "";
  let lastTimestamp = "";
  let errorCount = 0;
  const entries = [];
  for (const event of events) {
    byType[event.event] = (byType[event.event] ?? 0) + 1;
    if (!firstTimestamp || event.timestamp < firstTimestamp) firstTimestamp = event.timestamp;
    if (!lastTimestamp || event.timestamp > lastTimestamp) lastTimestamp = event.timestamp;
    if (event.event.includes("failed") || event.event.includes("error")) errorCount++;
    const detail = extractEventDetail(event);
    entries.push({
      timestamp: event.timestamp,
      event: event.event,
      summary: event.summary ?? event.event,
      detail
    });
  }
  let durationMinutes;
  if (firstTimestamp && lastTimestamp) {
    const ms = new Date(lastTimestamp).getTime() - new Date(firstTimestamp).getTime();
    durationMinutes = Math.round(ms / 6e4);
  }
  return {
    taskId,
    totalEvents: events.length,
    firstEvent: firstTimestamp,
    lastEvent: lastTimestamp,
    errorCount,
    eventCounts: byType,
    entries,
    durationMinutes
  };
}
function extractEventDetail(event) {
  const meta = event.metadata;
  if (!meta) return void 0;
  if (event.event === "git.commit" && typeof meta.message === "string") {
    return meta.message;
  }
  if (event.event === "git.push" && typeof meta.branch === "string") {
    return `Pushed ${meta.branch}`;
  }
  if (event.event === "task.state.changed" && typeof meta.from === "string" && typeof meta.to === "string") {
    return `${meta.from} \u2192 ${meta.to}`;
  }
  if (event.event === "file.edited" && typeof meta.file === "string") {
    const lines = meta.linesAdded ? ` (+${meta.linesAdded})` : "";
    return meta.file + lines;
  }
  if (event.event === "tool.execute" && typeof meta.tool === "string") {
    return meta.tool;
  }
  if (typeof meta.notes === "string") {
    return meta.notes;
  }
  return void 0;
}
function validateJsonlFiles(repoRoot) {
  const issues = [];
  const baseDir = path8.join(repoRoot, AUDIT_BASE);
  if (!fs8.existsSync(baseDir)) return issues;
  const jsonlFiles = findJsonlFiles(baseDir);
  for (const filePath of jsonlFiles) {
    const content = fs8.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        const result = AuditEventSchema.safeParse(parsed);
        if (!result.success) {
          issues.push({
            filePath,
            line: i + 1,
            content: line.slice(0, 100),
            reason: "schema_error"
          });
        }
      } catch {
        issues.push({
          filePath,
          line: i + 1,
          content: line.slice(0, 100),
          reason: "parse_error"
        });
      }
    }
  }
  return issues;
}
function findJsonlFiles(dir) {
  const files = [];
  const entries = fs8.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path8.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findJsonlFiles(fullPath));
    } else if (entry.name.endsWith(".jsonl")) {
      files.push(fullPath);
    }
  }
  return files;
}
function createAuditEvent(event, overrides) {
  return {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    event,
    ...overrides
  };
}
function createTaskEvent(taskId, event, overrides) {
  return createAuditEvent(event, { ...overrides, taskId });
}
function writeJsonl(filePath, event) {
  const dir = path8.dirname(filePath);
  fs8.mkdirSync(dir, { recursive: true });
  const line = JSON.stringify(event) + "\n";
  fs8.appendFileSync(filePath, line, "utf-8");
}
function readJsonl(filePath) {
  if (!fs8.existsSync(filePath)) return [];
  const content = fs8.readFileSync(filePath, "utf-8");
  const events = [];
  for (const line of content.trim().split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      const result = AuditEventSchema.safeParse(parsed);
      if (result.success) {
        events.push(result.data);
      } else {
        logWarn(`Skipping invalid audit line: ${line.slice(0, 80)}...`);
      }
    } catch {
      logWarn(`Skipping unparseable audit line: ${line.slice(0, 80)}...`);
    }
  }
  return events;
}

// src/core/completion-policy.ts
function isCodeTask(task) {
  if (task.code_task !== void 0) return task.code_task;
  const nonCodeTypes = /* @__PURE__ */ new Set([
    "Documentation",
    "Research",
    "Release",
    "Dependency",
    "Maintenance",
    "Chore"
  ]);
  return !nonCodeTypes.has(task.type ?? "Task");
}
async function checkCompletionEligibility(task, config, verifier) {
  const preconditions = [];
  const reasons = [];
  if (!isCodeTask(task)) {
    preconditions.push({
      name: "Non-code task policy",
      passed: true,
      message: `Task type "${task.type}" does not require PR verification`,
      code: "NON_CODE_TASK"
    });
    return { eligible: true, reasons: [], preconditions };
  }
  const integrationBranch = config.integrationBranch ?? "main";
  if (!task.pr) {
    preconditions.push({
      name: "PR recorded",
      passed: false,
      message: "No pull request recorded. Create a PR with 'taskforge pr'",
      code: "NO_PR_RECORDED"
    });
    reasons.push("No pull request recorded");
  } else {
    preconditions.push({
      name: "PR recorded",
      passed: true,
      message: `Pull request #${task.pr} recorded`,
      code: "PR_RECORDED"
    });
  }
  if (task.pr_base_branch && task.pr_base_branch !== integrationBranch) {
    preconditions.push({
      name: "PR base branch",
      passed: false,
      message: `PR #${task.pr} targets "${task.pr_base_branch}", expected "${integrationBranch}"`,
      code: "WRONG_BASE_BRANCH"
    });
    reasons.push(`PR base branch mismatch: ${task.pr_base_branch} (expected ${integrationBranch})`);
  } else if (task.pr) {
    preconditions.push({
      name: "PR base branch",
      passed: true,
      message: `PR targets "${task.pr_base_branch ?? integrationBranch}"`,
      code: "BASE_BRANCH_OK"
    });
  }
  if (task.pr_head_sha && task.submitted_sha && task.pr_head_sha !== task.submitted_sha) {
    preconditions.push({
      name: "SHA match",
      passed: false,
      message: `PR head SHA (${task.pr_head_sha.slice(0, 12)}) does not match submitted SHA (${task.submitted_sha.slice(0, 12)})`,
      code: "SHA_MISMATCH"
    });
    reasons.push("PR head SHA does not match submitted SHA");
  } else if (task.pr && !task.submitted_sha) {
    preconditions.push({
      name: "SHA match",
      passed: false,
      message: "Submitted SHA not recorded in task. Use 'taskforge submit' first",
      code: "NO_SUBMITTED_SHA"
    });
    reasons.push("Submitted SHA not recorded");
  } else if (task.pr) {
    preconditions.push({
      name: "SHA match",
      passed: true,
      message: "PR head SHA matches submitted SHA",
      code: "SHA_MATCH_OK"
    });
  }
  if (task.pr_merged === false && task.pr) {
    preconditions.push({
      name: "PR merged",
      passed: false,
      message: `PR #${task.pr} is not merged`,
      code: "PR_NOT_MERGED"
    });
    reasons.push("Pull request not merged");
  } else if (task.pr && verifier) {
    try {
      const { github } = config;
      if (github?.owner && github?.repo) {
        const result = await verifier.checkMerged({
          owner: github.owner,
          repo: github.repo,
          prNumber: task.pr
        });
        if (result.merged) {
          preconditions.push({
            name: "PR merged",
            passed: true,
            message: `PR #${task.pr} is merged (merge commit: ${result.mergeCommitSha?.slice(0, 12) ?? "unknown"})`,
            code: "PR_MERGED"
          });
        } else {
          preconditions.push({
            name: "PR merged",
            passed: false,
            message: `PR #${task.pr} is not yet merged`,
            code: "PR_NOT_MERGED"
          });
          reasons.push("Pull request not merged");
        }
      }
    } catch {
      preconditions.push({
        name: "PR merged",
        passed: false,
        message: "Could not verify PR merge status",
        code: "VERIFY_ERROR"
      });
      reasons.push("Could not verify PR merge status");
    }
  } else if (task.pr_merged === true) {
    preconditions.push({
      name: "PR merged",
      passed: true,
      message: "PR marked as merged in task metadata",
      code: "PR_MERGED_RECORDED"
    });
  }
  if (task.submitted_sha && verifier && config.github?.owner && config.github?.repo) {
    try {
      const reachable = await verifier.checkReachable({
        owner: config.github.owner,
        repo: config.github.repo,
        sha: task.submitted_sha,
        branch: integrationBranch
      });
      if (reachable) {
        preconditions.push({
          name: "SHA reachable",
          passed: true,
          message: `SHA ${task.submitted_sha.slice(0, 12)} reachable from ${integrationBranch}`,
          code: "SHA_REACHABLE"
        });
      } else {
        preconditions.push({
          name: "SHA reachable",
          passed: false,
          message: `SHA ${task.submitted_sha.slice(0, 12)} not reachable from ${integrationBranch}`,
          code: "SHA_NOT_REACHABLE"
        });
        reasons.push("Submitted SHA not reachable from integration branch");
      }
    } catch {
      preconditions.push({
        name: "SHA reachable",
        passed: false,
        message: "Could not verify SHA reachability",
        code: "REACHABLE_VERIFY_ERROR"
      });
      reasons.push("Could not verify SHA reachability");
    }
  } else if (task.submitted_sha && !verifier) {
    preconditions.push({
      name: "SHA reachable",
      passed: true,
      message: "No verifier configured \u2014 skipping reachability check",
      code: "NO_VERIFIER_SKIP"
    });
  }
  if (task.pr && verifier && config.github?.owner && config.github?.repo) {
    try {
      const checks = await verifier.checkRequiredChecks({
        owner: config.github.owner,
        repo: config.github.repo,
        prNumber: task.pr
      });
      if (checks.passed) {
        preconditions.push({
          name: "Required checks",
          passed: true,
          message: "All required checks pass",
          code: "CHECKS_PASSED"
        });
      } else {
        const issues = [];
        if (checks.failing.length > 0) issues.push(`failing: ${checks.failing.join(", ")}`);
        if (checks.pending.length > 0) issues.push(`pending: ${checks.pending.join(", ")}`);
        preconditions.push({
          name: "Required checks",
          passed: false,
          message: `Checks not passing: ${issues.join("; ")}`,
          code: "CHECKS_FAILED"
        });
        reasons.push("Required checks are not passing");
      }
    } catch {
      preconditions.push({
        name: "Required checks",
        passed: false,
        message: "Could not verify required checks",
        code: "CHECKS_VERIFY_ERROR"
      });
      reasons.push("Could not verify required checks");
    }
  } else if (task.pr && !verifier) {
    preconditions.push({
      name: "Required checks",
      passed: true,
      message: "No verifier configured \u2014 skipping checks verification",
      code: "NO_VERIFIER_CHECKS_SKIP"
    });
  }
  const eligible = preconditions.every((p) => p.passed);
  let suggestedStatus;
  if (!eligible) {
    if (!task.pr) {
      suggestedStatus = STATUS.SUBMITTED;
    } else if (task.pr_merged === false) {
      suggestedStatus = STATUS.MERGE_READY;
    } else {
      suggestedStatus = STATUS.VERIFY;
    }
  }
  return { eligible, reasons, preconditions, suggestedStatus };
}

// src/core/pr-verifier.ts
import { Octokit } from "@octokit/rest";
var GitHubPullRequestVerifier = class {
  octokit;
  constructor(token) {
    this.octokit = new Octokit(token ? { auth: token } : {});
  }
  async checkMerged(params) {
    try {
      const { data } = await this.octokit.pulls.get({
        owner: params.owner,
        repo: params.repo,
        pull_number: params.prNumber
      });
      if (data.merged) {
        return {
          merged: true,
          mergeCommitSha: data.merge_commit_sha ?? void 0
        };
      }
      if (data.state === "closed") {
        const { data: prData } = await this.octokit.pulls.get({
          owner: params.owner,
          repo: params.repo,
          pull_number: params.prNumber
        });
        if (prData.merged_at || prData.merge_commit_sha) {
          return {
            merged: true,
            mergeCommitSha: prData.merge_commit_sha ?? void 0
          };
        }
      }
      return { merged: false };
    } catch {
      return { merged: false };
    }
  }
  async getHeadSha(params) {
    try {
      const { data } = await this.octokit.pulls.get({
        owner: params.owner,
        repo: params.repo,
        pull_number: params.prNumber
      });
      return data.head?.sha ?? null;
    } catch {
      return null;
    }
  }
  async checkReachable(params) {
    try {
      const { data } = await this.octokit.repos.listCommits({
        owner: params.owner,
        repo: params.repo,
        sha: params.branch,
        per_page: 1
      });
      if (data.length === 0) return false;
      try {
        await this.octokit.repos.getCommit({
          owner: params.owner,
          repo: params.repo,
          ref: params.sha
        });
        return true;
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }
  async checkRequiredChecks(params) {
    try {
      const { data } = await this.octokit.checks.listForRef({
        owner: params.owner,
        repo: params.repo,
        ref: `refs/pull/${params.prNumber}/head`
      });
      const pending = [];
      const failing = [];
      for (const check of data.check_runs) {
        if (check.conclusion === "success" || check.conclusion === "neutral") {
          continue;
        }
        if (check.status === "completed") {
          failing.push(`${check.name}: ${check.conclusion}`);
        } else {
          pending.push(`${check.name}: ${check.status}`);
        }
      }
      return {
        passed: failing.length === 0 && pending.length === 0,
        pending,
        failing
      };
    } catch {
      return { passed: false, pending: [], failing: ["Could not verify checks"] };
    }
  }
};

// src/commands/done.ts
function mapNextAction(action) {
  switch (action) {
    case "request_human_input":
      return { command: "block", purpose: "Request human input to resolve", when: "needs:human", allowedFor: "human", priority: 3 };
    case "work_on_task":
      return { command: "checkpoint", purpose: "Commit changes and retry", when: "worktree:modified", allowedFor: "agent", priority: 2 };
    case "none":
    default:
      return { command: "next", purpose: "Find the next available task", when: "task:done", allowedFor: "all", priority: 1 };
  }
}
async function cmdDone(taskId, options = {}) {
  const { cleanup = false, deleteBranch = false, json = false } = options;
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);
  if (!task) {
    const result = doneStateMachine({
      validTransition: false,
      gatesPassed: false,
      ownershipMatch: false,
      worktreeClean: false,
      branchPushed: false,
      controlFileHashMatch: false,
      hasAcSection: false,
      hasBlankAc: false,
      hasUncheckedAc: false,
      taskId
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "done", error: result.guidance, code: result.errorCode ?? "TASK_NOT_FOUND", nextCommands: [mapNextAction(result.nextAction)] }), json);
      return;
    }
    throw new TaskNotFoundError(taskId);
  }
  const { passed: gatesPassed, results: gateResults } = await runGates();
  if (!json) {
    logHeader("# TaskForge Gates");
    logDivider();
    for (const r of gateResults) {
      if (r.passed) {
        logSuccess(`\u2713 ${r.name} (${r.duration.toFixed(0)}ms): ${r.command}`);
      } else {
        logError(`\u2717 ${r.name} (${r.duration.toFixed(0)}ms): ${r.command}`);
      }
    }
    logDivider();
    if (gatesPassed) {
      logSuccess(`All ${gateResults.length} gate(s) passed.`);
    } else {
      const failedCount = gateResults.filter((r) => !r.passed).length;
      logError(`${failedCount}/${gateResults.length} gate(s) failed.`);
    }
  }
  if (!gatesPassed) {
    const result = doneStateMachine({
      validTransition: true,
      gatesPassed: false,
      ownershipMatch: true,
      worktreeClean: true,
      branchPushed: true,
      controlFileHashMatch: true,
      hasAcSection: true,
      hasBlankAc: false,
      hasUncheckedAc: false,
      taskId,
      currentStatus: task.status
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "done", error: result.guidance, code: result.errorCode ?? "GATES_FAILED" }), json);
      return;
    }
    throw new Error(result.guidance);
  }
  const transitionError = validateTransition(task.status, STATUS.DONE);
  if (transitionError) {
    const result = doneStateMachine({
      validTransition: false,
      gatesPassed: true,
      ownershipMatch: true,
      worktreeClean: true,
      branchPushed: true,
      controlFileHashMatch: true,
      hasAcSection: true,
      hasBlankAc: false,
      hasUncheckedAc: false,
      taskId,
      currentStatus: task.status
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "done", error: result.guidance, code: result.errorCode ?? "INVALID_TRANSITION", nextCommands: [mapNextAction(result.nextAction)] }), json);
      return;
    }
    throw new InvalidStatusTransitionError(
      task.status,
      STATUS.DONE,
      [STATUS.REVIEW, STATUS.VERIFY]
    );
  }
  if (task.assignee) {
    try {
      await assertTaskOwnership(task, repoRoot);
    } catch {
      const result = doneStateMachine({
        validTransition: true,
        gatesPassed: true,
        ownershipMatch: false,
        worktreeClean: true,
        branchPushed: true,
        controlFileHashMatch: true,
        hasAcSection: true,
        hasBlankAc: false,
        hasUncheckedAc: false,
        taskId,
        currentStatus: task.status
      });
      getDefaultGuidanceAdapter().pushGuidance(result);
      if (json) {
        writeResult(failedResult({ command: "done", error: result.guidance, code: result.errorCode ?? "OWNERSHIP_MISMATCH", nextCommands: [mapNextAction(result.nextAction)] }), json);
        return;
      }
      throw new Error(result.guidance);
    }
  }
  if (task.worktree) {
    const dirtyFiles = await getWorktreeDirtyFiles(task.worktree);
    if (dirtyFiles.length > 0) {
      const result = doneStateMachine({
        validTransition: true,
        gatesPassed: true,
        ownershipMatch: true,
        worktreeClean: false,
        branchPushed: true,
        controlFileHashMatch: true,
        hasAcSection: true,
        hasBlankAc: false,
        hasUncheckedAc: false,
        dirtyFiles,
        taskId,
        currentStatus: task.status
      });
      getDefaultGuidanceAdapter().pushGuidance(result);
      if (json) {
        writeResult(failedResult({ command: "done", error: result.guidance, code: result.errorCode ?? "WORKTREE_DIRTY", nextCommands: [mapNextAction(result.nextAction)] }), json);
        return;
      }
      throw new Error(result.guidance);
    }
  }
  if (task.branch) {
    const commitsAhead = await getBranchCommitsAhead(repoRoot, task.branch);
    if (commitsAhead > 0) {
      const result = doneStateMachine({
        validTransition: true,
        gatesPassed: true,
        ownershipMatch: true,
        worktreeClean: true,
        branchPushed: false,
        controlFileHashMatch: true,
        hasAcSection: true,
        hasBlankAc: false,
        hasUncheckedAc: false,
        commitsAhead,
        taskId,
        currentStatus: task.status
      });
      getDefaultGuidanceAdapter().pushGuidance(result);
      if (json) {
        writeResult(failedResult({ command: "done", error: result.guidance, code: result.errorCode ?? "BRANCH_UNPUSHED", nextCommands: [mapNextAction(result.nextAction)] }), json);
        return;
      }
      throw new Error(result.guidance);
    }
  }
  if (task.context_hash) {
    const currentHash = hashControlFiles(repoRoot);
    if (currentHash !== task.context_hash) {
      const result = doneStateMachine({
        validTransition: true,
        gatesPassed: true,
        ownershipMatch: true,
        worktreeClean: true,
        branchPushed: true,
        controlFileHashMatch: false,
        hasAcSection: true,
        hasBlankAc: false,
        hasUncheckedAc: false,
        taskId,
        currentStatus: task.status
      });
      getDefaultGuidanceAdapter().pushGuidance(result);
      if (json) {
        writeResult(failedResult({ command: "done", error: result.guidance, code: result.errorCode ?? "CONTEXT_CHANGED", nextCommands: [mapNextAction(result.nextAction)] }), json);
        return;
      }
      throw new Error(result.guidance);
    }
  }
  if (!hasAcceptanceCriteriaSection(task.body)) {
    const result = doneStateMachine({
      validTransition: true,
      gatesPassed: true,
      ownershipMatch: true,
      worktreeClean: true,
      branchPushed: true,
      controlFileHashMatch: true,
      hasAcSection: false,
      hasBlankAc: false,
      hasUncheckedAc: false,
      taskId,
      currentStatus: task.status
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "done", error: result.guidance, code: result.errorCode ?? "MISSING_ACCEPTANCE_CRITERIA", nextCommands: [mapNextAction(result.nextAction)] }), json);
      return;
    }
    throw new MissingAcceptanceCriteriaError(taskId);
  }
  if (hasBlankAcceptanceCriteria(task.body)) {
    const result = doneStateMachine({
      validTransition: true,
      gatesPassed: true,
      ownershipMatch: true,
      worktreeClean: true,
      branchPushed: true,
      controlFileHashMatch: true,
      hasAcSection: true,
      hasBlankAc: true,
      hasUncheckedAc: false,
      taskId,
      currentStatus: task.status
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "done", error: result.guidance, code: result.errorCode ?? "BLANK_ACCEPTANCE_CRITERIA", nextCommands: [mapNextAction(result.nextAction)] }), json);
      return;
    }
    throw new BlankAcceptanceCriteriaError(taskId);
  }
  if (hasUncheckedAcceptanceCriteria(task.body)) {
    const result = doneStateMachine({
      validTransition: true,
      gatesPassed: true,
      ownershipMatch: true,
      worktreeClean: true,
      branchPushed: true,
      controlFileHashMatch: true,
      hasAcSection: true,
      hasBlankAc: false,
      hasUncheckedAc: true,
      taskId,
      currentStatus: task.status
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "done", error: result.guidance, code: result.errorCode ?? "UNCHECKED_ACCEPTANCE_CRITERIA", nextCommands: [mapNextAction(result.nextAction)] }), json);
      return;
    }
    throw new UncheckedAcceptanceCriteriaError(taskId);
  }
  const config = loadConfig(repoRoot);
  const githubConfig = config.github;
  let verifier;
  if (githubConfig?.enabled && githubConfig.owner && githubConfig.repo) {
    verifier = new GitHubPullRequestVerifier(process.env.GITHUB_TOKEN);
  }
  const eligibility = await checkCompletionEligibility(
    task,
    {
      github: githubConfig,
      integrationBranch: config.project?.defaultBranch ?? "main"
    },
    verifier
  );
  if (!eligibility.eligible) {
    const details = eligibility.preconditions.filter((p) => !p.passed).map((p) => `  [${p.code}] ${p.message}`).join("\n");
    const message = [
      `Task ${taskId} cannot enter Done:`,
      details,
      eligibility.suggestedStatus ? `
Suggested next status: ${eligibility.suggestedStatus}` : ""
    ].filter(Boolean).join("\n");
    if (!json) {
      logError(message);
    }
    const result = doneStateMachine({
      validTransition: true,
      gatesPassed: true,
      ownershipMatch: true,
      worktreeClean: true,
      branchPushed: true,
      controlFileHashMatch: true,
      hasAcSection: true,
      hasBlankAc: false,
      hasUncheckedAc: false,
      taskId,
      currentStatus: task.status
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "done", error: message, code: "COMPLETION_POLICY_BLOCKED", nextCommands: [mapNextAction(result.nextAction)] }), json);
      return;
    }
    throw new Error(message);
  }
  if (!json && eligibility.preconditions.length > 0) {
    logSuccess("Completion policy: all preconditions satisfied");
  }
  updateTaskStatus(task.filePath, STATUS.DONE);
  clearTaskLock(task.filePath);
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const notes = [
    "Task marked Done"
  ].filter(Boolean);
  if (isDoctorLocked(repoRoot).locked) {
    removeDoctorLock(repoRoot);
    if (!json) logInfo("Doctor lock removed \u2014 recovery task completed.");
  }
  const successResult2 = doneStateMachine({
    validTransition: true,
    gatesPassed: true,
    ownershipMatch: true,
    worktreeClean: true,
    branchPushed: true,
    controlFileHashMatch: true,
    hasAcSection: true,
    hasBlankAc: false,
    hasUncheckedAc: false,
    taskId,
    currentStatus: task.status
  });
  getDefaultGuidanceAdapter().pushGuidance(successResult2);
  if (json) {
    writeResult(successResult({ command: "done", taskId: task.id, guidance: successResult2.guidance, nextCommands: [mapNextAction(successResult2.nextAction)] }), json);
    return;
  }
  logSuccess(successResult2.guidance);
  writeResult(successResult({ command: "done", taskId: task.id, guidance: successResult2.guidance, nextCommands: [mapNextAction(successResult2.nextAction)] }), json);
  logDivider();
  logInfo("Next actions:");
  logSub("  taskforge next              \u2014 Find the next available task");
  logSub(`  taskforge done ${taskId} --cleanup  \u2014 Remove worktree and branch`);
  logSub(`  taskforge done ${taskId} --delete-branch \u2014 Delete branch only`);
  appendTaskTranscript(repoRoot, taskId, createTaskEvent(taskId, "task.command.completed", {
    summary: `Task ${taskId} marked as Done`,
    metadata: { notes }
  }));
  if (task.worktree) {
    removeSessionState(task.worktree);
  }
  if (task.assignee) {
    markAgentIdle(task.assignee, repoRoot);
  }
  if (cleanup) {
    await performCleanup(repoRoot, task, deleteBranch, today, notes);
  }
  appendAgentNote(task.filePath, today, "System", notes);
  await withTaskStateTransaction(
    { command: `done ${taskId}` },
    (tx) => {
      tx.clearClaim(taskId);
    }
  );
}
async function performCleanup(repoRoot, task, deleteBranch, today, notes) {
  const hadWorktreeField = !!(task.worktree || task.branch);
  if (task.worktree) {
    try {
      const removed = await removeWorktree(repoRoot, task.id);
      if (removed) {
        logSub(`Worktree removed: ${task.worktree}`);
        notes.push(`Worktree removed: ${task.worktree}`);
      } else {
        logInfo(`Worktree not found (already cleaned up): ${task.worktree}`);
        notes.push(`Worktree not found (already cleaned up): ${task.worktree}`);
      }
    } catch (err) {
      const msg = `Failed to remove worktree: ${err instanceof Error ? err.message : String(err)}`;
      logWarn(msg);
      notes.push(msg);
    }
  } else if (hadWorktreeField) {
    logInfo("No worktree path recorded in task \u2014 skipping worktree removal.");
  }
  if (deleteBranch && task.branch) {
    try {
      const deleted = await removeBranch(repoRoot, task.branch);
      if (deleted) {
        logSub(`Branch deleted: ${task.branch}`);
        notes.push(`Branch deleted: ${task.branch}`);
      } else {
        logInfo(`Branch not found (already deleted): ${task.branch}`);
        notes.push(`Branch not found (already deleted): ${task.branch}`);
      }
    } catch (err) {
      const msg = `Failed to delete branch: ${err instanceof Error ? err.message : String(err)}`;
      logWarn(msg);
      notes.push(msg);
    }
  } else if (deleteBranch && !task.branch) {
    logInfo("No branch recorded in task \u2014 skipping branch deletion.");
  }
  if (hadWorktreeField) {
    const current = parseTaskFile(task.filePath);
    if (current) {
      current.worktree = void 0;
      current.branch = void 0;
      writeTaskFile(current);
      logSub("Worktree and branch fields cleared from task frontmatter.");
      notes.push("Worktree and branch fields cleared from task frontmatter.");
    }
  }
}

// src/commands/unlock.ts
async function cmdUnlock(taskId, options = {}) {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);
  if (!task) {
    if (options.json) {
      writeResult(failedResult({ command: "unlock", taskId, error: `Task ${taskId} not found`, code: "TASK_NOT_FOUND" }), options.json);
      return;
    }
    throw new TaskNotFoundError(taskId);
  }
  if (!task.assignee) {
    if (options.json) {
      writeResult(successResult({ command: "unlock", taskId, guidance: `Task ${taskId} is not claimed.` }), options.json);
      return;
    }
    logWarn(`Task ${taskId} is not claimed.`);
    return;
  }
  if (!options.force) {
    if (options.json) {
      const nextCommands = getForceRejectionNextActions(taskId).map((a) => ({
        command: a.command,
        purpose: a.reason,
        when: a.reason,
        allowedFor: a.safety === "safe" ? "all" : a.safety === "requires_human" ? "human" : "doctor",
        priority: a.preferred ? 1 : 2
      }));
      writeResult(failedResult({ command: "unlock", taskId, error: `Task ${taskId} is assigned to session "${task.assignee}" since ${task.claimed_at ?? "unknown"}.`, code: "NEEDS_FORCE", nextCommands }), options.json);
      return;
    }
    logError(
      `Task ${taskId} is assigned to session "${task.assignee}" since ${task.claimed_at ?? "unknown"}. Unlock requires human or doctor-mode authorization.`
    );
    logDivider();
    logInfo("Valid next actions:");
    logSub("1. taskforge doctor --json");
    logSub("   Reason: Diagnose whether a recovery path exists.");
    logSub("   Safety: safe");
    logSub(`2. taskforge block ${taskId} "Force operation requires human or doctor-mode authorization" --category unsafe_operation --blocked-by human`);
    logSub("   Reason: Escalate unsafe operation without bypassing TaskForge.");
    logSub("   Safety: requires_human");
    return;
  }
  const authority = resolveAuthority();
  try {
    assertCanForce(authority);
  } catch (err) {
    if (err instanceof ForceRequiresHumanOrDoctorError) {
      if (options.json) {
        const nextCommands = getForceRejectionNextActions(taskId).map((a) => ({
          command: a.command,
          purpose: a.reason,
          when: a.reason,
          allowedFor: a.safety === "safe" ? "all" : a.safety === "requires_human" ? "human" : "doctor",
          priority: a.preferred ? 1 : 2
        }));
        writeResult(failedResult({ command: "unlock", taskId, error: "Normal agents may not use --force.", code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR", nextCommands }), options.json);
        return;
      }
      logError("Normal agents may not use --force.");
      logDivider();
      logInfo("Valid next actions:");
      logSub("1. taskforge doctor --json");
      logSub("   Reason: Diagnose whether a recovery path exists.");
      logSub("   Safety: safe");
      logSub(`2. taskforge block ${taskId} "Force operation requires human or doctor-mode authorization" --category unsafe_operation --blocked-by human`);
      logSub("   Reason: Escalate unsafe operation without bypassing TaskForge.");
      logSub("   Safety: requires_human");
      return;
    }
    throw err;
  }
  const previousAssignee = task.assignee;
  clearTaskLock(task.filePath);
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [
    `Task unlocked (authorized: ${authority}) \u2014 previous claim was held by session "${previousAssignee}"`
  ]);
  await commitAndPushTaskState(repoRoot, `chore: unlock ${taskId}`);
  if (options.json) {
    writeResult(successResult({ command: "unlock", taskId, guidance: `Task ${taskId} unlocked.` }), options.json);
    return;
  }
  logSuccess(`Task ${taskId} unlocked. Claim from session "${previousAssignee}" has been cleared.`);
}

// src/commands/inspect.ts
import fs9 from "fs";
import { execa as execa3 } from "execa";
async function cmdInspect(taskId, options = {}) {
  const { json = false } = options;
  const repoRoot = getRepoRoot();
  if (options.all) {
    const tasks = loadAllTasks(repoRoot).filter((t) => t.status === STATUS.IN_PROGRESS);
    if (tasks.length === 0) {
      if (json) {
        writeResult(successResult({
          command: "inspect",
          guidance: "No In Progress tasks to inspect."
        }), json);
        return null;
      }
      logInfo("No In Progress tasks to inspect.");
      return null;
    }
    const results = [];
    for (const task2 of tasks) {
      results.push(await inspectTask(task2, repoRoot));
    }
    if (json) {
      writeResult(successResult({
        command: "inspect",
        guidance: `Inspected ${results.length} In Progress task(s).`
      }), json);
      return null;
    }
    logHeader("# Worktree Inspection");
    logDivider();
    for (const r of results) {
      printInspectResult(r);
    }
    return null;
  }
  const task = loadTaskById(taskId);
  if (!task) {
    throw new TaskNotFoundError(taskId);
  }
  const result = await inspectTask(task, repoRoot);
  if (json) {
    writeResult(successResult({
      command: "inspect",
      taskId,
      guidance: `Inspected task ${taskId}: worktree ${result.worktreeExists ? "exists" : "missing"}, ${result.dirty ? "dirty" : "clean"}, ${result.aheadOfMain} ahead, ${result.behindMain} behind.`
    }), json);
    return result;
  }
  logHeader("# Worktree Inspection");
  logDivider();
  printInspectResult(result);
  return result;
}
async function inspectTask(task, repoRoot) {
  const expectedWorktreePath = getWorktreePath(repoRoot, task.id);
  const worktreeExists = fs9.existsSync(expectedWorktreePath);
  let branchExists = false;
  let dirty = false;
  let aheadOfMain = 0;
  let behindMain = 0;
  let lastCommit = null;
  if (worktreeExists) {
    try {
      const branchList = await execa3("git", ["branch", "--list"], {
        cwd: expectedWorktreePath
      });
      if (task.branch) {
        branchExists = branchList.stdout.includes(task.branch);
      }
      const statusResult = await execa3("git", ["status", "--porcelain"], {
        cwd: expectedWorktreePath
      });
      dirty = statusResult.stdout.trim().length > 0;
      try {
        const aheadResult = await execa3(
          "git",
          ["rev-list", "--count", `HEAD..origin/main`],
          { cwd: expectedWorktreePath }
        );
        aheadOfMain = parseInt(aheadResult.stdout.trim(), 10) || 0;
      } catch {
        aheadOfMain = 0;
      }
      try {
        const behindResult = await execa3(
          "git",
          ["rev-list", "--count", `origin/main..HEAD`],
          { cwd: expectedWorktreePath }
        );
        behindMain = parseInt(behindResult.stdout.trim(), 10) || 0;
      } catch {
        behindMain = 0;
      }
      try {
        const commitResult = await execa3(
          "git",
          ["rev-parse", "HEAD"],
          { cwd: expectedWorktreePath }
        );
        lastCommit = commitResult.stdout.trim().substring(0, 10);
      } catch {
        lastCommit = null;
      }
    } catch {
    }
  }
  const now = Date.now();
  let claimStale = false;
  let claimAgeHours = null;
  if (task.claimed_at) {
    const claimedStr = typeof task.claimed_at === "string" ? task.claimed_at : task.claimed_at.toISOString();
    const normalized = claimedStr.replace(" ", "T") + (claimedStr.includes("Z") ? "" : "Z");
    const claimedTime = new Date(normalized).getTime();
    const ageMs = now - claimedTime;
    claimAgeHours = ageMs / (1e3 * 60 * 60);
    claimStale = claimAgeHours > 4;
  }
  return {
    taskId: task.id,
    worktreeExists,
    branchExists,
    dirty,
    aheadOfMain,
    behindMain,
    lastCommit,
    claimStale,
    claimAgeHours: claimAgeHours !== null ? Math.round(claimAgeHours * 10) / 10 : null
  };
}
function printInspectResult(r) {
  logInfo(`Task: ${r.taskId}`);
  logSub(`  Worktree: ${r.worktreeExists ? "exists" : "missing"}`);
  logSub(`  Branch:   ${r.branchExists ? "exists" : "missing"}`);
  logSub(`  Dirty:    ${r.dirty ? "yes" : "no"}`);
  logSub(`  Ahead:    ${r.aheadOfMain} | Behind: ${r.behindMain}`);
  logSub(`  Commit:   ${r.lastCommit ?? "n/a"}`);
  logSub(`  Lease:    ${r.claimStale ? "STALE" : "fresh"} (${r.claimAgeHours ?? "n/a"}h)`);
  logDivider();
}

// src/commands/sweep.ts
async function cmdSweep(options) {
  if (options?.force) {
    const authority = resolveAuthority();
    try {
      assertCanForce(authority);
    } catch (err) {
      if (err instanceof ForceRequiresHumanOrDoctorError) {
        if (options?.json) {
          const nextCommands = getForceRejectionNextActions().map((a) => ({
            command: a.command,
            purpose: a.reason,
            when: a.reason,
            allowedFor: a.safety === "safe" ? "all" : a.safety === "requires_human" ? "human" : "doctor",
            priority: a.preferred ? 1 : 2
          }));
          writeResult(failedResult({
            command: "sweep",
            error: "Normal agents may not use --force.",
            code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR",
            nextCommands
          }), options.json);
          return;
        }
        logError("Normal agents may not use --force.");
        logDivider();
        logInfo("Valid next actions:");
        logSub("1. taskforge doctor --json");
        logSub("   Reason: Diagnose whether a recovery path exists.");
        logSub("   Safety: safe");
        logSub("2. taskforge sweep --dry-run");
        logSub("   Reason: Preview stale tasks without mutating state.");
        logSub("   Safety: safe");
        return;
      }
      throw err;
    }
  }
  await pullTaskState();
  const result = await sweepStaleTasks(void 0, {
    commit: true,
    dryRun: options?.dryRun,
    force: options?.force,
    inspectTask: options?.force ? void 0 : inspectTask
  });
  if (options?.json) {
    writeResult(successResult({
      command: "sweep",
      guidance: `Sweeper: Found ${result.stale.length} stale task(s), changed ${result.changed}.`,
      nextCommands: [
        { command: "taskforge next", purpose: "Find the next available task after sweep recovery.", when: "Find the next available task after sweep recovery.", allowedFor: "all", priority: 1 }
      ]
    }), options.json);
    return;
  }
  if (result.changed === 0) {
    logInfo("Sweeper: No stale tasks found.");
    logDivider();
    logInfo("Valid next actions:");
    logSub("1. taskforge next");
    logSub("   Reason: Find the next available task.");
    logSub("   Safety: safe");
    return;
  }
  logInfo(`Sweeper: Found ${result.stale.length} stale task(s)${options?.dryRun ? " (dry-run)" : ""}.`);
  for (const swept of result.stale) {
    const ageHours = (swept.ageMs / (60 * 60 * 1e3)).toFixed(1);
    const actionLabel = swept.action === "review" ? "\u2192 Review" : swept.action === "skipped" ? "\u2014 SKIPPED" : "\u2192 Ready";
    logSub(`${swept.id} (claimed by "${swept.previousAssignee}" ${ageHours}h ago) ${actionLabel}`);
    if (swept.reason) {
      logWarn(`  ${swept.reason}`);
    }
    if (swept.action !== "skipped") {
      logSuccess(`  ${swept.id}: In Progress \u2192 ${swept.action === "review" ? "Review" : "Ready"}`);
    }
  }
  if (!result.pushed) {
    logWarn("Sweeper: failed to push state changes after retries.");
  } else if (!options?.dryRun) {
    logSuccess(`Sweeper: Recovered ${result.changed} stale task(s).`);
  } else {
    logInfo(`Sweeper: ${result.changed} task(s) would be recovered (dry-run).`);
  }
}

// src/commands/heartbeat.ts
async function cmdHeartbeat(taskId, options = {}) {
  const { force = false, json = false } = options;
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);
  if (!task) {
    if (json) {
      writeResult(failedResult({ command: "heartbeat", taskId, error: `Task ${taskId} not found`, code: "TASK_NOT_FOUND" }), json);
      return;
    }
    throw new TaskNotFoundError(taskId);
  }
  if (task.status !== STATUS.IN_PROGRESS) {
    if (json) {
      writeResult(failedResult({ command: "heartbeat", taskId, error: `Task ${taskId} is in "${task.status}" status, not "${STATUS.IN_PROGRESS}". Heartbeat is only valid for In Progress tasks.`, code: "INVALID_STATUS" }), json);
      return;
    }
    logError(
      `Task ${taskId} is in "${task.status}" status, not "${STATUS.IN_PROGRESS}". Heartbeat is only valid for In Progress tasks.`
    );
    return;
  }
  if (force) {
    const authority2 = resolveAuthority();
    try {
      assertCanForce(authority2);
    } catch (err) {
      if (err instanceof ForceRequiresHumanOrDoctorError) {
        if (json) {
          const nextCommands = getForceRejectionNextActions(taskId).map((a) => ({
            command: a.command,
            purpose: a.reason,
            when: a.reason,
            allowedFor: a.safety === "safe" ? "all" : a.safety === "requires_human" ? "human" : "doctor",
            priority: a.preferred ? 1 : 2
          }));
          writeResult(failedResult({ command: "heartbeat", taskId, error: "Normal agents may not use --force.", code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR", nextCommands }), json);
          return;
        }
        logError("Normal agents may not use --force.");
        logDivider();
        logInfo("Valid next actions:");
        logSub("1. taskforge doctor --json");
        logSub("   Reason: Diagnose whether a recovery path exists.");
        logSub("   Safety: safe");
        logSub(`2. taskforge block ${taskId} "Force operation requires human or doctor-mode authorization" --category unsafe_operation --blocked-by human`);
        logSub("   Reason: Escalate unsafe operation without bypassing TaskForge.");
        logSub("   Safety: requires_human");
        return;
      }
      throw err;
    }
  }
  if (!force && task.assignee) {
    try {
      await assertTaskOwnership(task, repoRoot);
    } catch (err) {
      if (json) {
        const nextCommands = getForceRejectionNextActions(taskId).map((a) => ({
          command: a.command,
          purpose: a.reason,
          when: a.reason,
          allowedFor: a.safety === "safe" ? "all" : a.safety === "requires_human" ? "human" : "doctor",
          priority: a.preferred ? 1 : 2
        }));
        writeResult(failedResult({ command: "heartbeat", taskId, error: `Task ${taskId} is assigned to session "${task.assignee}".`, code: "OWNERSHIP_MISMATCH", nextCommands }), json);
        return;
      }
      throw err;
    }
  }
  const prevClaimedAt = task.claimed_at;
  const current = parseTaskFile(task.filePath);
  if (!current) {
    throw new TaskNotFoundError(taskId);
  }
  const now = /* @__PURE__ */ new Date();
  current.claimed_at = now.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
  writeTaskFile(current);
  const today = now.toISOString().split("T")[0];
  const prevTime = prevClaimedAt ? `${prevClaimedAt}` : "unknown";
  const agoText = prevClaimedAt && typeof prevClaimedAt === "string" ? ` (reset from ${prevTime})` : "";
  const authority = resolveAuthority();
  appendAgentNote(current.filePath, today, "System", [
    `Heartbeat: lease renewed${force ? ` (authorized: ${authority})` : ""}${agoText}`
  ]);
  if (current.worktree) {
    updateSessionHeartbeat(current.worktree);
  }
  if (current.assignee) {
    updateAgentHeartbeat(current.assignee, repoRoot);
  }
  await commitAndPushTaskState(repoRoot, `chore: heartbeat ${taskId}`);
  if (json) {
    writeResult(successResult({ command: "heartbeat", taskId, guidance: `Heartbeat: task ${taskId} lease renewed.` }), json);
    return;
  }
  logSuccess(`Heartbeat: task ${taskId} lease renewed.`);
  if (force) {
    logInfo(`  (authorized: ${authority} \u2014 ownership not required)`);
  }
}

// src/commands/claim.ts
import fs10 from "fs";
async function cmdClaim(taskId, options) {
  const repoRoot = getRepoRoot();
  const force = options?.force ?? false;
  const json = options?.json ?? false;
  await pullTaskState(repoRoot);
  await sweepStaleTasks(repoRoot, { commit: true });
  const task = loadTaskById(taskId);
  const lock = isDoctorLocked(repoRoot);
  if (lock.locked) {
    const result = claimStateMachine({
      taskFound: !!task,
      taskStatus: task?.status,
      doctorLocked: true,
      doctorReason: lock.reason,
      hasOutstandingTask: false,
      pushSucceeded: false
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "claim", error: result.guidance, code: result.errorCode ?? "DOCTOR_LOCKED" }), json);
      return;
    }
    logWarn(result.guidance);
    return;
  }
  const outstanding = await checkOutstandingSessionTasks(loadAllTasks(repoRoot), repoRoot, taskId);
  if (outstanding) {
    const result = claimStateMachine({
      taskFound: !!task,
      taskStatus: task?.status,
      doctorLocked: false,
      hasOutstandingTask: true,
      outstandingTaskId: outstanding,
      pushSucceeded: false
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "claim", error: result.guidance, code: result.errorCode ?? "OUTSTANDING_TASK" }), json);
      return;
    }
    logError(result.guidance);
    return;
  }
  const allTasks = loadAllTasks(repoRoot);
  const uncommittedWorktrees = await checkUncommittedWorktrees(repoRoot, allTasks);
  if (uncommittedWorktrees.length > 0) {
    const dirty = uncommittedWorktrees[0];
    const result = claimStateMachine({
      taskFound: !!task,
      taskStatus: task?.status,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      taskId,
      uncommittedWorktrees: [{
        taskId: dirty.taskId,
        status: dirty.status,
        dirtyFiles: dirty.dirtyFiles
      }]
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "claim", error: result.guidance, code: result.errorCode ?? "UNCOMMITTED_CHANGES" }), json);
      return;
    }
    logWarn(result.guidance);
    return;
  }
  if (!task) {
    const result = claimStateMachine({
      taskFound: false,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      taskId
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "claim", error: result.guidance, code: result.errorCode ?? "TASK_NOT_FOUND" }), json);
      return;
    }
    throw new TaskNotFoundError(taskId);
  }
  if (task.status !== STATUS.READY && task.status !== STATUS.IN_PROGRESS) {
    const result = claimStateMachine({
      taskFound: true,
      taskStatus: task.status,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      taskId
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "claim", error: result.guidance, code: result.errorCode ?? "INVALID_STATUS" }), json);
      return;
    }
    throw new Error(result.guidance);
  }
  if (task.assignee && !force) {
    const result = claimStateMachine({
      taskFound: true,
      taskStatus: task.status,
      taskAssignee: task.assignee,
      taskClaimedAt: task.claimed_at ? String(task.claimed_at) : void 0,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      taskId
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "claim", error: result.guidance, code: result.errorCode ?? "ALREADY_CLAIMED" }), json);
      return;
    }
    logError(result.guidance);
    logDivider();
    logInfo("Valid next actions:");
    logSub("1. taskforge doctor --json");
    logSub("   Reason: Diagnose whether a recovery path exists.");
    logSub("   Safety: safe");
    logSub(`2. taskforge block ${taskId} "Force operation requires human or doctor-mode authorization" --category unsafe_operation --blocked-by human`);
    logSub("   Reason: Escalate unsafe operation without bypassing TaskForge.");
    logSub("   Safety: requires_human");
    return;
  }
  if (task.assignee && force) {
    const authority = resolveAuthority();
    try {
      assertCanForce(authority);
    } catch (err) {
      if (err instanceof ForceRequiresHumanOrDoctorError) {
        const result = claimStateMachine({
          taskFound: true,
          taskStatus: task.status,
          taskAssignee: task.assignee,
          taskClaimedAt: task.claimed_at ? String(task.claimed_at) : void 0,
          force: true,
          doctorLocked: false,
          hasOutstandingTask: false,
          pushSucceeded: false,
          taskId
        });
        getDefaultGuidanceAdapter().pushGuidance(result);
        if (json) {
          writeResult(failedResult({ command: "claim", error: "Normal agents may not use --force.", code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR" }), json);
          return;
        }
        logError("Normal agents may not use --force.");
        logDivider();
        logInfo("Valid next actions:");
        logSub("1. taskforge doctor --json");
        logSub("   Reason: Diagnose whether a recovery path exists.");
        logSub("   Safety: safe");
        logSub(`2. taskforge block ${taskId} "Force operation requires human or doctor-mode authorization" --category unsafe_operation --blocked-by human`);
        logSub("   Reason: Escalate unsafe operation without bypassing TaskForge.");
        logSub("   Safety: requires_human");
        return;
      }
      throw err;
    }
    if (!json) {
      logWarn(`Overriding stale claim from session "${task.assignee}" (authorized: ${authority}).`);
    }
  }
  const sessionId = options?.session ?? await resolveSessionId(repoRoot);
  let worktreePath;
  let branchName;
  try {
    await withTaskStateTransaction(
      { command: `claim ${taskId}`, maxRetries: 3 },
      async (tx) => {
        const fresh = tx.loadTask(taskId);
        if (!fresh) throw new Error(`Task ${taskId} not found during transaction`);
        if (fresh.assignee && fresh.assignee !== sessionId && !force) {
          throw new Error(`Task ${taskId} was claimed by session "${fresh.assignee}" during our push`);
        }
        tx.claimTask(taskId, sessionId);
        if (!fresh.branch) {
          const titleMatch = fresh.body.match(/^#\s+\S+:\s+(.+)$/m);
          const title = titleMatch ? titleMatch[1] : taskId;
          fresh.branch = makeBranchName(taskId, title, sessionId);
        } else {
          const oldSession = parseSessionIdFromBranch(fresh.branch);
          if (oldSession && oldSession !== sessionId) {
            const titleMatch = fresh.body.match(/^#\s+\S+:\s+(.+)$/m);
            const title = titleMatch ? titleMatch[1] : taskId;
            fresh.branch = makeBranchName(taskId, title, sessionId);
          }
        }
        tx.updateTask(fresh);
        branchName = fresh.branch;
        tx.appendNote(taskId, "System", [
          `Task claimed via taskforge claim ${taskId}${force ? " (forced)" : ""}`,
          `Session: ${sessionId}`
        ]);
      }
    );
  } catch {
    const result = claimStateMachine({
      taskFound: true,
      taskStatus: task.status,
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      taskId
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "claim", error: result.guidance, code: result.errorCode ?? "PUSH_FAILED" }), json);
      return;
    }
    logError(result.guidance);
    return;
  }
  const wtPath = getWorktreePath(repoRoot, taskId);
  if (fs10.existsSync(wtPath)) {
    worktreePath = wtPath;
  } else {
    try {
      const result = await createWorktree(repoRoot, {
        id: taskId,
        branch: branchName ?? makeBranchName(taskId, taskId, sessionId)
      });
      worktreePath = result.path;
      branchName = result.branch;
    } catch {
      worktreePath = void 0;
    }
  }
  if (worktreePath) {
    writeSessionState(worktreePath, {
      session_id: sessionId,
      task_id: taskId,
      claimed_at: (/* @__PURE__ */ new Date()).toISOString(),
      worktree_path: worktreePath,
      last_heartbeat: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  registerAgent(sessionId, taskId, worktreePath ?? null, repoRoot);
  const claimResult = claimStateMachine({
    taskFound: true,
    taskStatus: task.status,
    doctorLocked: false,
    hasOutstandingTask: false,
    pushSucceeded: true,
    worktreeExists: !!worktreePath,
    worktreePath,
    taskId,
    sessionId
  });
  getDefaultGuidanceAdapter().pushGuidance(claimResult);
  if (json) {
    eventLogEvent(taskId, "claimed", { session: sessionId, forced: force });
    writeResult(successResult({
      command: "claim",
      taskId: task.id,
      guidance: claimResult.guidance,
      worktree: worktreePath,
      branch: branchName,
      sessionId
    }), json);
    return;
  }
  if (task.status === STATUS.READY) {
    logSuccess(`Status updated: ${STATUS.READY} \u2192 ${STATUS.IN_PROGRESS}`);
  }
  logSuccess(claimResult.guidance);
  if (worktreePath) {
    logSuccess(`Worktree: ${worktreePath}`);
    logSuccess(`Branch: ${branchName}`);
    logInfo(`cd ${worktreePath} to begin work.`);
  }
  eventLogEvent(taskId, "claimed", { session: sessionId, forced: force });
}

// src/commands/report.ts
import { execa as execa4 } from "execa";
async function cmdReport(taskId, options) {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);
  if (!task) {
    if (options?.json) {
      writeResult(failedResult({ command: "report", taskId, error: `Task ${taskId} not found`, code: "TASK_NOT_FOUND" }), options.json);
      return;
    }
    throw new TaskNotFoundError(taskId);
  }
  const worktreePath = getWorktreePath(repoRoot, taskId);
  const changedFiles = [];
  const commits = [];
  try {
    const diffResult = await execa4("git", ["diff", "--name-only", `origin/main..HEAD`], { cwd: worktreePath });
    changedFiles.push(...diffResult.stdout.trim().split("\n").filter(Boolean));
    const logResult = await execa4("git", ["log", "--oneline", `origin/main..HEAD`], { cwd: worktreePath });
    commits.push(...logResult.stdout.trim().split("\n").filter(Boolean));
  } catch {
  }
  if (options?.complete) {
    const transitionError = validateTransition(task.status, STATUS.IMPLEMENTATION_COMPLETE);
    if (transitionError) {
      if (options?.json) {
        writeResult(failedResult({ command: "report", taskId, error: transitionError, code: "INVALID_TRANSITION" }), options.json);
        return;
      }
      throw new InvalidStatusTransitionError(task.status, STATUS.IMPLEMENTATION_COMPLETE, [STATUS.IN_PROGRESS]);
    }
    const hasAC = hasAcceptanceCriteriaSection(task.body);
    const hasBlankAC = hasAC && hasBlankAcceptanceCriteria(task.body);
    const hasUncheckedAC = hasAC && hasUncheckedAcceptanceCriteria(task.body);
    updateTaskStatus(task.filePath, STATUS.IMPLEMENTATION_COMPLETE);
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    appendAgentNote(task.filePath, today, "System", [
      `Report generated \u2014 task moved to Implementation Complete`,
      `Changed files: ${changedFiles.length > 0 ? changedFiles.join(", ") : "none"}`,
      `Commits: ${commits.length > 0 ? commits.join(", ") : "none"}`,
      `AC section: ${hasAC ? "present" : "missing"}`,
      hasBlankAC ? "AC has blank items" : "",
      hasUncheckedAC ? "AC has unchecked items" : ""
    ].filter(Boolean));
    await commitAndPushTaskState(repoRoot, `chore: report ${taskId} \u2192 Implementation Complete`);
    if (options?.json) {
      writeResult(successResult({
        command: "report",
        taskId,
        guidance: `Task ${taskId} moved to Implementation Complete. Verify AC before submitting.`,
        nextCommands: [
          { command: `taskforge done ${taskId}`, purpose: "Mark task as Done after AC verification passes", when: "Mark task as Done after AC verification passes", allowedFor: "all", priority: 1 },
          { command: `taskforge start ${taskId}`, purpose: "Return to In Progress if AC verification fails", when: "Return to In Progress if AC verification fails", allowedFor: "all", priority: 2 },
          { command: `taskforge block ${taskId} "AC verification failed: <details>" --category ambiguous_spec --blocked-by reviewer`, purpose: "Block if AC are unclear or cannot be verified", when: "Block if AC are unclear or cannot be verified", allowedFor: "all", priority: 3 }
        ]
      }), options.json);
      return;
    }
    logHeader(`# Report: ${taskId}`);
    logDivider();
    logSub(`Status: ${STATUS.IMPLEMENTATION_COMPLETE}`);
    logSub(`Changed files: ${changedFiles.length > 0 ? changedFiles.join(", ") : "none"}`);
    logSub(`Commits: ${commits.length > 0 ? commits.join(", ") : "none"}`);
    logDivider();
    logSuccess(`Task ${taskId} moved to Implementation Complete.`);
    logDivider();
    logInfo("Reviewer Instructions:");
    logSub("1. Read the task file and extract every acceptance criterion.");
    logSub("2. Verify each AC is satisfied with explicit evidence:");
    logSub("   - Source file (e.g., src/commands/validate-state.ts)");
    logSub("   - Identifier (function name, test name, or ~line number)");
    logSub("   - Rationale (one sentence on how the code satisfies the AC)");
    logSub("3. Run gates: npm run typecheck && npm run lint && npm run build && npm test -- --run");
    logSub("4. If all AC pass \u2192 taskforge done TASK-ID");
    logSub("5. If any AC fails \u2192 taskforge start TASK-ID (return to In Progress)");
    logSub('6. If AC are unclear \u2192 taskforge block TASK-ID "reason" --category ambiguous_spec');
    logDivider();
    if (!hasAC) {
      logWarn("Warning: No Acceptance Criteria section found in task file.");
    } else if (hasBlankAC) {
      logWarn("Warning: Some acceptance criteria have blank/placeholder text.");
    } else if (hasUncheckedAC) {
      logWarn("Warning: Some acceptance criteria are still unchecked.");
    }
    return;
  }
  if (options?.json) {
    writeResult(successResult({
      command: "report",
      taskId,
      guidance: `Report generated for ${taskId}.`,
      nextCommands: [
        { command: `taskforge report ${taskId} --complete`, purpose: "Generate completion report and move to Implementation Complete", when: "Generate completion report and move to Implementation Complete", allowedFor: "all", priority: 1 },
        { command: "taskforge gates", purpose: "Run gates before generating report", when: "Run gates before generating report", allowedFor: "all", priority: 2 }
      ]
    }), options.json);
    return;
  }
  logHeader(`# Report: ${taskId}`);
  logDivider();
  logSub(`Status: ${options?.complete ? STATUS.IMPLEMENTATION_COMPLETE : task.status}`);
  logSub(`Changed files: ${changedFiles.length > 0 ? changedFiles.join(", ") : "none"}`);
  logSub(`Commits: ${commits.length > 0 ? commits.join(", ") : "none"}`);
  logDivider();
  if (!options?.complete) {
    logInfo("Next actions:");
    logSub(`  taskforge report ${taskId} --complete  \u2014 Generate completion report and move to Implementation Complete`);
    logSub(`  taskforge gates                       \u2014 Run gates before generating report`);
  }
}

// src/commands/cleanup-cmd.ts
async function cmdCleanup(taskId, options) {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);
  if (!task) {
    if (options?.json) writeResult(failedResult({ command: "cleanup", taskId, error: `Task ${taskId} not found`, code: "TASK_NOT_FOUND" }), options.json);
    else throw new TaskNotFoundError(taskId);
    return;
  }
  const apply = options?.apply ?? false;
  const force = options?.force ?? false;
  const dryRun = !apply && !force;
  const json = options?.json ?? false;
  if (force) {
    const authority = resolveAuthority();
    try {
      assertCanForce(authority);
    } catch (err) {
      if (err instanceof ForceRequiresHumanOrDoctorError) {
        if (json) {
          const nextCommands = getForceRejectionNextActions(taskId).map((a) => ({
            command: a.command,
            purpose: a.reason,
            when: a.reason,
            allowedFor: a.safety === "safe" ? "all" : a.safety === "requires_human" ? "human" : "doctor",
            priority: a.preferred ? 1 : 2
          }));
          writeResult(failedResult({
            command: "cleanup",
            taskId,
            error: "Normal agents may not use --force.",
            code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR",
            nextCommands
          }), json);
          return;
        }
        logError("Normal agents may not use --force.");
        logDivider();
        logInfo("Valid next actions:");
        logSub("1. taskforge doctor --json");
        logSub("   Reason: Diagnose whether a recovery path exists.");
        logSub("   Safety: safe");
        logSub(`2. taskforge block ${taskId} "Force operation requires human or doctor-mode authorization" --category unsafe_operation --blocked-by human`);
        logSub("   Reason: Escalate unsafe operation without bypassing TaskForge.");
        logSub("   Safety: requires_human");
        return;
      }
      throw err;
    }
  }
  const items = [];
  let insp;
  try {
    insp = await inspectTask(task, repoRoot);
  } catch {
    insp = null;
  }
  if (task.worktree && insp?.worktreeExists) {
    if (insp.dirty && !force) {
      items.push({ resource: "worktree", status: dryRun ? "would_remove" : "skipped", reason: "dirty worktree \u2014 uncommitted changes" });
    } else if (insp.aheadOfMain > 0 && !force) {
      items.push({ resource: "worktree", status: dryRun ? "would_remove" : "skipped", reason: `${insp.aheadOfMain} commit(s) ahead of main` });
    } else if (!dryRun) {
      await removeWorktree(repoRoot, taskId);
      items.push({ resource: "worktree", status: "removed" });
    } else {
      items.push({ resource: "worktree", status: "would_remove" });
    }
  } else if (task.worktree) {
    items.push({ resource: "worktree", status: "skipped", reason: "worktree not found" });
  }
  if (task.branch) {
    if (!dryRun) {
      try {
        await removeBranch(repoRoot, task.branch);
        items.push({ resource: "branch", status: "removed" });
      } catch {
        items.push({ resource: "branch", status: "skipped", reason: "failed to delete" });
      }
    } else {
      items.push({ resource: "branch", status: "would_remove" });
    }
  }
  if (apply || force) {
    const current = parseTaskFile(task.filePath);
    if (current) {
      current.worktree = void 0;
      current.branch = void 0;
      writeTaskFile(current);
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const authority = resolveAuthority();
      appendAgentNote(current.filePath, today, "System", [
        `Cleanup: worktree and branch removed${force ? ` (authorized: ${authority})` : ""}`
      ]);
      await commitAndPushTaskState(repoRoot, `chore: cleanup ${taskId}`);
    }
  }
  if (json) {
    writeResult(successResult({
      command: "cleanup",
      taskId,
      guidance: `Cleanup ${taskId}: removed worktree/branch.`,
      nextCommands: [
        { command: "taskforge next", purpose: "Find the next available task after cleanup.", when: "Find the next available task after cleanup.", allowedFor: "all", priority: 1 }
      ]
    }), json);
    return;
  }
  if (dryRun) {
    logInfo(`Cleanup ${taskId} (dry-run):`);
  } else {
    logSuccess(`Cleanup ${taskId}:`);
  }
  for (const item of items) {
    if (item.status === "skipped") {
      logWarn(`  ${item.resource}: ${item.reason}`);
    } else if (item.status === "would_remove") {
      logSub(`  ${item.resource}: would be removed`);
    } else {
      logSuccess(`  ${item.resource}: removed`);
    }
  }
}

// src/commands/prompt.ts
import fs11 from "fs";
import path9 from "path";
async function cmdPrompt(taskId, options) {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);
  if (!task) throw new TaskNotFoundError(taskId);
  const wtPath = getWorktreePath(repoRoot, taskId);
  if (options?.json) {
    const title2 = task.body.match(/^#\s+\S+:\s+(.+)$/m)?.[1]?.trim() ?? task.id;
    writeResult(successResult({
      command: "prompt",
      taskId,
      guidance: `Task ${taskId}: ${title2} (${task.status}, ${task.priority}). Worktree: ${task.worktree ?? wtPath}. Branch: ${task.branch ?? "none"}. ${extractAcceptanceCriteria(task.body).length} acceptance criteria.`
    }), options.json);
    return;
  }
  const title = task.body.match(/^#\s+\S+:\s+(.+)$/m)?.[1]?.trim() ?? task.id;
  logHeader(`# ${task.id}: ${title}`);
  logDivider();
  logInfo(task.body);
  logDivider();
  logHeader("## Workspace");
  logSub(`Branch: ${task.branch ?? "none"}`);
  logSub(`Worktree: ${task.worktree ?? wtPath}`);
  logDivider();
  logHeader("## Verification");
  logSub("npm run typecheck && npm run lint && npm run build && npm test -- --run");
  const agentsPath = path9.join(repoRoot, "AGENTS.md");
  if (fs11.existsSync(agentsPath)) {
    logDivider();
    logHeader("## Project Conventions (from AGENTS.md)");
    logInfo(fs11.readFileSync(agentsPath, "utf-8").slice(0, 2e3));
  }
}
function extractAcceptanceCriteria(body) {
  const match = body.match(/## Acceptance Criteria\n([\s\S]*?)(?=\n## |$)/);
  if (!match) return [];
  return match[1].split("\n").filter((l) => l.trim().startsWith("- ["));
}

// src/commands/new.ts
import fs12 from "fs";
import path10 from "path";
async function cmdNew(title, options) {
  const repoRoot = getRepoRoot();
  const taskType = options?.type ?? "Task";
  const priority = options?.priority ?? "P2";
  const agentRole = options?.agentRole ?? "Implementer";
  const status = options?.status ?? "Ready";
  const bodyExtra = options?.body ?? "";
  const json = options?.json ?? false;
  const nextId = getNextId(repoRoot);
  const frontmatter = [
    "---",
    `id: ${nextId}`,
    `type: ${taskType}`,
    `status: ${status}`,
    `priority: ${priority}`,
    `agentRole: ${agentRole}`,
    `riskLevel: Low`,
    `humanInterventionRequired: false`,
    "---"
  ].join("\n");
  const body = [
    `# ${nextId}: ${title}`,
    "",
    "## Goal",
    "",
    bodyExtra || "Describe the desired outcome.",
    "",
    "## Acceptance Criteria",
    "",
    "- [ ]",
    "",
    "## Agent Notes",
    ""
  ].join("\n");
  const content = `${frontmatter}

${body}`;
  const stateDir = getTaskStateDir(repoRoot);
  const filePath = path10.join(stateDir, `${nextId}.md`);
  try {
    fs12.writeFileSync(filePath, content, "utf-8");
  } catch (err) {
    const result2 = newStateMachine({
      writeSucceeded: false,
      pushSucceeded: false,
      taskId: nextId,
      filePath,
      errorMessage: err instanceof Error ? err.message : String(err)
    });
    getDefaultGuidanceAdapter().pushGuidance(result2);
    if (json) {
      writeResult(failedResult({
        command: "new",
        error: result2.guidance,
        code: result2.errorCode ?? "WRITE_FAILED"
      }), json);
      return;
    }
    throw new Error(result2.guidance);
  }
  let pushSucceeded = false;
  try {
    await withTaskStateTransaction(
      { command: `create ${nextId}`, maxRetries: 3 },
      (tx) => {
        const task = tx.loadTask(nextId);
        if (!task) throw new Error(`Task ${nextId} not found during transaction`);
      }
    );
    pushSucceeded = true;
  } catch (err) {
    pushSucceeded = false;
    const result2 = newStateMachine({
      writeSucceeded: true,
      pushSucceeded: false,
      taskId: nextId,
      filePath,
      errorMessage: err instanceof Error ? err.message : String(err)
    });
    getDefaultGuidanceAdapter().pushGuidance(result2);
    if (json) {
      writeResult(failedResult({
        command: "new",
        error: result2.guidance,
        code: result2.errorCode ?? "PUSH_FAILED"
      }), json);
      return;
    }
    logInfo(result2.guidance);
    return;
  }
  const result = newStateMachine({
    writeSucceeded: true,
    pushSucceeded,
    taskId: nextId,
    filePath
  });
  getDefaultGuidanceAdapter().pushGuidance(result);
  if (json) {
    writeResult(successResult({
      command: "new",
      taskId: nextId,
      guidance: result.guidance
    }), json);
    return;
  }
  logSuccess(result.guidance);
  logInfo(`File: ${filePath}`);
  logDivider();
  logInfo("Next actions:");
  logSub(`  taskforge start ${nextId}   \u2014 Begin working on this task (creates worktree)`);
  logSub(`  taskforge claim ${nextId}   \u2014 Claim this task without creating a worktree`);
  logSub("  taskforge next            \u2014 Find the next available task");
}

// src/commands/resume.ts
import fs13 from "fs";
import path11 from "path";
import { execSync } from "child_process";
function recoverBySessionFile(worktreePath) {
  const state = readSessionState(worktreePath);
  if (!state) return null;
  return {
    taskId: state.task_id,
    sessionId: state.session_id,
    worktreePath: state.worktree_path,
    branch: "",
    // Will be resolved from task file
    method: "session-file",
    claimedAt: state.claimed_at
  };
}
function recoverByBranchMatch() {
  const tasks = loadAllTasks();
  const inProgress = tasks.filter((t) => t.status === STATUS.IN_PROGRESS);
  for (const task of inProgress) {
    if (!task.branch) continue;
    const match = task.branch.match(/--([a-f0-9]{16})$/);
    if (!match) continue;
    const sessionId = match[1];
    const wtPath = getWorktreePath(getRepoRoot(), task.id);
    if (!fs13.existsSync(wtPath)) continue;
    return {
      taskId: task.id,
      sessionId,
      worktreePath: wtPath,
      branch: task.branch,
      method: "branch-match",
      claimedAt: typeof task.claimed_at === "string" ? task.claimed_at : task.claimed_at?.toISOString() ?? ""
    };
  }
  return null;
}
function recoverByDirtyWorktree() {
  const tasks = loadAllTasks();
  for (const task of tasks) {
    if (!task.worktree || !fs13.existsSync(task.worktree)) continue;
    const sessionFile = path11.join(task.worktree, ".taskforge-session.json");
    if (fs13.existsSync(sessionFile)) {
      const state = readSessionState(task.worktree);
      if (state) {
        return {
          taskId: state.task_id,
          sessionId: state.session_id,
          worktreePath: task.worktree,
          branch: task.branch ?? "",
          method: "dirty-worktree",
          claimedAt: state.claimed_at
        };
      }
    }
    try {
      const stdout = execSync("git status --porcelain", { cwd: task.worktree, encoding: "utf-8" });
      if (stdout.trim()) {
        const branchOut = execSync("git branch --show-current", { cwd: task.worktree, encoding: "utf-8" });
        const branchMatch = branchOut.match(/agent\/(TASK-\d+)-/);
        if (branchMatch) {
          return {
            taskId: branchMatch[1],
            sessionId: "",
            worktreePath: task.worktree,
            branch: branchOut.trim(),
            method: "dirty-worktree",
            claimedAt: typeof task.claimed_at === "string" ? task.claimed_at : task.claimed_at?.toISOString() ?? ""
          };
        }
      }
    } catch {
    }
  }
  return null;
}
function autoDetectRecovery(taskId) {
  if (taskId) {
    const wtPath = getWorktreePath(getRepoRoot(), taskId);
    const byFile = recoverBySessionFile(wtPath);
    if (byFile) return byFile;
    const tasks2 = loadAllTasks();
    const task = tasks2.find((t) => t.id === taskId);
    if (task && task.status === STATUS.IN_PROGRESS && task.branch) {
      const match = task.branch.match(/--([a-f0-9]{16})$/);
      if (match) {
        return {
          taskId: task.id,
          sessionId: match[1],
          worktreePath: getWorktreePath(getRepoRoot(), taskId),
          branch: task.branch,
          method: "branch-match",
          claimedAt: typeof task.claimed_at === "string" ? task.claimed_at : task.claimed_at?.toISOString() ?? ""
        };
      }
    }
    if (task && task.worktree && fs13.existsSync(task.worktree)) {
      return {
        taskId: task.id,
        sessionId: "",
        worktreePath: task.worktree,
        branch: task.branch ?? "",
        method: "dirty-worktree",
        claimedAt: typeof task.claimed_at === "string" ? task.claimed_at : task.claimed_at?.toISOString() ?? ""
      };
    }
    return null;
  }
  const tasks = loadAllTasks();
  for (const task of tasks) {
    if (task.worktree && fs13.existsSync(task.worktree)) {
      const byFile = recoverBySessionFile(task.worktree);
      if (byFile) return byFile;
    }
  }
  const byBranch = recoverByBranchMatch();
  if (byBranch) return byBranch;
  const byDirty = recoverByDirtyWorktree();
  if (byDirty) return byDirty;
  return null;
}
async function cmdResume(taskId, options) {
  const repoRoot = getRepoRoot();
  const recovery = autoDetectRecovery(taskId);
  if (!recovery) {
    if (options?.json) {
      writeResult(failedResult({
        command: "resume",
        error: "No recoverable session found",
        code: "NO_RECOVERABLE_SESSION",
        guidance: "No active sessions found. Use 'taskforge next' to find a task, or 'taskforge claim' to claim one.",
        nextCommands: [
          { command: "taskforge next", purpose: "Find the next available task", when: "no active sessions", allowedFor: "all", priority: 1 },
          { command: "taskforge claim <TASK-ID>", purpose: "Claim a task", when: "no active sessions", allowedFor: "all", priority: 2 }
        ]
      }), options.json);
    } else {
      logWarn("No recoverable session found.");
      logDivider();
      logInfo("Next actions:");
      logSub("  taskforge next            \u2014 Find the next available task");
      logSub("  taskforge claim <TASK-ID> \u2014 Claim a task");
    }
    return;
  }
  const task = loadTaskById(recovery.taskId);
  if (!task) {
    if (options?.json) writeResult(failedResult({ command: "resume", taskId: recovery.taskId, error: `Task ${recovery.taskId} not found`, code: "TASK_NOT_FOUND" }), options.json);
    else throw new TaskNotFoundError(recovery.taskId);
    return;
  }
  if (options?.json) {
    writeResult(successResult({
      command: "resume",
      taskId: recovery.taskId,
      worktree: recovery.worktreePath,
      branch: recovery.branch || task.branch,
      guidance: `Resume working in ${recovery.worktreePath}. Use 'taskforge checkpoint ${recovery.taskId}' to save progress, or 'taskforge done ${recovery.taskId}' when complete.`,
      nextCommands: [
        { command: "work", purpose: "Continue working in the worktree", when: "after resume", allowedFor: "all", priority: 1 },
        { command: `taskforge checkpoint ${recovery.taskId}`, purpose: "Save progress", when: "after resume", allowedFor: "all", priority: 2 },
        { command: `taskforge done ${recovery.taskId}`, purpose: "Complete the task", when: "after resume", allowedFor: "all", priority: 3 }
      ]
    }), options.json);
    return;
  }
  logHeader(`## Session Recovered: ${recovery.taskId}`);
  logSub(`**Method:** ${recovery.method}`);
  logSub(`**Worktree:** ${recovery.worktreePath}`);
  logSub(`**Branch:** ${recovery.branch || task.branch || "none"}`);
  logSub(`**Session ID:** ${recovery.sessionId || "unknown"}`);
  const claimedAtDisplay = recovery.claimedAt ? formatTimestampMarkdown(parseTimestamp(recovery.claimedAt)) || recovery.claimedAt : "unknown";
  logSub(`**Claimed At:** ${claimedAtDisplay}`);
  logDivider();
  logHeader("### Agent Instructions");
  logDivider();
  logSub(`1. cd ${recovery.worktreePath}`);
  logSub(`2. Read ${repoRoot}/TASKFORGE.md`);
  logSub(`3. Read the task file at ../task-state/${recovery.taskId}.md`);
  logSub(`4. Continue work on ${recovery.taskId}`);
  logSub(`5. Use 'taskforge checkpoint ${recovery.taskId}' to save progress`);
  logSub(`6. Use 'taskforge done ${recovery.taskId}' when complete`);
  logDivider();
  logSuccess(`Ready to resume ${recovery.taskId}.`);
}

// src/core/agent-framework-adapter.ts
import path12 from "path";
import fs14 from "fs";
var OpenCodeAgentFrameworkAdapter = class {
  doctor(repoRoot) {
    const issues = [];
    const agentsMdPath = path12.join(repoRoot, "AGENTS.md");
    if (fs14.existsSync(agentsMdPath)) {
      const content = fs14.readFileSync(agentsMdPath, "utf-8");
      if (hasManagedBlock(content, "managed-agent-policy")) {
      } else {
        issues.push({ severity: "warn", code: "OPENCODE_AGENTS_MD", message: "AGENTS.md missing managed-agent-policy block" });
      }
    } else {
      issues.push({ severity: "warn", code: "OPENCODE_AGENTS_MD", message: "AGENTS.md not found \u2014 run 'taskforge init' to create" });
    }
    const openCodeJsonPath = path12.join(repoRoot, "opencode.json");
    if (fs14.existsSync(openCodeJsonPath)) {
      try {
        const ocConfig = JSON.parse(fs14.readFileSync(openCodeJsonPath, "utf-8"));
        const bashPerms = ocConfig?.permission?.bash ?? {};
        const editPerms = ocConfig?.permission?.edit ?? {};
        if (bashPerms["git *"] === "deny" && editPerms["../task-state/**"] === "deny") {
        } else {
          issues.push({ severity: "warn", code: "OPENCODE_PERMISSIONS", message: "opencode.json agent permissions incomplete" });
        }
        if (ocConfig?.agent?.doctor) {
        } else {
          issues.push({ severity: "warn", code: "OPENCODE_DOCTOR_AGENT", message: "opencode.json missing doctor agent" });
        }
      } catch {
        issues.push({ severity: "warn", code: "OPENCODE_JSON", message: "opencode.json is not valid JSON" });
      }
    }
    const auditDir2 = path12.join(repoRoot, "logs", "taskforge", "audit");
    if (fs14.existsSync(auditDir2)) {
      issues.push({ severity: "info", code: "OPENCODE_AUDIT_DIR", message: "Audit directory exists" });
    } else {
      issues.push({ severity: "info", code: "OPENCODE_AUDIT_DIR", message: "Audit directory not yet created (will be created on first event)" });
    }
    return issues;
  }
  fix(repoRoot) {
    const repairs = [];
    const config = loadConfig(repoRoot);
    const policy = config.opencode?.policy ?? "managed";
    const audit = config.opencode?.audit ?? true;
    const guard2 = config.opencode?.guard ?? true;
    const agentsMdPath = path12.join(repoRoot, "AGENTS.md");
    if (!fs14.existsSync(agentsMdPath)) {
      installAgentsMd(repoRoot, false);
      repairs.push({ code: "OPENCODE_AGENTS_MD", message: "Created AGENTS.md with managed-agent-policy block" });
    } else {
      const content = fs14.readFileSync(agentsMdPath, "utf-8");
      if (!hasManagedBlock(content, "managed-agent-policy")) {
        installAgentsMd(repoRoot, false);
        repairs.push({ code: "OPENCODE_AGENTS_MD", message: "Added managed-agent-policy block to AGENTS.md" });
      }
    }
    const openCodeJsonPath = path12.join(repoRoot, "opencode.json");
    if (!fs14.existsSync(openCodeJsonPath)) {
      installOpenCodeConfig(repoRoot, policy, audit, guard2, false);
      repairs.push({ code: "OPENCODE_JSON", message: "Created opencode.json with TaskForge-managed permissions" });
    } else {
      try {
        const ocConfig = JSON.parse(fs14.readFileSync(openCodeJsonPath, "utf-8"));
        const bashPerms = ocConfig?.permission?.bash ?? {};
        const editPerms = ocConfig?.permission?.edit ?? {};
        const needsFix = bashPerms["git *"] !== "deny" || editPerms["../task-state/**"] !== "deny" || !ocConfig?.agent?.doctor;
        if (needsFix) {
          installOpenCodeConfig(repoRoot, policy, audit, guard2, false);
          repairs.push({ code: "OPENCODE_PERMISSIONS", message: "Repaired opencode.json agent permissions and doctor agent config" });
        }
      } catch {
        installOpenCodeConfig(repoRoot, policy, audit, guard2, false);
        repairs.push({ code: "OPENCODE_JSON", message: "Recreated opencode.json (was invalid JSON)" });
      }
    }
    const auditDir2 = path12.join(repoRoot, "logs", "taskforge", "audit");
    if (!fs14.existsSync(auditDir2)) {
      fs14.mkdirSync(auditDir2, { recursive: true });
      repairs.push({ code: "OPENCODE_AUDIT_DIR", message: "Created audit directory" });
    }
    return repairs;
  }
};
var GenericAgentFrameworkAdapter = class {
  doctor(_repoRoot) {
    return [];
  }
  fix(_repoRoot) {
    return [];
  }
};
function getAgentFrameworkAdapter(frameworkId) {
  if (frameworkId === "opencode") {
    return new OpenCodeAgentFrameworkAdapter();
  }
  return new GenericAgentFrameworkAdapter();
}

// src/commands/doctor.ts
import path13 from "path";
import fs15 from "fs";
async function cmdDoctor(options) {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);
  const tasks = loadAllTasks(repoRoot);
  const worktrees = await listWorktrees(repoRoot);
  const issues = [];
  const ok = [];
  function add(severity, msg, taskId, code = "GENERIC") {
    issues.push({ severity, code, message: msg, taskId });
  }
  const taskStateDir = getTaskStateDir(repoRoot);
  if (!fs15.existsSync(taskStateDir)) {
    add("error", "Task-state worktree missing \u2014 run 'taskforge init'");
  } else {
    ok.push("Task-state worktree exists");
  }
  try {
    loadConfig(repoRoot);
    ok.push("Config is valid");
  } catch {
    add("error", "Config.json is invalid or missing");
  }
  const validation = validateTaskState(tasks);
  for (const e of validation.errors) add("error", `[${e.code}] ${e.message}`, e.taskId);
  for (const w of validation.warnings) add("warn", `[${w.code}] ${w.message}`, w.taskId);
  for (const wt of worktrees) {
    const wtName = wt.path.split("/").pop();
    if (wtName === "task-state") continue;
    if (!tasks.some((t) => t.id === wtName)) {
      add("warn", `Orphan worktree: ${wt.branch} at ${wt.path}`);
    }
  }
  const inProgressTasks = tasks.filter((t) => t.status === STATUS.IN_PROGRESS);
  for (const t of inProgressTasks) {
    const wtPath = getWorktreePath(repoRoot, t.id);
    if (!fs15.existsSync(wtPath)) {
      add("warn", `Stale lock: worktree missing`, t.id);
    }
    try {
      const insp = await inspectTask(t, repoRoot);
      if (insp.dirty) add("warn", `Dirty worktree \u2014 uncommitted changes`, t.id);
      if (insp.aheadOfMain > 0) add("warn", `${insp.aheadOfMain} commit(s) ahead of main \u2014 may need Review`, t.id);
      if (insp.claimStale) add("warn", `Claim is stale (${insp.claimAgeHours?.toFixed(1)}h) \u2014 sweeper will recover`, t.id);
    } catch {
    }
  }
  for (const t of tasks) {
    if (t.status === STATUS.DONE && t.assignee) add("error", `Done but still claimed`, t.id);
    if (t.status === STATUS.READY && t.assignee) add("warn", `Ready but has assignee \u2014 sweep may have failed to clear lock`, t.id);
    if (t.status === STATUS.IN_PROGRESS && !t.assignee) add("warn", `In Progress but no assignee`, t.id);
    if (t.status === STATUS.BLOCKED && !t.blocked_reason) add("warn", `Blocked but no blocked_reason`, t.id);
    if (t.status === STATUS.REVIEW && t.assignee) add("warn", `Review but still claimed`, t.id);
  }
  const allIds = new Set(tasks.map((t) => t.id));
  for (const t of tasks) {
    if (t.dependsOn) {
      for (const dep of t.dependsOn) {
        if (!allIds.has(dep)) add("error", `dependsOn references non-existent task: ${dep}`, t.id);
        const depTask = tasks.find((d) => d.id === dep);
        if (depTask && depTask.status !== STATUS.DONE) add("info", `dependsOn ${dep} is not Done (status: ${depTask.status})`, t.id);
      }
    }
  }
  const now = Date.now();
  const staleThreshold = 4 * 60 * 60 * 1e3;
  let sweepable = 0;
  for (const t of tasks) {
    if (t.status !== STATUS.IN_PROGRESS || !t.claimed_at) continue;
    const claimed = new Date(t.claimed_at).getTime();
    if (now - claimed > staleThreshold) {
      sweepable++;
      try {
        const insp = await inspectTask(t, repoRoot);
        if (insp.dirty) add("info", `Sweepable but dirty \u2014 would be skipped by sweeper`, t.id);
        else if (insp.aheadOfMain > 0) add("info", `Sweepable with ${insp.aheadOfMain} ahead \u2014 would move to Review`, t.id);
        else add("info", `Sweepable \u2014 would reset to Ready`, t.id);
      } catch {
        add("info", `Sweepable \u2014 would reset to Ready`, t.id);
      }
    }
  }
  const adapter = getAgentFrameworkAdapter(config.agentFramework?.id);
  const adapterIssues = adapter.doctor(repoRoot);
  for (const issue of adapterIssues) {
    if (issue.severity === "info") {
      ok.push(issue.message);
    } else {
      issues.push(issue);
    }
  }
  const repairs = [];
  if (options?.fix) {
    try {
      assertCanForce(resolveAuthority());
    } catch (err) {
      if (err instanceof ForceRequiresHumanOrDoctorError) {
        const result = failedResult({
          command: "doctor",
          error: "Normal agents may not run doctor --fix.",
          code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR",
          nextCommands: [
            { command: "taskforge doctor --check --json", purpose: "Run diagnostics without mutation", when: "Before requesting recovery", allowedFor: "all", priority: 1 },
            { command: 'taskforge block <TASK-ID> "Doctor fix requires human or doctor authority"', purpose: "Escalate unsafe recovery", when: "If repairs are required", allowedFor: "all", priority: 2 }
          ]
        });
        if (options?.json) writeResult(result, options.json);
        else logWarn(result.error ?? "Normal agents may not run doctor --fix.");
        return;
      }
      throw err;
    }
    const adapterRepairs = adapter.fix(repoRoot);
    repairs.push(...adapterRepairs);
    for (const repair of adapterRepairs) {
      ok.push(`Repaired: ${repair.message}`);
    }
  }
  if (options?.lock) {
    try {
      assertCanForce(resolveAuthority());
      const reason = options.reason ?? "Doctor recovery in progress";
      createDoctorLock(reason, { ttlHours: options.ttlHours, repoRoot });
      repairs.push({ code: "DOCTOR_LOCK", message: `Doctor lock acquired: ${reason}` });
      ok.push(`Doctor lock acquired: ${reason}`);
    } catch (err) {
      if (err instanceof ForceRequiresHumanOrDoctorError) {
        const result = failedResult({
          command: "doctor",
          error: "Normal agents may not acquire doctor lock.",
          code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR",
          nextCommands: [
            { command: "taskforge doctor --check --json", purpose: "Run diagnostics without mutation", when: "Before requesting recovery", allowedFor: "all", priority: 1 }
          ]
        });
        if (options?.json) writeResult(result, options.json);
        else logWarn(result.error ?? "Normal agents may not acquire doctor lock.");
        return;
      }
      throw err;
    }
  }
  const jsonlIssues = validateJsonlFiles(repoRoot);
  for (const issue of jsonlIssues) {
    const relativePath = path13.relative(repoRoot, issue.filePath);
    const reason = issue.reason === "parse_error" ? "invalid JSON" : "schema validation failed";
    add("warn", `Corrupted JSONL line in ${relativePath}:${issue.line} (${reason})`, void 0, "JSONL_CORRUPT");
  }
  const hooksResult = checkHooks(repoRoot);
  if (hooksResult.ok) {
    ok.push("Git hooks installed and executable");
  } else {
    for (const issue of hooksResult.issues) {
      add("warn", issue);
    }
  }
  const doneTasks = tasks.filter((t) => t.status === STATUS.DONE);
  for (const t of doneTasks) {
    if (!hasAcceptanceCriteriaSection(t.body)) {
      add("warn", "Done task missing acceptance criteria section", t.id, "AC_MISSING");
    } else if (hasBlankAcceptanceCriteria(t.body)) {
      add("warn", "Done task has blank acceptance criteria", t.id, "AC_BLANK");
    } else if (hasUncheckedAcceptanceCriteria(t.body)) {
      add("warn", "Done task has unchecked acceptance criteria", t.id, "AC_UNCHECKED");
    }
  }
  if (options?.json) {
    const errCount2 = issues.filter((i) => i.severity === "error").length;
    const warnCount2 = issues.filter((i) => i.severity === "warn").length;
    const hasErrors = errCount2 > 0;
    const result = hasErrors ? failedResult({
      command: "doctor",
      error: `${errCount2} error(s) and ${warnCount2} warning(s) found.`,
      code: "DOCTOR_ISSUES",
      guidance: `TaskForge Doctor: ${tasks.length} tasks, ${errCount2} errors, ${warnCount2} warnings, ${sweepable} sweepable, ${repairs.length} repairs.`
    }) : successResult({
      command: "doctor",
      guidance: `TaskForge Doctor: ${tasks.length} tasks, ${ok.length} checks passed, ${repairs.length} repairs.`
    });
    result.data = {
      tasks: tasks.length,
      checksPassed: ok,
      issues,
      issueCounts: { errors: errCount2, warnings: warnCount2 },
      sweepable,
      repairs
    };
    writeResult(result, options.json);
    return;
  }
  logHeader("# TaskForge Doctor");
  logDivider();
  for (const o of ok) logSuccess(`\u2713 ${o}`);
  for (const i of issues) {
    const prefix = i.severity === "error" ? "\u2717" : i.severity === "warn" ? "\u26A0" : "\u2139";
    const taskLabel = i.taskId ? ` [${i.taskId}]` : "";
    const logFn = i.severity === "error" ? logWarn : i.severity === "warn" ? logWarn : logInfo;
    logFn(`${prefix}${taskLabel} ${i.message}`);
  }
  if (repairs.length > 0) {
    logDivider();
    logHeader("## Repairs");
    for (const r of repairs) {
      logSuccess(`\u2713 ${r.message}`);
    }
  }
  logDivider();
  const errCount = issues.filter((i) => i.severity === "error").length;
  const warnCount = issues.filter((i) => i.severity === "warn").length;
  logInfo(`Tasks: ${tasks.length} total | Errors: ${errCount} | Warnings: ${warnCount} | Sweepable: ${sweepable} | Repairs: ${repairs.length}`);
}

// src/commands/config-validate.ts
async function cmdConfigValidate(options) {
  const repoRoot = getRepoRoot();
  const issues = [];
  let config;
  try {
    config = loadConfig(repoRoot);
  } catch (err) {
    issues.push(`Failed to load config: ${err instanceof Error ? err.message : String(err)}`);
    if (options?.json) {
      writeResult(failedResult({
        command: "config-validate",
        error: issues[0],
        code: "CONFIG_INVALID",
        guidance: `Config validation failed: ${issues[0]}`
      }), options.json);
      return;
    }
    logWarn(`Config invalid: ${issues[0]}`);
    return;
  }
  if (config?.gates) {
    for (const [name, cmd] of Object.entries(config.gates)) {
      if (typeof cmd !== "string" || cmd.trim().length === 0) {
        issues.push(`Gate '${name}' is not a valid command string`);
      }
    }
  }
  if (issues.length === 0) {
    if (options?.json) writeResult(successResult({ command: "config-validate", guidance: "Config is valid." }), options.json);
    else logSuccess("Config is valid.");
  } else {
    if (options?.json) writeResult(failedResult({
      command: "config-validate",
      error: issues.join("; "),
      code: "CONFIG_INVALID",
      guidance: `Config validation failed: ${issues.join("; ")}`
    }), options.json);
    else issues.forEach((i) => logWarn(i));
  }
}

// src/commands/release.ts
async function cmdRelease(taskId, options) {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);
  if (!task) {
    if (options?.json) {
      writeResult(failedResult({ command: "release", taskId, error: `Task ${taskId} not found`, code: "TASK_NOT_FOUND" }), true);
      return;
    }
    throw new TaskNotFoundError(taskId);
  }
  if (!task.assignee) {
    if (options?.json) {
      writeResult(successResult({ command: "release", taskId, guidance: `Task ${taskId} is not claimed \u2014 nothing to release.` }), true);
      return;
    }
    logInfo(`Task ${taskId} is not claimed \u2014 nothing to release.`);
    logDivider();
    logInfo("Next actions:");
    logSub(`  taskforge claim ${taskId}   \u2014 Claim this task`);
    logSub(`  taskforge start ${taskId}   \u2014 Claim and create worktree`);
    return;
  }
  const previousAssignee = task.assignee;
  const wasInProgress = task.status === STATUS.IN_PROGRESS;
  await assertTaskOwnership(task, repoRoot);
  clearTaskLock(task.filePath);
  if (wasInProgress) {
    updateTaskStatus(task.filePath, STATUS.READY);
  }
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [
    `Task released by session "${previousAssignee}"${wasInProgress ? " \u2014 reset to Ready" : ""}`
  ]);
  if (task.worktree) {
    removeSessionState(task.worktree);
  }
  if (previousAssignee) {
    markAgentIdle(previousAssignee, repoRoot);
  }
  await commitAndPushTaskState(repoRoot, `chore: release ${taskId}`);
  if (options?.json) {
    const nextCommands = [
      { command: "taskforge next", purpose: "Find the next available task", when: "After release", allowedFor: "all", priority: 1 },
      { command: "taskforge claim <id>", purpose: "Claim a different task", when: "After release", allowedFor: "all", priority: 2 }
    ];
    writeResult(successResult({ command: "release", taskId, guidance: `Task ${taskId} released by "${previousAssignee}"${wasInProgress ? " and reset to Ready" : ""}. Run 'taskforge next' to find the next task, or 'taskforge claim <id>' to claim a different task.`, nextCommands }), true);
    return;
  }
  logSuccess(`Task ${taskId} released.${wasInProgress ? " Status reset to Ready." : ""}`);
  logDivider();
  logInfo("Next actions:");
  logSub("  taskforge next            \u2014 Find the next available task");
  logSub("  taskforge claim <id>      \u2014 Claim a different task");
}

// src/commands/reject.ts
async function cmdReject(taskId, reason, options) {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);
  if (!task) {
    if (options?.json) {
      writeResult(failedResult({ command: "reject", taskId, error: `Task ${taskId} not found`, code: "TASK_NOT_FOUND" }), true);
      return;
    }
    throw new TaskNotFoundError(taskId);
  }
  updateTaskStatus(task.filePath, STATUS.REJECTED);
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  appendAgentNote(task.filePath, today, "System", [`Task rejected: ${reason}`]);
  await commitAndPushTaskState(repoRoot, `chore: reject ${taskId}`);
  if (options?.json) {
    const nextCommands = [
      { command: 'taskforge new "<title>"', purpose: "Create a replacement task", when: "After rejection", allowedFor: "all", priority: 1 },
      { command: "taskforge next", purpose: "Find the next available task", when: "After rejection", allowedFor: "all", priority: 2 }
    ];
    writeResult(successResult({ command: "reject", taskId, guidance: `Task ${taskId} rejected. Run 'taskforge new "<title>"' to create a replacement task, or 'taskforge next' to find the next available task.`, nextCommands }), true);
    return;
  }
  logSuccess(`Task ${taskId} rejected: ${reason}`);
  logDivider();
  logInfo("Next actions:");
  logSub('  taskforge new "<title>"  \u2014 Create a replacement task');
  logSub("  taskforge next           \u2014 Find the next available task");
}

// src/commands/list.ts
function matchesSearch(task, search) {
  const lower = search.toLowerCase();
  return task.id.toLowerCase().includes(lower) || task.body.toLowerCase().includes(lower);
}
function getTitle(task) {
  const match = task.body.match(/^#\s+\S+:\s+(.+)$/m);
  return match ? match[1].trim() : task.id;
}
function filterTasks(tasks, options) {
  const normalizedStatus = options.status ? normalizeStatus(options.status) : void 0;
  return tasks.filter((t) => {
    if (normalizedStatus && t.status !== normalizedStatus) return false;
    if (options.priority && t.priority !== options.priority) return false;
    if (options.type && t.type !== options.type) return false;
    if (options.search && !matchesSearch(t, options.search)) return false;
    return true;
  });
}
async function cmdList(options = {}) {
  const tasks = loadAllTasks();
  const filtered = filterTasks(tasks, options);
  if (options.json) {
    const entries = filtered.map((t) => ({
      id: t.id,
      status: t.status,
      priority: t.priority,
      type: t.type,
      title: getTitle(t),
      agentRole: t.agentRole,
      blocked_reason: t.blocked_reason,
      blocked_by: t.blocked_by,
      block_category: t.block_category
    }));
    const result = successResult({
      command: "list",
      guidance: `Found ${entries.length} task(s) matching criteria.`
    });
    result.data = {
      total: entries.length,
      filters: {
        status: options.status ? normalizeStatus(options.status) : void 0,
        priority: options.priority,
        type: options.type,
        search: options.search
      },
      tasks: entries
    };
    writeResult(result, options.json);
    return;
  }
  if (filtered.length === 0) {
    logInfo("No tasks matching criteria.");
    return;
  }
  logHeader(`## Tasks (${filtered.length})`);
  logDivider();
  for (const t of filtered) {
    const title = getTitle(t);
    logSub(`- **${t.id}** [${t.status}] (${t.priority}, ${t.type}): ${title}`);
    if (t.blocked_reason && t.status === "Blocked") {
      logSub(`  \u21B3 ${t.block_category !== "unspecified" ? `[${t.block_category}] ` : ""}${t.blocked_reason}`);
    }
  }
  logDivider();
}

// src/integrations/github/service.ts
import { Octokit as Octokit2 } from "@octokit/rest";

// src/integrations/github/types.ts
var STATUS_LABELS = {
  [STATUS.INBOX]: "inbox",
  [STATUS.NEEDS_SPEC]: "needs-spec",
  [STATUS.READY]: "ready",
  [STATUS.IN_PROGRESS]: "in-progress",
  [STATUS.BLOCKED]: "blocked",
  [STATUS.IMPLEMENTATION_COMPLETE]: "impl-complete",
  [STATUS.SUBMITTED]: "submitted",
  [STATUS.REVIEW]: "review",
  [STATUS.MERGE_READY]: "merge-ready",
  [STATUS.VERIFY]: "verify",
  [STATUS.DONE]: "done",
  [STATUS.REJECTED]: "rejected",
  [STATUS.DEFERRED]: "deferred"
};
var STATUS_COLORS = {
  inbox: "d4c5f9",
  "needs-spec": "fef2c0",
  ready: "0e8a16",
  "in-progress": "fbca04",
  blocked: "e11d21",
  "impl-complete": "c5def5",
  submitted: "bfdadc",
  review: "1d76db",
  "merge-ready": "0e8a16",
  verify: "006b75",
  done: "0e8a16",
  rejected: "e11d21",
  deferred: "d4c5f9"
};

// src/integrations/github/service.ts
var LABEL_NAMES = ["taskforge", ...Object.values(STATUS_LABELS)];
var _octokit = null;
var _config = null;
function getOctokit() {
  if (!_octokit) {
    const token = process.env.GITHUB_TOKEN;
    _octokit = new Octokit2(token ? { auth: token } : {});
  }
  return _octokit;
}
function setConfig(config) {
  _config = config;
  _octokit = null;
  if (config.token) {
    _octokit = new Octokit2({ auth: config.token });
  }
}
async function createIssue(config, data) {
  const octokit = config.token ? new Octokit2({ auth: config.token }) : getOctokit();
  const response = await octokit.issues.create({
    owner: config.owner,
    repo: config.repo,
    title: data.title,
    body: data.body,
    labels: data.labels
  });
  return { number: response.data.number, url: response.data.html_url };
}
async function updateIssueLabels(config, issueNumber, newStatusLabel) {
  const octokit = config.token ? new Octokit2({ auth: config.token }) : getOctokit();
  const { data: currentLabels } = await octokit.issues.listLabelsOnIssue({
    owner: config.owner,
    repo: config.repo,
    issue_number: issueNumber
  });
  const statusLabelValues = Object.values(STATUS_LABELS);
  const nonStatusLabels = currentLabels.filter((l) => !statusLabelValues.includes(l.name)).map((l) => l.name).filter((name) => name !== void 0);
  const newLabels = [...nonStatusLabels, newStatusLabel];
  await octokit.issues.setLabels({
    owner: config.owner,
    repo: config.repo,
    issue_number: issueNumber,
    labels: newLabels
  });
}
async function ensureLabels(config) {
  const octokit = config.token ? new Octokit2({ auth: config.token }) : getOctokit();
  let existingLabels;
  try {
    const { data } = await octokit.issues.listLabelsForRepo({
      owner: config.owner,
      repo: config.repo,
      per_page: 100
    });
    existingLabels = new Set(data.map((l) => l.name));
  } catch {
    existingLabels = /* @__PURE__ */ new Set();
  }
  for (const name of LABEL_NAMES) {
    if (existingLabels.has(name)) continue;
    const color = name === "taskforge" ? "0052cc" : STATUS_COLORS[name] ?? "ededed";
    try {
      await octokit.issues.createLabel({
        owner: config.owner,
        repo: config.repo,
        name,
        color
      });
    } catch {
    }
  }
}
async function updateIssueBody(config, issueNumber, body) {
  const octokit = config.token ? new Octokit2({ auth: config.token }) : getOctokit();
  await octokit.issues.update({
    owner: config.owner,
    repo: config.repo,
    issue_number: issueNumber,
    body
  });
}
function generateIssueBody(id, taskBody) {
  return `## TaskForge Task: ${id}

This issue is managed by TaskForge Autonomous Coding Board.

**Do not edit this issue directly.** Changes should be made to the task file in \`tasks/${id}.md\`.

---

${taskBody}
`;
}
async function createPullRequest(config, title, head, base, body) {
  const octokit = config.token ? new Octokit2({ auth: config.token }) : getOctokit();
  const response = await octokit.pulls.create({
    owner: config.owner,
    repo: config.repo,
    title,
    head,
    base,
    body
  });
  return {
    number: response.data.number,
    url: response.data.html_url
  };
}

// src/integrations/github/projects.ts
async function graphql(query, variables) {
  const octokit = getOctokit();
  const response = await octokit.graphql(query, variables);
  return response;
}
async function getProjectNodeId(owner, projectNumber) {
  const query = `
    query($owner: String!, $number: Int!) {
      organization(login: $owner) {
        projectV2(number: $number) {
          id
        }
      }
    }
  `;
  try {
    const result = await graphql(query, { owner, number: projectNumber });
    if (!result.organization?.projectV2) {
      logError(`Project #${projectNumber} not found for ${owner}`);
      return null;
    }
    return result.organization.projectV2.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(`Failed to find project #${projectNumber}: ${msg}`);
    return null;
  }
}
async function getIssueNodeId(owner, repo, issueNumber) {
  const query = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          id
        }
      }
    }
  `;
  try {
    const result = await graphql(query, {
      owner,
      repo,
      number: issueNumber
    });
    return result.repository?.issue?.id ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(`Failed to get node ID for issue #${issueNumber}: ${msg}`);
    return null;
  }
}
async function getStatusFieldInfo(projectId, fieldName, statusValue) {
  const query = `
    query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          fields(first: 50) {
            nodes {
              ... on ProjectV2Field {
                id
                name
                dataType
              }
              ... on ProjectV2SingleSelectField {
                id
                name
                dataType
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `;
  try {
    const result = await graphql(query, {
      projectId
    });
    const fields = result.node?.fields?.nodes ?? [];
    const field = fields.find((f) => f.name === fieldName && f.dataType === "SINGLE_SELECT");
    if (!field) {
      logError(`Status field "${fieldName}" not found in project.`);
      return null;
    }
    const option = field.options?.find(
      (o) => o.name.toLowerCase() === statusValue.toLowerCase()
    );
    if (!option) {
      logError(
        `Status option "${statusValue}" not found in field "${fieldName}". Available: ${field.options?.map((o) => o.name).join(", ") ?? "none"}`
      );
      return null;
    }
    return { fieldId: field.id, optionId: option.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(`Failed to query project fields: ${msg}`);
    return null;
  }
}
async function findProjectItemId(projectId, contentId) {
  const query = `
    query($projectId: ID!, $contentId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue { id }
                ... on PullRequest { id }
              }
            }
          }
        }
      }
    }
  `;
  try {
    const result = await graphql(query, {
      projectId,
      contentId
    });
    const items = result.node?.items?.nodes ?? [];
    const match = items.find(
      (item) => item.content?.id === contentId
    );
    return match?.id ?? null;
  } catch {
    return null;
  }
}
async function addProjectItem(projectId, contentId) {
  const mutation = `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item { id }
      }
    }
  `;
  try {
    const result = await graphql(mutation, {
      projectId,
      contentId
    });
    return result.addProjectV2ItemById?.item?.id ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(`Failed to add item to project: ${msg}`);
    return null;
  }
}
async function updateItemStatus(projectId, itemId, fieldId, optionId) {
  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(
        input: {
          projectId: $projectId,
          itemId: $itemId,
          fieldId: $fieldId,
          value: { singleSelectOptionId: $optionId }
        }
      ) {
        projectV2Item { id }
      }
    }
  `;
  try {
    await graphql(mutation, {
      projectId,
      itemId,
      fieldId,
      optionId
    });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(`Failed to update item status: ${msg}`);
    return false;
  }
}
async function syncTaskToProject(config, issueNumber, taskStatus, fieldName) {
  if (!config.projectNumber) {
    return true;
  }
  const projectId = await getProjectNodeId(config.owner, config.projectNumber);
  if (!projectId) return false;
  const contentId = await getIssueNodeId(
    config.owner,
    config.repo,
    issueNumber
  );
  if (!contentId) return false;
  const fieldInfo = await getStatusFieldInfo(projectId, fieldName, taskStatus);
  if (!fieldInfo) return false;
  let itemId = await findProjectItemId(projectId, contentId);
  if (!itemId) {
    itemId = await addProjectItem(projectId, contentId);
    if (!itemId) return false;
  }
  return await updateItemStatus(projectId, itemId, fieldInfo.fieldId, fieldInfo.optionId);
}

// src/commands/sync.ts
async function cmdSync(json = false) {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);
  logInfo("# TaskForge Sync");
  logInfo("");
  if (!config.github?.enabled) {
    logInfo("GitHub integration is not enabled in config.");
    logInfo("");
    logInfo("To enable, set in .taskforge/config.json:");
    logInfo('  "github": { "enabled": true, "owner": "...", "repo": "..." }');
    logInfo("");
    logInfo("Ensure GITHUB_TOKEN is set in environment.");
    return;
  }
  const githubConfig = {
    owner: config.github.owner ?? "",
    repo: config.github.repo ?? "",
    projectNumber: config.github.projectNumber
  };
  if (!githubConfig.owner || !githubConfig.repo) {
    logError("GitHub owner and repo must be configured.");
    return;
  }
  setConfig(githubConfig);
  const tasks = loadAllTasks(repoRoot);
  if (tasks.length === 0) {
    logInfo("No task files found.");
    return;
  }
  logInfo(`## Syncing ${tasks.length} task(s) to ${githubConfig.owner}/${githubConfig.repo}`);
  logInfo("");
  await ensureLabels(githubConfig);
  const syncedIssues = [];
  for (const task of tasks) {
    const titleMatch = task.body.match(/^#\s+\S+:\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : task.id;
    if (task.issue) {
      await updateExistingIssue(githubConfig, task.issue, task);
      logSuccess(`Updated #${task.issue}: ${task.id} - ${title}`);
      syncedIssues.push({ issueNumber: task.issue, taskId: task.id, taskStatus: task.status });
    } else {
      const issueNumber = await createNewIssue(githubConfig, task, title);
      if (issueNumber) {
        updateTaskIssue(task.filePath, issueNumber);
        logSuccess(`Created #${issueNumber}: ${task.id} - ${title}`);
        syncedIssues.push({ issueNumber, taskId: task.id, taskStatus: task.status });
      }
    }
  }
  await commitAndPushTaskState(repoRoot, "chore: sync tasks with GitHub");
  if (config.github.projectNumber && syncedIssues.length > 0) {
    await syncToProjectBoard(githubConfig, config, syncedIssues);
  }
  logInfo("");
  logInfo("## Sync Status");
  logInfo("");
  const projectSuffix = config.github.projectNumber ? ` and Project #${config.github.projectNumber}` : "";
  logSuccess(`All tasks synced to GitHub Issues${projectSuffix}.`);
  writeResult(successResult({
    command: "sync",
    guidance: `All tasks synced to GitHub Issues${projectSuffix}.`
  }), json);
}
async function syncToProjectBoard(githubConfig, config, syncedIssues) {
  const fieldName = config.github?.projects?.statusField ?? "Status";
  const columnMapping = config.github?.projects?.columnMapping;
  logInfo("");
  logInfo(`## Syncing ${syncedIssues.length} task(s) to Project board`);
  logInfo("");
  for (const { issueNumber, taskId, taskStatus } of syncedIssues) {
    const projectStatus = columnMapping?.[taskStatus] ?? taskStatus;
    const ok = await syncTaskToProject(
      githubConfig,
      issueNumber,
      projectStatus,
      fieldName
    );
    if (ok) {
      logSuccess(`Project #${issueNumber}: ${taskId} \u2192 ${projectStatus}`);
    } else {
      logError(`Failed to sync ${taskId} to project board.`);
    }
  }
}
async function createNewIssue(githubConfig, task, title) {
  const statusLabel = STATUS_LABELS[task.status] ?? "inbox";
  const labels = ["taskforge", statusLabel];
  if (task.priority === "P0") labels.push("p0");
  else if (task.priority === "P1") labels.push("p1");
  const body = generateIssueBody(task.id, task.body);
  try {
    const result = await createIssue(githubConfig, {
      title: `${task.id}: ${title}`,
      body,
      labels
    });
    return result.number;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(`Failed to create issue for ${task.id}: ${msg}`);
    return null;
  }
}
async function updateExistingIssue(githubConfig, issueNumber, task) {
  const statusLabel = STATUS_LABELS[task.status] ?? "inbox";
  try {
    await Promise.all([
      updateIssueLabels(githubConfig, issueNumber, statusLabel),
      updateIssueBody(githubConfig, issueNumber, task.body)
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(`Failed to update issue #${issueNumber}: ${msg}`);
  }
}

// src/commands/agents.ts
function formatAge(heartbeat) {
  const now = Date.now();
  const heartbeatTime = new Date(heartbeat).getTime();
  const diffMs = now - heartbeatTime;
  const diffMinutes = Math.floor(diffMs / 6e4);
  const diffHours = Math.floor(diffMs / 36e5);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}
function serializeAgent(agent) {
  return {
    session_id: agent.session_id,
    agent_id: agent.agent_id,
    last_heartbeat: agent.last_heartbeat,
    last_heartbeat_age: formatAge(agent.last_heartbeat),
    current_task: agent.current_task,
    status: agent.status,
    worktree_path: agent.worktree_path,
    registered_at: agent.registered_at
  };
}
async function cmdAgents(options) {
  const repoRoot = getRepoRoot();
  if (options?.recover) {
    const threshold = options.threshold ?? 15;
    const crashed2 = markStaleAgentsAsCrashed(threshold, repoRoot);
    if (options.json) {
      const result = successResult({
        command: "agents",
        guidance: crashed2.length === 0 ? "No stale agents found." : `Marked ${crashed2.length} stale agent(s) as crashed.`
      });
      result.data = {
        recovered: crashed2.map(serializeAgent),
        thresholdMinutes: threshold
      };
      writeResult(result, options.json);
    } else {
      if (crashed2.length === 0) {
        logSuccess("No stale agents found.");
      } else {
        logHeader(`## Stale Agents Marked as Crashed: ${crashed2.length}`);
        for (const agent of crashed2) {
          logSub(`- **${agent.session_id}** (${agent.agent_id}) \u2014 Task: ${agent.current_task ?? "none"} \u2014 Last heartbeat: ${formatAge(agent.last_heartbeat)}`);
        }
      }
    }
    return;
  }
  if (options?.stale) {
    const threshold = options.threshold ?? 15;
    const stale = findStaleAgents(threshold, repoRoot);
    if (options.json) {
      const result = successResult({
        command: "agents",
        guidance: stale.length === 0 ? "No stale agents found." : `Found ${stale.length} stale agent(s) (threshold: ${threshold}m). Run 'taskforge agents --recover' to mark them as crashed.`
      });
      result.data = {
        stale: stale.map(serializeAgent),
        thresholdMinutes: threshold
      };
      writeResult(result, options.json);
    } else {
      if (stale.length === 0) {
        logSuccess("No stale agents found.");
      } else {
        logHeader(`## Stale Agents (>${options.threshold ?? 15}m): ${stale.length}`);
        for (const agent of stale) {
          logSub(`- **${agent.session_id}** (${agent.agent_id}) \u2014 Task: ${agent.current_task ?? "none"} \u2014 Last heartbeat: ${formatAge(agent.last_heartbeat)}`);
        }
        logDivider();
        logInfo("Run 'taskforge agents --recover' to mark stale agents as crashed.");
      }
    }
    return;
  }
  const registry = readAgentRegistry(repoRoot);
  const active = registry.agents.filter((a) => a.status === "active");
  const idle = registry.agents.filter((a) => a.status === "idle");
  const crashed = registry.agents.filter((a) => a.status === "crashed");
  if (options?.json) {
    const result = successResult({
      command: "agents",
      guidance: registry.agents.length === 0 ? "No agents registered yet. Agents are registered when they claim or start a task." : `Agent registry: ${registry.agents.length} total, ${active.length} active, ${idle.length} idle, ${crashed.length} crashed.`
    });
    result.data = {
      max_concurrent_agents: registry.max_concurrent_agents,
      last_updated: registry.last_updated,
      counts: {
        total: registry.agents.length,
        active: active.length,
        idle: idle.length,
        crashed: crashed.length
      },
      agents: registry.agents.map(serializeAgent)
    };
    writeResult(result, options.json);
    return;
  }
  logHeader("## Agent Registry");
  logSub(`**Max Concurrent Agents:** ${registry.max_concurrent_agents}`);
  logSub(`**Last Updated:** ${formatAge(registry.last_updated)}`);
  logDivider();
  if (active.length > 0) {
    logHeader(`### Active Agents: ${active.length}`);
    for (const agent of active) {
      logSub(`- **${agent.session_id}** (${agent.agent_id}) \u2014 Task: ${agent.current_task ?? "none"} \u2014 Last heartbeat: ${formatAge(agent.last_heartbeat)}`);
    }
    logDivider();
  }
  if (idle.length > 0) {
    logHeader(`### Idle Agents: ${idle.length}`);
    for (const agent of idle) {
      logSub(`- **${agent.session_id}** (${agent.agent_id}) \u2014 Last heartbeat: ${formatAge(agent.last_heartbeat)}`);
    }
    logDivider();
  }
  if (crashed.length > 0) {
    logHeader(`### Crashed Agents: ${crashed.length}`);
    for (const agent of crashed) {
      logSub(`- **${agent.session_id}** (${agent.agent_id}) \u2014 Task: ${agent.current_task ?? "none"} \u2014 Last heartbeat: ${formatAge(agent.last_heartbeat)}`);
    }
    logDivider();
  }
  if (registry.agents.length === 0) {
    logInfo("No agents registered yet.");
    logSub("Agents are registered when they claim or start a task.");
  }
  logSuccess(`Total: ${registry.agents.length} agents (${active.length} active, ${idle.length} idle, ${crashed.length} crashed)`);
}

// src/commands/deps/audit.ts
import { execa as execa5 } from "execa";
async function runAudit(packageManager, repoRoot) {
  const pm = packageManager === "npm" ? "npm" : "pnpm";
  const cmd = pm === "npm" ? "npm" : "pnpm";
  try {
    const result = await execa5(cmd, ["audit", "--json"], {
      cwd: repoRoot,
      reject: false
    });
    const raw = result.stdout;
    let findings = [];
    try {
      const parsed = JSON.parse(raw);
      if (pm === "npm" && parsed.auditReportVersion) {
        const vulnerabilities = parsed.vulnerabilities ?? {};
        for (const [pkgName, vuln] of Object.entries(vulnerabilities)) {
          const via = vuln.via ?? [];
          for (const v of via) {
            if (typeof v.source === "number") continue;
            findings.push({
              id: `npm-${pkgName}-${v.name ?? "unknown"}`,
              package: pkgName,
              severity: v.severity ?? "medium",
              title: v.title ?? v.name ?? "Unknown vulnerability",
              url: v.url ?? void 0,
              vulnerableVersions: v.vulnerableVersions ?? void 0,
              patchedVersions: v.patchedVersions ?? void 0,
              direct: vuln.isDirect ?? false
            });
          }
        }
      } else if (parsed.metadata && parsed.advisories !== void 0) {
        const advisories = parsed.advisories ?? {};
        for (const [advId, adv] of Object.entries(advisories)) {
          findings.push({
            id: advId,
            package: adv.moduleName ?? adv.package ?? "unknown",
            severity: adv.severity ?? "medium",
            title: adv.title ?? "Unknown vulnerability",
            url: adv.url ?? void 0,
            vulnerableVersions: adv.vulnerableVersions ?? void 0,
            patchedVersions: adv.patchedVersions ?? void 0,
            direct: adv.directDependency ?? false
          });
        }
      }
    } catch {
    }
    return {
      ok: result.exitCode === 0,
      findings,
      raw
    };
  } catch (error2) {
    const msg = error2 instanceof Error ? error2.message : String(error2);
    return { ok: false, findings: [], raw: `Audit command failed: ${msg}` };
  }
}

// src/commands/deps/outdated.ts
import { execa as execa6 } from "execa";
async function runOutdated(packageManager, repoRoot) {
  const cmd = packageManager === "npm" ? "npm" : "pnpm";
  try {
    const result = await execa6(cmd, ["outdated", "--json"], {
      cwd: repoRoot,
      reject: false
    });
    const raw = result.stdout;
    let packages = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          const current = entry.current ?? "unknown";
          const latest = entry.latest ?? "unknown";
          const pkgName = entry.name ?? entry.package ?? "unknown";
          packages.push({
            package: pkgName,
            current,
            latest,
            type: "dependencies",
            isMajor: isMajorBump(current, latest)
          });
        }
      } else if (typeof parsed === "object" && parsed !== null) {
        for (const [pkgName, info] of Object.entries(parsed)) {
          if (typeof info === "object" && info !== null) {
            const pkgInfo = info;
            const current = pkgInfo.current ?? pkgInfo.installed ?? "unknown";
            const latest = pkgInfo.latest ?? "unknown";
            packages.push({
              package: pkgName,
              current,
              latest,
              type: "dependencies",
              isMajor: isMajorBump(current, latest)
            });
          }
        }
      }
    } catch {
    }
    return { packages, raw };
  } catch {
    return { packages: [], raw: "Outdated command failed or not available." };
  }
}
function isMajorBump(current, latest) {
  const curMajor = current.split(".")[0]?.replace(/[^0-9]/g, "");
  const latMajor = latest.split(".")[0]?.replace(/[^0-9]/g, "");
  if (!curMajor || !latMajor) return false;
  return parseInt(latMajor, 10) > parseInt(curMajor, 10);
}

// src/commands/deps/deprecated.ts
import { execa as execa7 } from "execa";
async function checkDeprecated(repoRoot) {
  const packages = [];
  try {
    const result = await execa7("npm", ["install", "--dry-run", "--json"], {
      cwd: repoRoot,
      reject: false,
      timeout: 3e4
    });
    const raw = result.stdout + result.stderr;
    const depRegex = /npm warn deprecated\s+(\S+)(?:@(\S+))?:\s+(.+)/gi;
    let match;
    while ((match = depRegex.exec(raw)) !== null) {
      packages.push({
        package: match[1],
        version: match[2] ?? "unknown",
        deprecationMessage: match[3],
        direct: false
        // assume transitive unless proven otherwise
      });
    }
    return { packages, raw };
  } catch {
    return { packages: [], raw: "Deprecated check failed or not available." };
  }
}

// src/commands/deps/plan.ts
async function generateDepsPlan() {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);
  const pm = config.dependencies?.packageManager ?? "pnpm";
  const [auditResult, outdatedResult, deprecatedResult] = await Promise.all([
    config.dependencies?.scan?.packageAudit !== false ? runAudit(pm, repoRoot) : Promise.resolve({ ok: true, findings: [], raw: "Audit disabled" }),
    config.dependencies?.scan?.outdated !== false ? runOutdated(pm, repoRoot) : Promise.resolve({ packages: [], raw: "Outdated check disabled" }),
    config.dependencies?.scan?.deprecated !== false ? checkDeprecated(repoRoot) : Promise.resolve({ packages: [], raw: "Deprecated check disabled" })
  ]);
  const critical = auditResult.findings.filter((f) => f.severity === "critical");
  const high = auditResult.findings.filter((f) => f.severity === "high");
  const medium = auditResult.findings.filter((f) => f.severity === "medium");
  const low = auditResult.findings.filter((f) => f.severity === "low" || f.severity === "info");
  const summary = generateSummary(auditResult, outdatedResult, deprecatedResult);
  return {
    critical,
    high,
    medium,
    low,
    deprecated: deprecatedResult.packages,
    outdated: outdatedResult.packages,
    summary
  };
}
function formatPlan(plan) {
  const lines = [];
  lines.push("# Dependency Health Plan");
  lines.push("");
  lines.push(`Generated: ${formatTimestampMarkdown(/* @__PURE__ */ new Date())}`);
  lines.push("");
  lines.push("## Critical Security Findings");
  lines.push("");
  if (plan.critical.length === 0) {
    lines.push("None");
  } else {
    for (const f of plan.critical) {
      lines.push(`- **${f.package}**: ${f.title} [${f.severity}]${f.direct ? " (direct)" : " (transitive)"}`);
      if (f.patchedVersions) lines.push(`  - Patched in: ${f.patchedVersions}`);
      if (f.url) lines.push(`  - Advisory: ${f.url}`);
    }
  }
  lines.push("");
  lines.push("## High Security Findings");
  lines.push("");
  if (plan.high.length === 0) {
    lines.push("None");
  } else {
    for (const f of plan.high) {
      lines.push(`- **${f.package}**: ${f.title} [${f.severity}]${f.direct ? " (direct)" : " (transitive)"}`);
      if (f.patchedVersions) lines.push(`  - Patched in: ${f.patchedVersions}`);
    }
  }
  lines.push("");
  lines.push("## Deprecated Packages");
  lines.push("");
  if (plan.deprecated.length === 0) {
    lines.push("None");
  } else {
    for (const d of plan.deprecated) {
      lines.push(`- **${d.package}@${d.version}**: ${d.deprecationMessage}`);
    }
  }
  lines.push("");
  lines.push("## Outdated Direct Dependencies");
  lines.push("");
  if (plan.outdated.length === 0) {
    lines.push("None");
  } else {
    for (const o of plan.outdated) {
      const risk = o.isMajor ? "major upgrade" : "minor/patch";
      lines.push(`- **${o.package}**: ${o.current} \u2192 ${o.latest} (${risk})`);
    }
  }
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(plan.summary);
  return lines.join("\n");
}
function generateSummary(audit, outdated, deprecated) {
  const parts = [];
  if (!audit.ok) {
    parts.push("Audit failed or not available.");
  } else if (audit.findings.length > 0) {
    parts.push(`${audit.findings.length} vulnerability(ies) found.`);
  } else {
    parts.push("No known vulnerabilities.");
  }
  if (outdated.packages.length > 0) {
    parts.push(`${outdated.packages.length} outdated package(s).`);
  }
  if (deprecated.packages.length > 0) {
    parts.push(`${deprecated.packages.length} deprecated package(s).`);
  }
  if (parts.length === 0) {
    return "All dependencies are healthy.";
  }
  return parts.join(" ");
}
async function cmdDepsPlan() {
  const plan = await generateDepsPlan();
  const formatted = formatPlan(plan);
  logInfo(formatted);
}

// src/commands/deps/scan.ts
async function cmdDepsScan() {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);
  logHeader(`# Dependency Scan`);
  logDivider();
  logSub(`Package manager: ${config.dependencies?.packageManager ?? "pnpm"}`);
  logSub(`OSV-Scanner: ${config.dependencies?.scan?.osv !== false ? "enabled" : "disabled"}`);
  logSub(`Audit: ${config.dependencies?.scan?.packageAudit !== false ? "enabled" : "disabled"}`);
  logSub(`Outdated: ${config.dependencies?.scan?.outdated !== false ? "enabled" : "disabled"}`);
  logSub(`Deprecated: ${config.dependencies?.scan?.deprecated !== false ? "enabled" : "disabled"}`);
  logDivider();
  const plan = await generateDepsPlan();
  if (config.dependencies?.scan?.osv !== false) {
    logHeader(`## OSV-Scanner`);
    logDivider();
    logSub("OSV-Scanner not yet installed. Install with: go install github.com/google/osv-scanner/cmd/osv-scanner@latest");
    logDivider();
  }
  logInfo(formatPlan(plan));
}

// src/commands/deps/create-tasks.ts
import path14 from "path";
async function cmdDepsCreateTasks() {
  const repoRoot = getRepoRoot();
  const plan = await generateDepsPlan();
  const existingTasks = loadAllTasks(repoRoot);
  const existingPackages = /* @__PURE__ */ new Set();
  for (const t of existingTasks) {
    if (t.type === "Dependency" || t.type === "Security" || t.type === "Maintenance") {
      const pkgMatch = t.body.match(/Package:\s*(\S+)/);
      if (pkgMatch) existingPackages.add(pkgMatch[1]);
    }
  }
  let created = 0;
  for (const finding of [...plan.critical, ...plan.high]) {
    if (existingPackages.has(finding.package)) continue;
    const id = getNextId(repoRoot);
    const isCritical = plan.critical.includes(finding);
    const body = generateSecTaskBody(id, finding, isCritical);
    const filePath = path14.join(getTaskStateDir(repoRoot), `${id}.md`);
    writeTaskFile({
      id,
      type: "Security",
      status: STATUS.READY,
      priority: isCritical ? "P0" : "P1",
      agentRole: "Dependency Steward",
      riskLevel: isCritical ? "High" : "Medium",
      humanInterventionRequired: false,
      body,
      filePath
    });
    logSuccess(`Created ${id}: Remediate vulnerability in ${finding.package}`);
    created++;
  }
  for (const dep of plan.deprecated) {
    if (existingPackages.has(dep.package)) continue;
    const id = getNextId(repoRoot);
    const body = generateDepTaskBody(id, dep);
    const filePath = path14.join(getTaskStateDir(repoRoot), `${id}.md`);
    writeTaskFile({
      id,
      type: "Dependency",
      status: STATUS.READY,
      priority: "P2",
      agentRole: "Dependency Steward",
      riskLevel: "Medium",
      humanInterventionRequired: false,
      body,
      filePath
    });
    logSuccess(`Created ${id}: Replace deprecated package ${dep.package}`);
    created++;
  }
  for (const outdated of plan.outdated) {
    if (existingPackages.has(outdated.package)) continue;
    if (outdated.isMajor) continue;
    const id = getNextId(repoRoot);
    const body = generateOutdatedTaskBody(id, outdated);
    const filePath = path14.join(getTaskStateDir(repoRoot), `${id}.md`);
    writeTaskFile({
      id,
      type: "Dependency",
      status: STATUS.READY,
      priority: "P2",
      agentRole: "Dependency Steward",
      riskLevel: "Low",
      humanInterventionRequired: false,
      body,
      filePath
    });
    logSuccess(`Created ${id}: Update ${outdated.package} to ${outdated.latest}`);
    created++;
  }
  logDivider();
  if (created === 0) {
    logInfo("No new dependency tasks to create.");
  } else {
    logSuccess(`Created ${created} dependency task(s).`);
  }
  if (created > 0) {
    const statusMsg = `chore: create ${created} dependency task(s)`;
    await commitAndPushTaskState(repoRoot, statusMsg);
  }
}
function generateSecTaskBody(id, finding, isCritical) {
  return `# ${id}: Remediate vulnerability in ${finding.package}

## Goal

Remediate the known ${finding.severity} vulnerability affecting \`${finding.package}\`.

## Vulnerability Summary

- Package: ${finding.package}
- Severity: ${finding.severity}
- Title: ${finding.title}
- Direct dependency: ${finding.direct ? "yes" : "no"}
${finding.url ? `- Advisory: ${finding.url}` : ""}
${finding.patchedVersions ? `- Fixed version: ${finding.patchedVersions}` : ""}

## Remediation Plan

1. Update to the minimum fixed compatible version.
2. Refresh lockfile.
3. Run audit/scanner.
4. Run relevant tests.
5. Open focused PR.

## Scope

Allowed files/directories:
- package.json
- pnpm-lock.yaml
- package-lock.json
- yarn.lock
- tests/**

Disallowed files/directories:
- unrelated source files unless required by migration

## Acceptance Criteria

- [ ] Vulnerability no longer appears in audit.
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

## Risk Level
${isCritical ? "High" : "Medium"}

## Human Intervention Required?
${isCritical ? "Yes \u2014 critical vulnerability may require migration review." : "No"}

## Continuation Policy
Auto-continue for patch/minor updates if tests pass. Stop for human intervention on major upgrades.

## Agent Notes

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Advisory: ${finding.url ?? ""}
`;
}
function generateDepTaskBody(id, dep) {
  return `# ${id}: Replace deprecated package ${dep.package}

## Goal

Replace or update the deprecated package \`${dep.package}\`.

## Finding

- Package: ${dep.package}
- Current version: ${dep.version}
- Deprecation message: ${dep.deprecationMessage}

## Scope

Allowed files/directories:
- package.json
- pnpm-lock.yaml
- tests/**

Disallowed files/directories:
- unrelated source files

## Acceptance Criteria

- [ ] Deprecated package is replaced or updated.
- [ ] Lockfile is updated.
- [ ] Relevant tests pass.
- [ ] No unrelated dependency churn.

## Test / Verification Command
\`\`\`bash
pnpm install --frozen-lockfile
pnpm test
\`\`\`

## Risk Level
Medium

## Human Intervention Required?
No unless replacement requires significant code changes.

## Continuation Policy
Auto-continue if replacement is clearly drop-in and tests pass.

## Agent Notes

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
`;
}
function generateOutdatedTaskBody(id, outdated) {
  return `# ${id}: Update ${outdated.package} from ${outdated.current} to ${outdated.latest}

## Goal

Update \`${outdated.package}\` to the latest compatible version.

## Package

- Package: ${outdated.package}
- Current version: ${outdated.current}
- Target version: ${outdated.latest}
- Direct dependency: yes

## Scope

Allowed files/directories:
- package.json
- pnpm-lock.yaml

Disallowed files/directories:
- unrelated source files

## Acceptance Criteria

- [ ] Package is updated to target version.
- [ ] Lockfile is updated.
- [ ] No unrelated dependency churn.
- [ ] Relevant tests pass.

## Test / Verification Command
\`\`\`bash
pnpm install --frozen-lockfile
pnpm test
\`\`\`

## Risk Level
Low

## Human Intervention Required?
No

## Continuation Policy
Auto-continue if tests pass.

## Agent Notes

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
`;
}

// src/commands/deps/audit-cmd.ts
async function cmdDepsAudit(severity, createTasks = false) {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);
  const pm = config.dependencies?.packageManager ?? "pnpm";
  logHeader(`## Dependency Audit`);
  logDivider();
  const result = await runAudit(pm, repoRoot);
  if (!result.ok) {
    logError(result.raw);
    return;
  }
  if (result.findings.length === 0) {
    logSub("No vulnerabilities found.");
    return;
  }
  let findings = result.findings;
  if (severity) {
    const validSeverities = ["critical", "high", "medium", "low", "info"];
    if (!validSeverities.includes(severity)) {
      logError(`Invalid severity level: ${severity}. Must be one of: ${validSeverities.join(", ")}`);
      return;
    }
    findings = result.findings.filter((f) => f.severity === severity);
    if (findings.length === 0) {
      logSub(`No vulnerabilities found with severity: ${severity}`);
      return;
    }
  }
  if (findings.length > 0) {
    const bySeverity = {};
    for (const f of findings) {
      if (!bySeverity[f.severity]) bySeverity[f.severity] = [];
      bySeverity[f.severity].push(f);
    }
    for (const [severityLevel, findings2] of Object.entries(bySeverity)) {
      logHeader(`### ${severityLevel.toUpperCase()} (${findings2.length})`);
      logDivider();
      for (const f of findings2) {
        logSub(`- **${f.package}**: ${f.title}${f.direct ? " (direct)" : " (transitive)"}`);
        if (f.patchedVersions) logSub(`  Patched: ${f.patchedVersions}`);
        if (f.url) logSub(`  ${f.url}`);
      }
      logDivider();
    }
  }
  logSub(`Total findings: ${findings.length}`);
  if (createTasks && findings.length > 0) {
    logSub("Creating tasks for found vulnerabilities...");
    await cmdDepsCreateTasks();
  }
}

// src/commands/deps/outdated-cmd.ts
async function cmdDepsOutdated() {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);
  const pm = config.dependencies?.packageManager ?? "pnpm";
  logHeader(`## Outdated Dependencies`);
  logDivider();
  const result = await runOutdated(pm, repoRoot);
  if (result.packages.length === 0) {
    logSub("All packages are up to date.");
    return;
  }
  const major = result.packages.filter((p) => p.isMajor);
  const minor = result.packages.filter((p) => !p.isMajor);
  if (major.length > 0) {
    logHeader(`### Major Updates (${major.length})`);
    logDivider();
    for (const p of major) {
      logSub(`- **${p.package}**: ${p.current} \u2192 ${p.latest}`);
    }
    logDivider();
  }
  if (minor.length > 0) {
    logHeader(`### Minor/Patch Updates (${minor.length})`);
    logDivider();
    for (const p of minor) {
      logSub(`- **${p.package}**: ${p.current} \u2192 ${p.latest}`);
    }
    logDivider();
  }
  logSub(`Total outdated: ${result.packages.length}`);
}

// src/commands/deps/deprecated-cmd.ts
async function cmdDepsDeprecated() {
  const repoRoot = getRepoRoot();
  logHeader(`## Deprecated Packages`);
  logDivider();
  const result = await checkDeprecated(repoRoot);
  if (result.packages.length === 0) {
    logSub("No deprecated packages found.");
    return;
  }
  for (const d of result.packages) {
    logSub(`- **${d.package}@${d.version}**: ${d.deprecationMessage}`);
  }
  logDivider();
  logSub(`Total deprecated: ${result.packages.length}`);
}

// src/commands/deps/pr.ts
import { execa as execa8 } from "execa";
import simpleGit2 from "simple-git";
import fs16 from "fs";
import path15 from "path";
async function cmdDepsPr() {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);
  const pm = config.dependencies?.packageManager ?? "pnpm";
  const policy = config.dependencies?.policy ?? {};
  logHeader(`# Dependency PR Creator`);
  logDivider();
  const outdatedResult = await runOutdated(pm, repoRoot);
  if (outdatedResult.packages.length === 0) {
    logInfo("All packages are up to date. Nothing to create PRs for.");
    return;
  }
  const results = [];
  for (const pkg of outdatedResult.packages) {
    const result = await processPackage(repoRoot, pkg, pm, policy);
    results.push(result);
  }
  logDivider();
  logHeader(`## Summary`);
  logDivider();
  const created = results.filter((r) => r.created);
  const skipped = results.filter((r) => !r.created);
  if (created.length > 0) {
    logSuccess(`Created ${created.length} PR(s):`);
    for (const r of created) {
      logSub(`- ${r.package}: ${r.branch} (tests: ${r.testsPassed ? "passed" : "failed"})`);
    }
  }
  if (skipped.length > 0) {
    logWarn(`Skipped ${skipped.length} package(s):`);
    for (const r of skipped) {
      logSub(`- ${r.package}: ${r.reason}`);
    }
  }
  if (created.length === 0 && skipped.length === 0) {
    logInfo("No packages processed.");
  }
}
async function processPackage(repoRoot, pkg, pm, policy) {
  const { package: pkgName, current, latest, isMajor } = pkg;
  if (isMajor && policy.requireHumanForMajor !== false) {
    return {
      created: false,
      package: pkgName,
      risk: "high",
      testsPassed: false,
      reason: "Major version upgrade requires human review"
    };
  }
  const risk = isMajor ? "high" : "medium";
  const branchName = `deps/${pkgName}-${latest.replace(/^v/, "")}`;
  const git = simpleGit2(repoRoot);
  try {
    const branches = await git.branchLocal();
    if (branches.all.includes(branchName)) {
      return {
        created: false,
        package: pkgName,
        risk,
        testsPassed: false,
        reason: `Branch ${branchName} already exists`
      };
    }
    await git.checkoutLocalBranch(branchName);
    const installCmd = pm === "npm" ? "npm" : "pnpm";
    await execa8(installCmd, ["install", `${pkgName}@${latest}`], {
      cwd: repoRoot
    });
    let testsPassed = false;
    try {
      await execa8(pm === "npm" ? "npm" : "pnpm", ["test"], {
        cwd: repoRoot,
        timeout: 6e4
      });
      testsPassed = true;
    } catch {
      testsPassed = false;
    }
    if (testsPassed) {
      await git.add(["package.json", "pnpm-lock.yaml", "package-lock.json", "yarn.lock"].filter((f) => fs16.existsSync(path15.join(repoRoot, f))));
      const status = await git.status();
      if (status.files.length > 0) {
        await git.commit(`deps: update ${pkgName} from ${current} to ${latest}`);
      }
    }
    await git.checkout("main");
    return {
      created: testsPassed,
      branch: branchName,
      package: pkgName,
      risk,
      testsPassed,
      reason: testsPassed ? void 0 : "Tests failed \u2014 branch created but not committed"
    };
  } catch (err) {
    try {
      await git.checkout("main");
    } catch {
    }
    return {
      created: false,
      package: pkgName,
      risk,
      testsPassed: false,
      reason: `Error: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

// src/commands/deps/summary.ts
async function cmdDepsSummary() {
  const plan = await generateDepsPlan();
  logHeader(`# Dependency Steward Summary`);
  logDivider();
  logSub(`Generated: ${formatTimestampMarkdown(/* @__PURE__ */ new Date())}`);
  logDivider();
  logHeader(`## Critical / High Security Findings`);
  logDivider();
  const criticalHigh = [...plan.critical, ...plan.high];
  if (criticalHigh.length === 0) {
    logSub("None");
  } else {
    for (const f of criticalHigh) {
      logSub(`- **${f.package}** [${f.severity}]${f.direct ? " (direct)" : " (transitive)"} \u2014 ${f.title}`);
    }
  }
  logDivider();
  logHeader(`## Deprecated Packages`);
  logDivider();
  if (plan.deprecated.length === 0) {
    logSub("None");
  } else {
    for (const d of plan.deprecated) {
      logSub(`- **${d.package}@${d.version}**: ${d.deprecationMessage}`);
    }
  }
  logDivider();
  logHeader(`## Outdated Direct Dependencies`);
  logDivider();
  if (plan.outdated.length === 0) {
    logSub("None");
  } else {
    for (const o of plan.outdated) {
      const risk = o.isMajor ? "major" : "minor/patch";
      logSub(`- **${o.package}**: ${o.current} \u2192 ${o.latest} (${risk})`);
    }
  }
  logDivider();
  logHeader(`## Summary`);
  logDivider();
  logSub(`- Critical: ${plan.critical.length}`);
  logSub(`- High: ${plan.high.length}`);
  logSub(`- Medium: ${plan.medium.length}`);
  logSub(`- Low: ${plan.low.length}`);
  logSub(`- Deprecated: ${plan.deprecated.length}`);
  logSub(`- Outdated: ${plan.outdated.length}`);
  logDivider();
  logHeader(`## Recommended Next Action`);
  logDivider();
  if (plan.critical.length > 0) {
    logSub(`Remediate ${plan.critical.length} critical vulnerability(ies) immediately.`);
  } else if (plan.high.length > 0) {
    logSub(`Address ${plan.high.length} high severity vulnerability(ies).`);
  } else if (plan.deprecated.length > 0) {
    logSub(`Replace ${plan.deprecated.length} deprecated package(s).`);
  } else if (plan.outdated.length > 0) {
    logSub(`Update ${plan.outdated.length} outdated package(s).`);
  } else {
    logSub("All dependencies are healthy.");
  }
}

// src/core/cli-audit.ts
import { execSync as execSync2 } from "child_process";
import fs17 from "fs";
import path16 from "path";
var GLOBAL_AUDIT_FILE = "invocations.jsonl";
function getCurrentSessionId(repoRoot) {
  const actor = process.env.TASKFORGE_ACTOR;
  if (actor) return actor;
  try {
    const root = repoRoot ?? getRepoRoot();
    const branch = getCurrentBranchSync(root);
    if (branch) {
      return parseSessionIdFromBranch(branch);
    }
  } catch {
  }
  return null;
}
function getCurrentBranchSync(repoRoot) {
  try {
    return execSync2("git branch --show-current", { cwd: repoRoot, encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}
function extractTaskId(command, args) {
  const taskCommands = [
    "start",
    "done",
    "claim",
    "release",
    "heartbeat",
    "inspect",
    "block",
    "unlock",
    "checkpoint",
    "submit",
    "diff",
    "report",
    "prompt",
    "resume",
    "ac-check",
    "audit",
    "transcript",
    "timeline",
    "cleanup",
    "gates",
    "pr"
  ];
  if (taskCommands.includes(command) && args.length > 0) {
    const match = args[0].match(/^TASK-\d+$/i) || args[0].match(/^BUG-\d+$/i);
    if (match) return match[0].toUpperCase();
  }
  return null;
}
function recordCliInvocation(repoRoot, command, args, flags, exitCode, duration, error2) {
  const sessionId = getCurrentSessionId(repoRoot);
  const taskId = extractTaskId(command, args);
  const record = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    command,
    args,
    flags,
    exitCode,
    sessionId,
    taskId,
    duration,
    error: error2
  };
  const eventType = exitCode === 0 ? "task.command.completed" : "task.command.failed";
  const event = createTaskEvent(taskId ?? command, eventType, {
    sessionId: sessionId ?? void 0,
    summary: `CLI: taskforge ${command} ${args.join(" ")}`,
    metadata: {
      type: "cli.invocation",
      command,
      args,
      flags,
      exitCode,
      duration,
      error: error2,
      agentSession: sessionId
    }
  });
  if (taskId) {
    appendTaskTranscript(repoRoot, taskId, event);
  }
  const globalPath = path16.join(repoRoot, "logs", "taskforge", "audit", GLOBAL_AUDIT_FILE);
  const globalDir = path16.dirname(globalPath);
  fs17.mkdirSync(globalDir, { recursive: true });
  fs17.appendFileSync(globalPath, JSON.stringify(record) + "\n", "utf-8");
  appendAuditEvent(repoRoot, event);
}
function readTaskInvocations(repoRoot, taskId) {
  const transcriptPath = path16.join(repoRoot, "logs", "taskforge", "tasks", taskId, "transcript.jsonl");
  if (!fs17.existsSync(transcriptPath)) return [];
  const content = fs17.readFileSync(transcriptPath, "utf-8");
  const invocations = [];
  for (const line of content.trim().split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed.metadata?.type === "cli.invocation") {
        invocations.push({
          timestamp: parsed.timestamp,
          command: parsed.metadata.command,
          args: parsed.metadata.args ?? [],
          flags: parsed.metadata.flags ?? {},
          exitCode: parsed.metadata.exitCode ?? 0,
          sessionId: parsed.metadata.agentSession ?? null,
          taskId: parsed.taskId ?? null,
          duration: parsed.metadata.duration ?? 0,
          error: parsed.metadata.error ?? null
        });
      }
    } catch {
    }
  }
  return invocations;
}

// src/commands/audit.ts
function cmdAudit(taskId, opts) {
  const repoRoot = getRepoRoot();
  const events = readTaskAudit(repoRoot, taskId);
  if (opts.json) {
    writeResult(successResult({
      command: "audit",
      taskId,
      guidance: `Audit for ${taskId}: ${events.length} event(s).`
    }), opts.json);
    return;
  }
  logHeader(`Audit: ${taskId}`);
  if (events.length === 0) {
    logInfo("No audit events found.");
    return;
  }
  for (const event of events) {
    logSub(`${event.timestamp} [${event.event}]`);
    if (event.summary) logInfo(`  ${event.summary}`);
  }
}
function cmdTranscript(taskId, opts) {
  const repoRoot = getRepoRoot();
  const events = readTaskAudit(repoRoot, taskId);
  if (opts.json) {
    writeResult(successResult({
      command: "transcript",
      taskId,
      guidance: `Transcript for ${taskId}: ${events.length} event(s).`
    }), opts.json);
    return;
  }
  logHeader(`Transcript: ${taskId}`);
  if (events.length === 0) {
    logInfo("No transcript events found.");
    return;
  }
  for (const event of events) {
    const time = event.timestamp.slice(11, 19);
    const label = event.summary ?? event.event;
    logInfo(`[${time}] ${label}`);
  }
}
function getEventIcon(eventType) {
  if (eventType.includes("started") || eventType.includes("created")) return "\u25B6";
  if (eventType.includes("completed") || eventType.includes("released")) return "\u2714";
  if (eventType.includes("failed") || eventType.includes("error")) return "\u2718";
  return "\u2503";
}
function cmdTimeline(taskId, opts = {}) {
  const repoRoot = getRepoRoot();
  const summary = summarizeTaskAudit(repoRoot, taskId);
  const invocations = readTaskInvocations(repoRoot, taskId);
  const invocationEntries = invocations.map((inv) => ({
    timestamp: inv.timestamp,
    event: `cli.${inv.exitCode === 0 ? "completed" : "failed"}`,
    summary: `taskforge ${inv.command} ${inv.args.join(" ")}`,
    detail: inv.error ? `exit ${inv.exitCode}: ${inv.error}` : `exit ${inv.exitCode} (${inv.duration}ms)`
  }));
  const allEntries = [...summary.entries, ...invocationEntries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  if (opts.json) {
    writeResult(successResult({
      command: "timeline",
      taskId,
      guidance: `Timeline for ${taskId}: ${allEntries.length} events, ${invocations.length} CLI invocations.`
    }), opts.json);
    return;
  }
  logHeader(`Timeline: ${taskId}`);
  if (allEntries.length === 0) {
    logInfo("No events found.");
    return;
  }
  logDivider();
  for (const entry of allEntries) {
    const time = entry.timestamp.slice(11, 19);
    const icon = entry.event.startsWith("cli.") ? "\u26A1" : getEventIcon(entry.event);
    const detail = entry.detail ? `  ${entry.detail}` : "";
    logInfo(`${time}  ${icon} ${entry.event}${detail}`);
  }
  logDivider();
  logInfo(`Duration: ${summary.durationMinutes ?? 0}m  |  Events: ${summary.totalEvents}  |  CLI Invocations: ${invocations.length}  |  Errors: ${summary.errorCount}`);
}

// src/commands/ac-check.ts
function cmdAcCheck(taskId, options = {}) {
  const repoRoot = getRepoRoot();
  const issues = [];
  if (taskId) {
    const task = loadTaskById(taskId, repoRoot);
    if (!task) {
      if (options.json) {
        writeResult(failedResult({
          command: "ac-check",
          taskId,
          error: `Task ${taskId} not found`,
          code: "TASK_NOT_FOUND"
        }), options.json);
        return;
      }
      throw new Error(`Task ${taskId} not found`);
    }
    checkTaskAc(task, issues);
  } else {
    const tasks = loadAllTasks(repoRoot);
    for (const task of tasks) {
      checkTaskAc(task, issues);
    }
  }
  if (options.json) {
    writeResult(successResult({
      command: "ac-check",
      taskId,
      guidance: issues.length === 0 ? "All acceptance criteria look good." : `Found ${issues.length} acceptance criteria issue(s) in ${taskId ? 1 : loadAllTasks(repoRoot).length} task(s).`
    }), options.json);
    return;
  }
  if (issues.length === 0) {
    logSuccess("All acceptance criteria look good.");
    return;
  }
  logHeader(`# Acceptance Criteria Issues (${issues.length})`);
  logDivider();
  for (const issue of issues) {
    const icon = issue.type === "missing" ? "\u2717" : issue.type === "blank" ? "\u25CC" : issue.type === "unchecked" ? "\u2610" : "\u26A0";
    logError(`${icon} ${issue.taskId}: ${issue.message}`);
  }
  logDivider();
  logInfo(`Scanned ${taskId ? 1 : loadAllTasks(repoRoot).length} task(s), found ${issues.length} issue(s).`);
}
function checkTaskAc(task, issues) {
  if (!hasAcceptanceCriteriaSection(task.body)) {
    issues.push({ taskId: task.id, type: "missing", message: "Missing Acceptance Criteria section" });
    return;
  }
  if (hasDuplicateAcSections(task.body)) {
    issues.push({ taskId: task.id, type: "duplicate", message: "Duplicate Acceptance Criteria sections" });
  }
  if (hasBlankAcceptanceCriteria(task.body)) {
    issues.push({ taskId: task.id, type: "blank", message: "Has blank acceptance criteria items" });
  }
  if (hasUncheckedAcceptanceCriteria(task.body)) {
    issues.push({ taskId: task.id, type: "unchecked", message: "Has unchecked acceptance criteria items" });
  }
}
function hasDuplicateAcSections(body) {
  const matches = body.match(/## Acceptance Criteria/gi);
  return matches !== null && matches.length > 1;
}

// src/commands/promote.ts
var DEFAULT_FORWARD_PATH = {
  [STATUS.INBOX]: STATUS.NEEDS_SPEC,
  [STATUS.NEEDS_SPEC]: STATUS.READY,
  [STATUS.READY]: STATUS.IN_PROGRESS,
  [STATUS.IN_PROGRESS]: STATUS.IMPLEMENTATION_COMPLETE,
  [STATUS.IMPLEMENTATION_COMPLETE]: STATUS.SUBMITTED,
  [STATUS.SUBMITTED]: STATUS.REVIEW,
  [STATUS.REVIEW]: STATUS.MERGE_READY,
  [STATUS.MERGE_READY]: STATUS.VERIFY,
  [STATUS.VERIFY]: STATUS.DONE
};
function resolveTargetStatus(currentStatus, toFlag) {
  if (toFlag) {
    const normalized = normalizeStatus(toFlag);
    if (!ALL_STATUSES.includes(normalized)) {
      return { error: `Unknown status: "${toFlag}". Valid statuses: ${ALL_STATUSES.join(", ")}` };
    }
    return { target: normalized, isDefault: false };
  }
  const defaultNext = DEFAULT_FORWARD_PATH[currentStatus];
  if (!defaultNext) {
    const allowed = getAllowedTransitions(currentStatus);
    if (allowed.length === 0) {
      return { error: `Task is in terminal status "${currentStatus}" \u2014 no forward transitions available.` };
    }
    const forward = allowed.find(
      (s) => s !== STATUS.BLOCKED && s !== STATUS.DEFERRED && s !== STATUS.IN_PROGRESS
    );
    if (forward) {
      return { target: forward, isDefault: true };
    }
    return { error: `No forward transition available from "${currentStatus}". Allowed: ${allowed.join(", ")}` };
  }
  return { target: defaultNext, isDefault: true };
}
async function cmdPromote(taskId, options = {}) {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);
  if (!task) {
    if (options.json) {
      writeResult(failedResult({ command: "promote", taskId, error: `Task ${taskId} not found`, code: "TASK_NOT_FOUND" }), options.json);
      return;
    }
    throw new TaskNotFoundError(taskId);
  }
  const resolved = resolveTargetStatus(task.status, options.to);
  if ("error" in resolved) {
    if (options.json) {
      writeResult(failedResult({ command: "promote", taskId, error: resolved.error, code: "INVALID_STATUS" }), options.json);
      return;
    }
    logError(resolved.error);
    return;
  }
  const { target: targetStatus, isDefault } = resolved;
  const transitionError = validateTransition(task.status, targetStatus);
  if (transitionError) {
    const allowed = getAllowedTransitions(task.status);
    if (options.json) {
      const nextCommands = allowed.map((s) => ({
        command: `taskforge promote ${taskId} --to "${s}"`,
        purpose: `Advance task to "${s}"`,
        when: "after invalid transition attempt",
        allowedFor: "all",
        priority: 1
      }));
      writeResult(failedResult({
        command: "promote",
        taskId,
        error: transitionError,
        code: "INVALID_TRANSITION",
        nextCommands
      }), options.json);
      return;
    }
    logError(transitionError);
    logSub(`Allowed transitions from "${task.status}": ${allowed.join(", ")}`);
    return;
  }
  const current = parseTaskFile(task.filePath);
  if (!current) {
    throw new TaskNotFoundError(taskId);
  }
  const fromStatus = current.status;
  current.status = targetStatus;
  writeTaskFile(current);
  await commitAndPushTaskState(repoRoot, `chore: promote ${taskId} \u2014 ${fromStatus} \u2192 ${targetStatus}`);
  const nextAllowed = getAllowedTransitions(targetStatus);
  const guidance = isDefault ? `Task ${taskId} promoted from "${fromStatus}" to "${targetStatus}".` : `Task ${taskId} promoted from "${fromStatus}" to "${targetStatus}".`;
  if (options.json) {
    writeResult(successResult({
      command: "promote",
      taskId,
      guidance,
      nextCommands: nextAllowed.length > 0 ? [
        {
          command: `taskforge promote ${taskId}`,
          purpose: `Advance to next status from "${targetStatus}"`,
          when: "after promotion",
          allowedFor: "all",
          priority: 1
        },
        {
          command: `taskforge promote ${taskId} --to "${nextAllowed[0]}"`,
          purpose: `Advance to "${nextAllowed[0]}"`,
          when: "after promotion",
          allowedFor: "all",
          priority: 2
        }
      ] : []
    }), options.json);
    return;
  }
  logSuccess(`Task ${taskId} promoted`);
  logSub(`  From: "${fromStatus}"`);
  logSub(`  To:   "${targetStatus}"`);
  if (nextAllowed.length > 0) {
    logDivider();
    logSub("Next allowed transitions:");
    for (const s of nextAllowed) {
      logSub(`  taskforge promote ${taskId} --to "${s}"`);
    }
  }
}

// src/commands/git-facade.ts
function requireTask(taskId) {
  const task = loadTaskById(taskId);
  if (!task) throw new TaskNotFoundError(taskId);
  return task;
}
async function cmdDiff(taskId, json = false) {
  const repoRoot = getRepoRoot();
  const task = requireTask(taskId);
  if (!task.worktree) {
    throw new Error(`No worktree found for ${taskId}. Run 'taskforge start ${taskId}' first.`);
  }
  try {
    await assertTaskOwnership(task, task.worktree);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeResult(failedResult({
      command: "diff",
      taskId,
      error: message,
      code: "OWNERSHIP_MISMATCH",
      nextCommands: [
        { command: `taskforge resume ${taskId}`, purpose: "Enter the owning task workspace", when: "Before reviewing the diff", allowedFor: "all", priority: 1 },
        { command: `taskforge inspect ${taskId} --json`, purpose: "Inspect task ownership and workspace state", when: "If ownership is unclear", allowedFor: "all", priority: 2 }
      ]
    }), json);
    return;
  }
  logHeader(`Diff: ${taskId}`);
  const result = await run("git", ["-C", task.worktree, "diff"], repoRoot);
  process.stdout.write(result.stdout);
  writeResult(successResult({
    command: "diff",
    taskId,
    guidance: `Diff shown for ${taskId}.`
  }), json);
}
async function cmdCheckpoint(taskId, message, json = false) {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);
  if (!task) {
    const result2 = checkpointStateMachine({
      hasChanges: false,
      commitSucceeded: false,
      inWorktree: false,
      taskId
    });
    getDefaultGuidanceAdapter().pushGuidance(result2);
    logError(result2.guidance);
    throw new TaskNotFoundError(taskId);
  }
  if (!task.worktree) {
    const result2 = checkpointStateMachine({
      hasChanges: false,
      commitSucceeded: false,
      inWorktree: false,
      taskId
    });
    getDefaultGuidanceAdapter().pushGuidance(result2);
    logError(result2.guidance);
    throw new Error(result2.guidance);
  }
  try {
    assertTaskOwnership(task, repoRoot);
  } catch {
    const result2 = checkpointStateMachine({
      hasChanges: false,
      commitSucceeded: false,
      inWorktree: true,
      taskId,
      errorMessage: "Ownership verification failed"
    });
    getDefaultGuidanceAdapter().pushGuidance(result2);
    throw new Error(result2.guidance);
  }
  const branchResult = await run("git", ["-C", task.worktree, "rev-parse", "--abbrev-ref", "HEAD"], repoRoot);
  const branch = branchResult.stdout.trim();
  if (branch === "main" || branch === "task-state") {
    const result2 = checkpointStateMachine({
      hasChanges: false,
      commitSucceeded: false,
      inWorktree: true,
      taskId,
      errorMessage: `Refusing to checkpoint on ${branch} branch`
    });
    getDefaultGuidanceAdapter().pushGuidance(result2);
    throw new Error(result2.guidance);
  }
  const statusResult = await run("git", ["-C", task.worktree, "status", "--porcelain"], repoRoot);
  const hasChanges = statusResult.stdout.trim().length > 0;
  if (!hasChanges) {
    const result2 = checkpointStateMachine({
      hasChanges: false,
      commitSucceeded: false,
      inWorktree: true,
      taskId
    });
    getDefaultGuidanceAdapter().pushGuidance(result2);
    logInfo(result2.guidance);
    writeResult(noopResult({
      command: "checkpoint",
      taskId,
      guidance: result2.guidance
    }), json);
    return;
  }
  const fullMessage = [
    message,
    "",
    `Task: ${taskId}`,
    `TaskForge-Managed: true`
  ].join("\n");
  let commitSucceeded = false;
  try {
    await run("git", ["-C", task.worktree, "add", "."], repoRoot);
    await run("git", ["-C", task.worktree, "commit", "-m", fullMessage], repoRoot);
    commitSucceeded = true;
  } catch (err) {
    const result2 = checkpointStateMachine({
      hasChanges: true,
      commitSucceeded: false,
      inWorktree: true,
      taskId,
      errorMessage: err instanceof Error ? err.message : String(err)
    });
    getDefaultGuidanceAdapter().pushGuidance(result2);
    logError(result2.guidance);
    throw new Error(result2.guidance);
  }
  const result = checkpointStateMachine({
    hasChanges: true,
    commitSucceeded,
    inWorktree: true,
    taskId
  });
  getDefaultGuidanceAdapter().pushGuidance(result);
  logSuccess(result.guidance);
  writeResult(successResult({
    command: "checkpoint",
    taskId,
    guidance: result.guidance
  }), json);
  appendTaskTranscript(repoRoot, taskId, createTaskEvent(taskId, "git.commit", {
    summary: message
  }));
}
async function cmdSubmit(taskId, json = false) {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);
  if (!task) {
    const result2 = submitStateMachine({
      prCreated: false,
      githubConfigured: false,
      taskId
    });
    getDefaultGuidanceAdapter().pushGuidance(result2);
    logError(result2.guidance);
    throw new TaskNotFoundError(taskId);
  }
  if (!task.branch) {
    const result2 = submitStateMachine({
      prCreated: false,
      githubConfigured: false,
      taskId,
      errorMessage: "No branch recorded"
    });
    getDefaultGuidanceAdapter().pushGuidance(result2);
    logError(result2.guidance);
    throw new Error(result2.guidance);
  }
  if (task.branch === "main" || task.branch === "task-state") {
    const result2 = submitStateMachine({
      prCreated: false,
      githubConfigured: false,
      taskId,
      errorMessage: `Refusing to push ${task.branch}`
    });
    getDefaultGuidanceAdapter().pushGuidance(result2);
    logError(result2.guidance);
    throw new Error(result2.guidance);
  }
  if (!task.worktree) {
    const result2 = submitStateMachine({
      prCreated: false,
      githubConfigured: false,
      taskId,
      errorMessage: "No worktree found"
    });
    getDefaultGuidanceAdapter().pushGuidance(result2);
    logError(result2.guidance);
    throw new Error(result2.guidance);
  }
  const config = loadConfig(repoRoot);
  const githubConfigured = !!(config.github?.enabled && config.github.owner && config.github.repo);
  try {
    await run("git", ["-C", task.worktree, "push", "origin", task.branch], repoRoot);
  } catch (err) {
    const result2 = submitStateMachine({
      prCreated: false,
      githubConfigured,
      taskId,
      errorMessage: err instanceof Error ? err.message : String(err)
    });
    getDefaultGuidanceAdapter().pushGuidance(result2);
    logError(result2.guidance);
    throw new Error(result2.guidance);
  }
  const result = submitStateMachine({
    prCreated: true,
    githubConfigured,
    taskId
  });
  getDefaultGuidanceAdapter().pushGuidance(result);
  logSuccess(result.guidance);
  writeResult(successResult({
    command: "submit",
    taskId,
    guidance: result.guidance
  }), json);
  appendTaskTranscript(repoRoot, taskId, createTaskEvent(taskId, "git.push", {
    summary: `Pushed branch ${task.branch}`
  }));
}
async function cmdPr(taskId, json = false) {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);
  const config = loadConfig(repoRoot);
  if (!task) {
    const result = submitStateMachine({
      prCreated: false,
      githubConfigured: false,
      taskId
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    logError(result.guidance);
    throw new TaskNotFoundError(taskId);
  }
  if (!task.branch) {
    const result = submitStateMachine({
      prCreated: false,
      githubConfigured: false,
      taskId,
      errorMessage: "No branch recorded"
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    logError(result.guidance);
    throw new Error(result.guidance);
  }
  const title = `[${taskId}] ${taskId}`;
  const body = `Task: ${taskId}

Auto-generated by TaskForge.`;
  if (config.github?.enabled && config.github.owner && config.github.repo) {
    logInfo(`Creating PR for ${taskId} from branch ${task.branch} via GitHub API...`);
    try {
      const githubConfig = {
        owner: config.github.owner,
        repo: config.github.repo,
        token: process.env.GITHUB_TOKEN
      };
      const pr = await createPullRequest(githubConfig, title, task.branch, "main", body);
      const result = submitStateMachine({
        prCreated: true,
        prNumber: pr.number,
        prUrl: pr.url,
        githubConfigured: true,
        taskId
      });
      getDefaultGuidanceAdapter().pushGuidance(result);
      logSuccess(result.guidance);
      writeResult(successResult({
        command: "pr",
        taskId,
        guidance: result.guidance
      }), json);
      appendTaskTranscript(repoRoot, taskId, createTaskEvent(taskId, "github.pr.created", {
        summary: `Created PR #${pr.number}`,
        metadata: { prNumber: pr.number, prUrl: pr.url }
      }));
    } catch (error2) {
      const message = error2 instanceof Error ? error2.message : String(error2);
      const result = submitStateMachine({
        prCreated: false,
        githubConfigured: true,
        taskId,
        errorMessage: message
      });
      getDefaultGuidanceAdapter().pushGuidance(result);
      logWarn(result.guidance);
      appendTaskTranscript(repoRoot, taskId, createTaskEvent(taskId, "github.pr.failed", {
        summary: `PR creation failed: ${message}`
      }));
      throw error2;
    }
  } else {
    const result = submitStateMachine({
      prCreated: false,
      githubConfigured: false,
      taskId
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    logWarn(result.guidance);
    logInfo(`To create a PR manually:`);
    logInfo(`  gh pr create --title "${title}" --head ${task.branch} --base main --body "${body}"`);
    logInfo(`  Or visit: https://github.com/<owner>/<repo>/compare/main...${task.branch}`);
    writeResult(successResult({
      command: "pr",
      taskId,
      guidance: result.guidance
    }), json);
    appendTaskTranscript(repoRoot, taskId, createTaskEvent(taskId, "github.pr.manual", {
      summary: "Manual PR creation required - GitHub not configured"
    }));
  }
}

// src/commands/guard-cmd.ts
async function cmdGuardStatus(opts = {}) {
  const managed = isManagedSession();
  const envVar = process.env.TASK_FORGE_ACTIVE;
  const warningsList = [];
  if (!managed) {
    warningsList.push(
      'TASK_FORGE_ACTIVE is not set to "true". The mutation boundary is inactive.'
    );
    warningsList.push(
      "To enable: ensure TASK_FORGE_ACTIVE=true is set in the agent environment."
    );
    warningsList.push(
      "For OpenCode: add it to agent.implementer.env in opencode.json."
    );
    if (process.env.TASKFORGE_ACTOR !== "doctor") {
      warningsList.push(
        "The guard plugin is installed but has no effect until TASK_FORGE_ACTIVE is set."
      );
    }
  }
  const status = {
    managed,
    envVar,
    doctorOverrideAvailable: true,
    deniedCommandCount: DENIED_GIT_COMMANDS.length,
    readOnlyCommandCount: READ_ONLY_GIT_COMMANDS.length,
    doctorOverrideExists: false
  };
  if (opts.json) {
    const diagnostics = [];
    diagnostics.push({ level: "info", message: `Denied commands (${DENIED_GIT_COMMANDS.length}): ${DENIED_GIT_COMMANDS.join(", ")}` });
    diagnostics.push({ level: "info", message: `Read-only commands (${READ_ONLY_GIT_COMMANDS.length}): ${READ_ONLY_GIT_COMMANDS.join(", ")}` });
    for (const w of warningsList) {
      diagnostics.push({ level: "info", message: `\u26A0 ${w}` });
    }
    const result = successResult({
      command: "guard:status",
      guidance: `Mutation guard: ${status.managed ? "active" : "inactive"}`
    });
    result.diagnostics = diagnostics;
    writeResult(result, opts.json);
    return;
  }
  logHeader("Mutation Boundary Status");
  logDivider();
  if (!managed) {
    logInfo("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
    logInfo("\u2551  \u26A0  MUTATION BOUNDARY IS INACTIVE                         \u2551");
    logInfo("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
    for (const w of warningsList) {
      logInfo(`\u2551  ${w.padEnd(57)}\u2551`);
    }
    logInfo("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
    logDivider();
  }
  logSub(`Managed session: ${managed ? "YES (TASK_FORCE_ACTIVE=true)" : "NO (TASK_FORCE_ACTIVE not set)"}`);
  logSub(`Denied commands: ${DENIED_GIT_COMMANDS.length}`);
  logSub(`Read-only commands: ${READ_ONLY_GIT_COMMANDS.length}`);
  logSub(`Doctor override: available`);
  logDivider();
  logInfo("Denied mutations:");
  for (const cmd of DENIED_GIT_COMMANDS) {
    logSub(`  git ${cmd}`);
  }
  logInfo("Allowed read-only commands:");
  for (const cmd of READ_ONLY_GIT_COMMANDS) {
    logSub(`  git ${cmd}`);
  }
}
async function cmdGuardOverride(taskId, command, reason, opts = {}) {
  const task = loadTaskById(taskId);
  if (!task) throw new TaskNotFoundError(taskId);
  const actor = process.env.TASKFORCE_ACTOR;
  if (actor !== "doctor") {
    const msg = "Only doctor agents may issue mutation overrides. Set TASKFORCE_ACTOR=doctor.";
    if (opts.json) {
      writeResult(failedResult({ command: "guard:override", taskId, error: msg, code: "UNAUTHORIZED" }), opts.json);
      return;
    }
    throw new Error(msg);
  }
  const result = checkMutationAllowed(command);
  if (result.allowed) {
    const msg = `Command "${command}" is not denied \u2014 no override needed.`;
    if (opts.json) {
      writeResult(successResult({ command: "guard:override", taskId, guidance: `Command "${command}" is not denied \u2014 no override needed.` }), opts.json);
      return;
    }
    logInfo(msg);
    return;
  }
  const repoRoot = getRepoRoot();
  let beforeSha = "";
  try {
    const r = await run("git", ["rev-parse", "HEAD"], repoRoot);
    beforeSha = r.stdout.trim();
  } catch {
  }
  const override = {
    reason,
    identity: "doctor",
    taskId,
    command,
    affectedRepo: repoRoot,
    beforeSha: beforeSha || void 0,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  recordOverride(override);
  if (opts.json) {
    writeResult(successResult({ command: "guard:override", taskId, guidance: `Override issued for command "${command}" (task ${taskId}). Valid for 5 minutes.` }), opts.json);
    return;
  }
  logSuccess(`Override issued for command "${command}" (task ${taskId}).`);
  logSub(`Reason: ${reason}`);
  logSub(`Valid for 5 minutes. Audit recorded at .override-audit.jsonl`);
}

// src/commands/mcp.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z as z3 } from "zod";
import { Writable } from "stream";
async function captureStdout(fn) {
  const chunks = [];
  const originalDescriptor = Object.getOwnPropertyDescriptor(process, "stdout");
  const capture = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk);
      callback();
    }
  });
  Object.defineProperty(process, "stdout", {
    value: capture,
    writable: true,
    configurable: true,
    enumerable: true
  });
  try {
    await fn();
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(process, "stdout", originalDescriptor);
    }
  }
  return Buffer.concat(chunks).toString("utf-8");
}
async function cmdMcp(opts) {
  loadConfig(opts.config ?? getRepoRoot());
  const repoRoot = getRepoRoot();
  const server = new McpServer(
    {
      name: "taskforge",
      version: "0.3.0"
    },
    {
      capabilities: {
        tools: {}
      },
      instructions: `TaskForge MCP server for repository: ${repoRoot}`
    }
  );
  registerTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
function registerTools(server) {
  server.tool(
    "taskforge_status",
    "Show the current status summary of all tasks in the project",
    {
      json: z3.boolean().optional().default(false)
    },
    async (args) => {
      try {
        const output = await captureStdout(() => cmdStatus(args.json ?? false));
        return { content: [{ type: "text", text: output.trim() }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true
        };
      }
    }
  );
  server.tool(
    "taskforge_next",
    "Return the highest-priority safe task to work on next",
    {
      json: z3.boolean().optional().default(false)
    },
    async (args) => {
      try {
        const output = await captureStdout(() => cmdNext({ json: args.json ?? false }));
        return { content: [{ type: "text", text: output.trim() }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true
        };
      }
    }
  );
  server.tool(
    "taskforge_start",
    "Create a worktree and branch for a task and begin working on it",
    {
      taskId: z3.string(),
      force: z3.boolean().optional().default(false),
      json: z3.boolean().optional().default(false)
    },
    async (args) => {
      try {
        const opts = { force: args.force ?? false, json: args.json ?? false };
        const output = await captureStdout(() => cmdStart(args.taskId, opts));
        return { content: [{ type: "text", text: output.trim() }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true
        };
      }
    }
  );
  server.tool(
    "taskforge_done",
    "Mark a task as completed and optionally clean up its worktree",
    {
      taskId: z3.string(),
      cleanup: z3.boolean().optional().default(false),
      deleteBranch: z3.boolean().optional().default(false),
      json: z3.boolean().optional().default(false)
    },
    async (args) => {
      try {
        const opts = {
          cleanup: args.cleanup ?? false,
          deleteBranch: args.deleteBranch ?? false,
          json: args.json ?? false
        };
        const output = await captureStdout(() => cmdDone(args.taskId, opts));
        return { content: [{ type: "text", text: output.trim() }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true
        };
      }
    }
  );
  server.tool(
    "taskforge_checkpoint",
    "Create a commit on the current task branch with the given message",
    {
      taskId: z3.string(),
      message: z3.string()
    },
    async (args) => {
      try {
        const output = await captureStdout(() => cmdCheckpoint(args.taskId, args.message));
        return { content: [{ type: "text", text: output.trim() || `Checkpoint created for ${args.taskId}.` }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true
        };
      }
    }
  );
  server.tool(
    "taskforge_gates",
    "Run all configured verification gates (typecheck, lint, build, test)",
    {
      json: z3.boolean().optional().default(false)
    },
    async (args) => {
      try {
        const success2 = await cmdGates({ json: args.json ?? false });
        return { content: [{ type: "text", text: success2 ? "All gates passed." : "Some gates failed." }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true
        };
      }
    }
  );
}

// src/cli.ts
var program = new Command();
program.name("taskforge").description("TaskForge Autonomous Coding Board CLI").version("0.3.0");
program.command("init").description("Initialize TaskForge in this repository").option("--force", "Recreate missing configuration files and templates").option("--agent-framework <id>", "Agent framework: opencode, generic, auto, or none").option("--policy <level>", "Policy: permissive, managed, or locked-down").option("--install-hooks", "Install git hooks").option("--no-install-hooks", "Skip git hooks").option("--audit", "Enable audit plugin").option("--no-audit", "Disable audit plugin").option("--guard", "Enable guard plugin").option("--no-guard", "Disable guard plugin").option("--dry-run", "Show planned changes without writing").option("--repair", "Repair missing or stale generated files").action((opts) => {
  wrapWithAudit(
    "init",
    [],
    opts,
    () => cmdInit({
      force: opts.force,
      agentFramework: opts.agentFramework,
      policy: opts.policy,
      installHooks: opts.installHooks,
      audit: opts.audit,
      guard: opts.guard,
      dryRun: opts.dryRun,
      repair: opts.repair
    })
  )();
});
program.command("next").description("Return the highest-priority safe task to continue").option("--json", "Output in JSON format").action((opts) => wrapWithAudit("next", [], opts, () => cmdNext(opts))());
program.command("start <taskId>").description("Set up worktree, branch, and begin a task").option("--force", "Override stale lock if task is locked by another session").option("--json", "Output in JSON format").action((taskId, opts) => {
  const startOpts = { force: opts.force ?? false, json: opts.json ?? false };
  return wrapWithAudit("start", [taskId], opts, () => cmdStart(taskId, startOpts))();
});
program.command("status").description("Show project status summary").option("--json", "Output in JSON format for programmatic consumption").action((opts) => wrapWithAudit("status", [], opts, () => cmdStatus(opts.json ?? false))());
program.command("summary").description("Show full project summary with recommended next action").option("--json", "Output in JSON format for programmatic consumption").action((opts) => wrapWithAudit("summary", [], opts, () => cmdSummary(opts.json ?? false))());
program.command("gates").description("Run configured verification gates").option("--json", "Output results in JSON format").option("--only <names>", "Run only specific gates (comma-separated)").action((opts) => {
  const gateOpts = {
    json: opts.json ?? false,
    only: opts.only
  };
  return wrapWithAudit("gates", [], opts, () => cmdGates(gateOpts))();
});
program.command("block <taskId> <reason>").description("Mark a task as blocked with a reason").option("--category <cat>", "Blocker category: human_decision, test_failure, merge_conflict, missing_secret, unsafe_operation, ambiguous_spec").option("--blocked-by <who>", "Who/what is blocking: human, agent, bot").option("--json", "Output in JSON format").action((taskId, reason, opts) => {
  return wrapWithAudit("block", [taskId, reason], opts, () => cmdBlock(taskId, reason, {
    json: opts.json ?? false,
    category: opts.category,
    blockedBy: opts.blockedBy
  }))();
});
program.command("done <taskId>").description("Mark a task as done").option("--cleanup", "Remove worktree after marking done").option("--delete-branch", "Delete the task branch after marking done (implies --cleanup)").option("--json", "Output in JSON format").action((taskId, opts) => {
  const doneOpts = {
    cleanup: opts.cleanup ?? false,
    deleteBranch: opts.deleteBranch ?? false,
    json: opts.json ?? false
  };
  if (doneOpts.deleteBranch && !doneOpts.cleanup) doneOpts.cleanup = true;
  return wrapWithAudit("done", [taskId], opts, () => cmdDone(taskId, doneOpts))();
});
program.command("sync").description("Sync with external issue tracker").action(wrapWithAudit("sync", [], {}, cmdSync));
program.command("list").description("List and filter tasks").option("--status <status>", "Filter by status (e.g., Ready, In Progress, Done)").option("--priority <priority>", "Filter by priority (P0, P1, P2, P3)").option("--type <type>", "Filter by task type (Task, Bug, Feature, etc.)").option("--search <query>", "Filter by text search in ID or body").option("--json", "Output results as JSON").action((opts) => {
  const listOpts = {
    status: opts.status,
    priority: opts.priority,
    type: opts.type,
    search: opts.search,
    json: opts.json ?? false
  };
  return wrapWithAudit("list", [], opts, () => cmdList(listOpts))();
});
program.command("promote <taskId>").description("Advance a task through the status state machine").option("--to <status>", "Target status to promote to").option("--json", "Output in JSON format").action((taskId, opts) => {
  const promoteOpts = { to: opts.to, json: opts.json ?? false };
  return wrapWithAudit("promote", [taskId], opts, () => cmdPromote(taskId, promoteOpts))();
});
program.command("unlock <taskId>").description("Manually unlock a task (requires --force)").option("--force", "Force unlock the task").option("--json", "Output in JSON format").action((taskId, opts) => {
  const unlockOpts = { force: opts.force ?? false, json: opts.json ?? false };
  return wrapWithAudit("unlock", [taskId], opts, () => cmdUnlock(taskId, unlockOpts))();
});
program.command("sweep").description("Sweeper Protocol: recover stale in-progress tasks (claimed >4h)").option("--json", "Output in JSON format").option("--dry-run", "Preview what would happen without mutating state").option("--force", "Skip worktree classification, reset all stale tasks").action((opts) => wrapWithAudit("sweep", [], opts, () => cmdSweep({ json: opts.json, dryRun: opts.dryRun, force: opts.force }))());
program.command("heartbeat <taskId>").description("Extend the lease on an In Progress task by updating claimed_at").option("--force", "Skip ownership verification").option("--json", "Output in JSON format").action((taskId, opts) => {
  const hbOpts = { force: opts.force ?? false, json: opts.json ?? false };
  return wrapWithAudit("heartbeat", [taskId], opts, () => cmdHeartbeat(taskId, hbOpts))();
});
program.command("agents").description("List active agents in the distributed registry").option("--json", "Output in JSON format").option("--stale", "Show only stale agents (no heartbeat within threshold)").option("--recover", "Mark stale agents as crashed").option("--threshold <minutes>", "Stale threshold in minutes", "15").action((opts) => {
  const agentsOpts = {
    json: opts.json ?? false,
    stale: opts.stale ?? false,
    recover: opts.recover ?? false,
    threshold: parseInt(opts.threshold ?? "15", 10)
  };
  return wrapWithAudit("agents", [], opts, () => cmdAgents(agentsOpts))();
});
program.command("inspect <taskId>").description("Inspect task worktree and branch state").option("--all", "Inspect all In Progress tasks").option("--json", "Output in JSON format").action((taskId, opts) => {
  const inspectOpts = { all: opts.all ?? false, json: opts.json ?? false };
  return wrapWithAudit("inspect", [taskId], opts, () => cmdInspect(taskId, inspectOpts))();
});
program.command("claim <taskId>").description("Claim a task (set assignee and claimed_at) without creating a worktree").option("--force", "Override an existing claim").option("--session <id>", "Use a specific session ID instead of generating one").option("--json", "Output in JSON format").action((taskId, opts) => {
  const claimOpts = {
    force: opts.force ?? false,
    session: opts.session,
    json: opts.json ?? false
  };
  return wrapWithAudit("claim", [taskId], opts, () => cmdClaim(taskId, claimOpts))();
});
program.command("report <taskId>").description("Generate a structured completion report").option("--complete", "Transition task to Review after generating report").option("--json", "Output in JSON format").action((taskId, opts) => {
  const reportOpts = { complete: opts.complete ?? false, json: opts.json ?? false };
  return wrapWithAudit("report", [taskId], opts, () => cmdReport(taskId, reportOpts))();
});
program.command("cleanup <taskId>").description("Remove task worktree and branch with safety checks").option("--dry-run", "Preview what would be removed without mutating").option("--apply", "Execute cleanup (fails if unsafe)").option("--force", "Skip all safety checks").option("--json", "Output in JSON format").action((taskId, opts) => {
  const cleanupOpts = {
    dryRun: opts.dryRun ?? false,
    apply: opts.apply ?? false,
    force: opts.force ?? false,
    json: opts.json ?? false
  };
  return wrapWithAudit("cleanup", [taskId], opts, () => cmdCleanup(taskId, cleanupOpts))();
});
program.command("new <title>").description("Create a new task file with auto-incremented ID").option("--type <type>", "Task type (Task, Feature, Bug, etc.)", "Task").option("--priority <p>", "Priority (P0-P3)", "P2").option("--agent-role <role>", "Agent role", "Implementer").option("--status <status>", "Initial status (Ready, Inbox, etc.)", "Ready").option("--body <text>", "Additional body text").option("--json", "Output in JSON format").action((title, opts) => {
  const newOpts = {
    type: opts.type,
    priority: opts.priority,
    agentRole: opts.agentRole,
    status: opts.status,
    body: opts.body,
    json: opts.json ?? false
  };
  return wrapWithAudit("new", [title], opts, () => cmdNew(title, newOpts))();
});
var deps = program.command("deps").description("Dependency health management");
deps.command("scan").description("Run broad dependency health checks").action(wrapWithAudit("deps scan", [], {}, cmdDepsScan));
deps.command("audit").description("Run package-manager-native audit").option("--severity <level>", "Filter by severity level (critical, high, medium, low, info)").option("--create-tasks", "Automatically create tasks for found vulnerabilities").action((opts) => wrapWithAudit("deps audit", [], opts, () => cmdDepsAudit(opts.severity, opts.createTasks ?? false))());
deps.command("outdated").description("Report outdated direct dependencies").action(wrapWithAudit("deps outdated", [], {}, cmdDepsOutdated));
deps.command("deprecated").description("Check for deprecated packages").action(wrapWithAudit("deps deprecated", [], {}, cmdDepsDeprecated));
deps.command("plan").description("Produce a dependency remediation plan").action(wrapWithAudit("deps plan", [], {}, cmdDepsPlan));
deps.command("create-tasks").description("Create TaskForge dependency tasks from findings").action(wrapWithAudit("deps create-tasks", [], {}, cmdDepsCreateTasks));
deps.command("pr").description("Create focused dependency update PRs for low-risk cases").action(wrapWithAudit("deps pr", [], {}, cmdDepsPr));
deps.command("summary").description("Produce a dependency health summary").action(wrapWithAudit("deps summary", [], {}, cmdDepsSummary));
function wrapWithAudit(commandName, args, flags, fn) {
  return async () => {
    const startTime = Date.now();
    let exitCode = 0;
    let error2 = null;
    try {
      await fn();
    } catch (err) {
      if (err instanceof TaskForgeError) {
        exitCode = err.exitCode;
        error2 = err.message;
        logError(err.message);
      } else {
        exitCode = 1;
        error2 = err instanceof Error ? err.message : String(err);
        logError(`Unexpected error: ${error2}`);
      }
      try {
        const repoRoot = getRepoRoot();
        recordCliInvocation(repoRoot, commandName, args, flags, exitCode, Date.now() - startTime, error2);
      } catch {
      }
      process.exit(exitCode);
    }
    try {
      const repoRoot = getRepoRoot();
      recordCliInvocation(repoRoot, commandName, args, flags, 0, Date.now() - startTime, null);
    } catch {
    }
  };
}
program.command("prompt <taskId>").description("Emit a complete agent execution packet").option("--json", "Output in JSON format").action((taskId, opts) => wrapWithAudit("prompt", [taskId], opts, () => cmdPrompt(taskId, opts))());
program.command("resume <taskId>").description("Re-enter an existing task workspace").option("--json", "Output in JSON format").action((taskId, opts) => wrapWithAudit("resume", [taskId], opts, () => cmdResume(taskId, opts))());
program.command("doctor").description("Run diagnostic checks on repo and task-state health").option("--check", "Run diagnostics only (alias for default behavior)").option("--fix", "Apply doctor-mode automatic repairs").option("--lock", "Acquire doctor lock for recovery").option("--reason <text>", "Reason for doctor lock").option("--ttl-hours <hours>", "Doctor lock TTL in hours", (value) => Number(value)).option("--json", "Output in JSON format").action((opts) => wrapWithAudit("doctor", [], opts, () => cmdDoctor(opts))());
program.command("config-validate").description("Validate .taskforge/config.json").option("--json", "Output in JSON format").action((opts) => wrapWithAudit("config-validate", [], opts, () => cmdConfigValidate(opts))());
program.command("release <taskId>").description("Voluntarily release a task claim and reset to Ready").option("--json", "Output in JSON format").action((taskId, opts) => {
  const releaseOpts = { json: opts.json ?? false };
  return wrapWithAudit("release", [taskId], opts, () => cmdRelease(taskId, releaseOpts))();
});
program.command("reject <taskId> <reason>").description("Mark a task as rejected (obsolete, won't implement)").option("--json", "Output in JSON format").action((taskId, reason, opts) => wrapWithAudit("reject", [taskId, reason], opts, () => cmdReject(taskId, reason, opts))());
program.command("validate-state").description("Validate task-state for invariant violations").option("--json", "Output in JSON format").option("--strict", "Exit with non-zero status on any warnings or errors (for CI)").action(
  (opts) => wrapWithAudit("validate-state", [], opts, async () => {
    const { cmdValidateState } = await import("./validate-state-VIDX5TG5.js");
    await cmdValidateState(opts);
  })()
);
program.command("audit <taskId>").description("Show audit events for a task").option("--json", "Output in JSON format").action(
  (taskId, opts) => wrapWithAudit("audit", [taskId], opts, async () => {
    cmdAudit(taskId, opts);
  })()
);
program.command("transcript <taskId>").description("Show readable transcript for a task").option("--json", "Output in JSON format").action(
  (taskId, opts) => wrapWithAudit("transcript", [taskId], opts, async () => {
    cmdTranscript(taskId, opts);
  })()
);
program.command("timeline <taskId>").description("Show event timeline summary for a task").option("--json", "Output in JSON format").action(
  (taskId, opts) => wrapWithAudit("timeline", [taskId], opts, async () => {
    cmdTimeline(taskId, opts);
  })()
);
program.command("ac-check [taskId]").description("Scan task files for acceptance criteria issues").option("--json", "Output in JSON format").action(
  (taskId, opts) => wrapWithAudit("ac-check", taskId ? [taskId] : [], opts, async () => {
    cmdAcCheck(taskId, opts);
  })()
);
program.command("diff <taskId>").description("Show current worktree diff for a task").action(
  (taskId) => wrapWithAudit("diff", [taskId], {}, async () => {
    await cmdDiff(taskId);
  })()
);
program.command("checkpoint <taskId>").description("Create a commit on the task branch").requiredOption("-m, --message <text>", "Commit message").action(
  (taskId, opts) => wrapWithAudit("checkpoint", [taskId], opts, async () => {
    await cmdCheckpoint(taskId, opts.message);
  })()
);
program.command("submit <taskId>").description("Push the task branch").action(
  (taskId) => wrapWithAudit("submit", [taskId], {}, async () => {
    await cmdSubmit(taskId);
  })()
);
program.command("pr <taskId>").description("Create a PR for the task").action(
  (taskId) => wrapWithAudit("pr", [taskId], {}, async () => {
    await cmdPr(taskId);
  })()
);
program.command("mcp").description("Start a Model Context Protocol (MCP) server for TaskForge").option("--config <path>", "Path to config directory").option("--json", "Output in JSON format").action(
  (opts) => wrapWithAudit("mcp", [], opts, async () => {
    await cmdMcp({ config: opts.config, json: opts.json });
  })()
);
var guard = program.command("guard").description("Manage the mutation boundary");
guard.command("status").description("Show mutation boundary enforcement status").option("--json", "Output in JSON format").action(
  (opts) => wrapWithAudit("guard:status", [], opts, () => cmdGuardStatus(opts))()
);
guard.command("override <taskId> <command> <reason>").description("(doctor only) Issue a time-limited mutation override").option("--json", "Output in JSON format").action(
  (taskId, command, reason, opts) => wrapWithAudit("guard:override", [taskId], opts, () => cmdGuardOverride(taskId, command, reason, opts))()
);
program.parse();
//# sourceMappingURL=cli.js.map