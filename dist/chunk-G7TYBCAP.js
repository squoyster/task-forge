import {
  getRepoRoot,
  getTaskFilePath,
  getTaskStateDir
} from "./chunk-46G2ACH2.js";
import {
  logWarn
} from "./chunk-OPCWHN3N.js";

// src/core/task-store.ts
import matter from "gray-matter";
import fs from "fs";

// src/core/task.ts
import { z as z2 } from "zod";

// src/util/status-constants.ts
import { z } from "zod";
var STATUS = {
  INBOX: "Inbox",
  NEEDS_SPEC: "Needs Spec",
  READY: "Ready",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  IMPLEMENTATION_COMPLETE: "Implementation Complete",
  SUBMITTED: "Submitted",
  REVIEW: "Review",
  MERGE_READY: "Merge Ready",
  VERIFY: "Verify",
  DONE: "Done",
  REJECTED: "Rejected",
  DEFERRED: "Deferred"
};
var ALL_STATUSES = Object.values(STATUS);
var ACTIVE_STATUSES = [
  STATUS.READY,
  STATUS.IN_PROGRESS,
  STATUS.IMPLEMENTATION_COMPLETE,
  STATUS.SUBMITTED,
  STATUS.REVIEW,
  STATUS.MERGE_READY,
  STATUS.VERIFY
];
var TERMINAL_STATUSES = [STATUS.DONE, STATUS.REJECTED, STATUS.DEFERRED];
function normalizeStatus(input) {
  const trimmed = input.trim();
  if (ALL_STATUSES.includes(trimmed)) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  const variantMap = {
    // In Progress variants
    "in_progress": STATUS.IN_PROGRESS,
    "in-progress": STATUS.IN_PROGRESS,
    "in progress": STATUS.IN_PROGRESS,
    "inprogress": STATUS.IN_PROGRESS,
    // Needs Spec variants
    "needs_spec": STATUS.NEEDS_SPEC,
    "needsspec": STATUS.NEEDS_SPEC,
    "needs spec": STATUS.NEEDS_SPEC,
    // Ready variants
    "ready": STATUS.READY,
    // Blocked variants
    "blocked": STATUS.BLOCKED,
    // Implementation Complete variants
    "implementation_complete": STATUS.IMPLEMENTATION_COMPLETE,
    "implementation-complete": STATUS.IMPLEMENTATION_COMPLETE,
    "implementation complete": STATUS.IMPLEMENTATION_COMPLETE,
    "implcomplete": STATUS.IMPLEMENTATION_COMPLETE,
    // Submitted variants
    "submitted": STATUS.SUBMITTED,
    // Review variants
    "review": STATUS.REVIEW,
    // Merge Ready variants
    "merge_ready": STATUS.MERGE_READY,
    "merge-ready": STATUS.MERGE_READY,
    "merge ready": STATUS.MERGE_READY,
    // Verify variants
    "verify": STATUS.VERIFY,
    // Done variants
    "done": STATUS.DONE,
    // Rejected variants
    "rejected": STATUS.REJECTED,
    // Deferred variants
    "deferred": STATUS.DEFERRED,
    // Inbox variants
    "inbox": STATUS.INBOX
  };
  const camelCaseMap = {
    "InProgress": STATUS.IN_PROGRESS,
    "NeedsSpec": STATUS.NEEDS_SPEC,
    "ImplementationComplete": STATUS.IMPLEMENTATION_COMPLETE,
    "MergeReady": STATUS.MERGE_READY
  };
  if (variantMap[lower]) {
    return variantMap[lower];
  }
  if (camelCaseMap[trimmed]) {
    return camelCaseMap[trimmed];
  }
  return trimmed;
}
function createStatusSchema() {
  return z.preprocess(
    (val) => {
      if (typeof val !== "string") return val;
      return normalizeStatus(val);
    },
    z.enum([STATUS.INBOX, STATUS.NEEDS_SPEC, STATUS.READY, STATUS.IN_PROGRESS, STATUS.BLOCKED, STATUS.IMPLEMENTATION_COMPLETE, STATUS.SUBMITTED, STATUS.REVIEW, STATUS.MERGE_READY, STATUS.VERIFY, STATUS.DONE, STATUS.REJECTED, STATUS.DEFERRED])
  );
}

// src/core/task.ts
var TaskPriority = z2.enum(["P0", "P1", "P2", "P3"]);
var TaskType = z2.enum([
  "Epic",
  "Feature",
  "Task",
  "Bug",
  "Chore",
  "Research",
  "Spike",
  "Refactor",
  "Test",
  "Documentation",
  "Infrastructure",
  "Security",
  "Release",
  "Dependency",
  "Maintenance"
]);
var RiskLevel = z2.enum(["Low", "Medium", "High"]);
var TaskStatus = z2.enum([
  STATUS.INBOX,
  STATUS.NEEDS_SPEC,
  STATUS.READY,
  STATUS.IN_PROGRESS,
  STATUS.BLOCKED,
  STATUS.REVIEW,
  STATUS.VERIFY,
  STATUS.DONE,
  STATUS.REJECTED,
  STATUS.DEFERRED
]);
var BlockCategory = z2.enum([
  "human_decision",
  "test_failure",
  "merge_conflict",
  "missing_secret",
  "unsafe_operation",
  "ambiguous_spec",
  "unspecified"
]);
var BlockedBy = z2.enum(["human", "agent", "bot", "unspecified"]);
var TaskSchema = z2.object({
  id: z2.string(),
  type: TaskType.default("Task"),
  status: createStatusSchema().default(STATUS.INBOX),
  priority: TaskPriority.default("P2"),
  agentRole: z2.string().optional(),
  riskLevel: RiskLevel.default("Low"),
  humanInterventionRequired: z2.boolean().default(false),
  dependsOn: z2.array(z2.string()).optional(),
  assignee: z2.string().optional(),
  claimed_at: z2.union([z2.string(), z2.date()]).optional(),
  branch: z2.string().optional(),
  worktree: z2.string().optional(),
  blocked_reason: z2.string().optional(),
  blocked_by: BlockedBy.optional(),
  blocked_since: z2.union([z2.string(), z2.date()]).optional(),
  block_category: BlockCategory.optional(),
  context_hash: z2.string().optional(),
  override_reason: z2.string().optional(),
  override_actor: z2.string().optional(),
  override_timestamp: z2.string().optional(),
  override_failed_gates: z2.array(z2.string()).optional(),
  issue: z2.number().optional(),
  pr: z2.number().optional(),
  submitted_sha: z2.string().optional(),
  submitted_at: z2.union([z2.string(), z2.date()]).optional(),
  pr_merged: z2.boolean().optional(),
  pr_head_sha: z2.string().optional(),
  pr_base_branch: z2.string().optional(),
  code_task: z2.boolean().optional()
});
var ALLOWED_STATUSES = TaskStatus.options;
var ALLOWED_PRIORITIES = TaskPriority.options;
var ALLOWED_TYPES = TaskType.options;

// src/core/task-store.ts
function parseTaskFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = matter(content, { date: false });
  const frontmatter = parsed.data;
  let id = frontmatter.id;
  if (!id) {
    const basename = filePath.split("/").pop().replace(".md", "");
    id = basename;
  }
  const taskData = {
    id,
    type: frontmatter.type ?? "Task",
    status: frontmatter.status ?? STATUS.INBOX,
    priority: frontmatter.priority ?? "P2",
    agentRole: frontmatter.agentRole ?? frontmatter.agent_role,
    riskLevel: frontmatter.riskLevel ?? frontmatter.risk_level ?? "Low",
    humanInterventionRequired: frontmatter.humanInterventionRequired ?? frontmatter.human_intervention_required ?? false,
    dependsOn: frontmatter.dependsOn,
    assignee: frontmatter.assignee,
    claimed_at: frontmatter.claimed_at,
    blocked_reason: frontmatter.blocked_reason,
    blocked_by: frontmatter.blocked_by,
    blocked_since: frontmatter.blocked_since,
    block_category: frontmatter.block_category,
    context_hash: frontmatter.context_hash,
    branch: frontmatter.branch,
    worktree: frontmatter.worktree,
    override_reason: frontmatter.override_reason,
    override_actor: frontmatter.override_actor,
    override_timestamp: frontmatter.override_timestamp,
    override_failed_gates: frontmatter.override_failed_gates,
    issue: frontmatter.issue ? Number(frontmatter.issue) : void 0,
    pr: frontmatter.pr ? Number(frontmatter.pr) : void 0,
    submitted_sha: frontmatter.submitted_sha,
    submitted_at: frontmatter.submitted_at,
    pr_merged: frontmatter.pr_merged === true || frontmatter.pr_merged === "true" ? true : frontmatter.pr_merged === false || frontmatter.pr_merged === "false" ? false : void 0,
    pr_head_sha: frontmatter.pr_head_sha,
    pr_base_branch: frontmatter.pr_base_branch,
    code_task: frontmatter.code_task === true || frontmatter.code_task === "true" ? true : frontmatter.code_task === false || frontmatter.code_task === "false" ? false : void 0
  };
  const result = TaskSchema.safeParse(taskData);
  if (!result.success) {
    logWarn(`Invalid task file ${filePath}: ${result.error.message}`);
    return null;
  }
  return {
    ...result.data,
    body: parsed.content,
    filePath
  };
}
function writeTaskFile(task, body) {
  const frontmatter = {
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
    override_reason: task.override_reason,
    override_actor: task.override_actor,
    override_timestamp: task.override_timestamp,
    override_failed_gates: task.override_failed_gates,
    issue: task.issue,
    pr: task.pr
  };
  for (const key of Object.keys(frontmatter)) {
    if (frontmatter[key] === void 0) {
      delete frontmatter[key];
    }
  }
  const content = matter.stringify(body ?? task.body, frontmatter);
  fs.writeFileSync(task.filePath, content, "utf-8");
}
function updateTaskStatus(filePath, newStatus) {
  const task = parseTaskFile(filePath);
  if (!task) return null;
  task.status = newStatus;
  writeTaskFile(task);
  return task;
}
function updateTaskIssue(filePath, issueNumber) {
  const task = parseTaskFile(filePath);
  if (!task) return null;
  task.issue = issueNumber;
  writeTaskFile(task);
  return task;
}
function clearTaskLock(filePath) {
  const task = parseTaskFile(filePath);
  if (!task) return null;
  task.assignee = void 0;
  task.claimed_at = void 0;
  writeTaskFile(task);
  return task;
}
function appendAgentNote(filePath, date, role, notes) {
  const task = parseTaskFile(filePath);
  if (!task) return;
  let timestamp;
  if (date.includes("T")) {
    timestamp = date.endsWith("Z") ? date : date + "Z";
  } else {
    timestamp = `${date}T00:00:00Z`;
  }
  const noteBlock = `
### ${timestamp} ${role}
${notes.map((n) => `- ${n}`).join("\n")}`;
  if (task.body.includes("## Agent Notes")) {
    task.body = task.body.replace(
      /(## Agent Notes\n)/,
      `$1${noteBlock}
`
    );
  } else {
    task.body += `
## Agent Notes
${noteBlock}
`;
  }
  writeTaskFile(task);
}
function listTaskFiles(repoRoot) {
  const tasksDir = getTaskStateDir(repoRoot ?? getRepoRoot());
  if (!fs.existsSync(tasksDir)) return [];
  return fs.readdirSync(tasksDir).filter((f) => f.endsWith(".md") && f !== "README.md" && f !== "TEMPLATE.md").map((f) => `${tasksDir}/${f}`);
}
function loadAllTasks(repoRoot) {
  return listTaskFiles(repoRoot).map((f) => parseTaskFile(f)).filter((t) => t !== null);
}
function loadTaskById(id, repoRoot) {
  const filePath = getTaskFilePath(repoRoot ?? getRepoRoot(), id);
  return parseTaskFile(filePath);
}
function hasAcceptanceCriteriaSection(body) {
  return /## Acceptance Criteria/i.test(body);
}
function hasBlankAcceptanceCriteria(body) {
  const match = body.match(/## Acceptance Criteria\n([\s\S]*?)(?=\n## |$)/i);
  if (!match) return false;
  const lines = match[1].split("\n");
  return lines.some((line) => /^\s*- \[[ x]\]\s*$/.test(line));
}
function hasUncheckedAcceptanceCriteria(body) {
  const match = body.match(/## Acceptance Criteria\n([\s\S]*?)(?=\n## |$)/i);
  if (!match) return false;
  const lines = match[1].split("\n");
  return lines.some((line) => /^\s*- \[ \]\s+\S/.test(line));
}
function getNextId(repoRoot) {
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

// src/core/command-result.ts
import { z as z3 } from "zod";
var ValidNextCommandSchema = z3.object({
  command: z3.string(),
  purpose: z3.string(),
  when: z3.string(),
  allowedFor: z3.enum(["all", "human", "doctor", "agent"]).default("all"),
  priority: z3.number().int().min(1).max(3).default(2)
});
var TodoMergeItemSchema = z3.object({
  taskId: z3.string(),
  action: z3.enum(["add", "remove", "update"]),
  content: z3.string()
});
var TodoMergeInstructionSchema = z3.object({
  required: z3.boolean().default(false),
  items: z3.array(TodoMergeItemSchema).default([])
});
var ContextCleanupInstructionSchema = z3.object({
  required: z3.boolean().default(false),
  reason: z3.string().optional(),
  actions: z3.array(z3.string()).default([])
});
var ProhibitedActionSchema = z3.object({
  action: z3.string(),
  reason: z3.string()
});
var RecoveryInstructionSchema = z3.object({
  required: z3.boolean().default(false),
  steps: z3.array(z3.string()).default([]),
  createTaskBody: z3.string().optional()
});
var DiagnosticItemSchema = z3.object({
  level: z3.enum(["info", "warn", "error"]),
  message: z3.string()
});
var AuditReferenceSchema = z3.object({
  taskId: z3.string().optional(),
  transcriptPath: z3.string().optional(),
  eventId: z3.string().optional()
});
var CommandMetadataSchema = z3.object({
  command: z3.string(),
  timestamp: z3.string(),
  duration: z3.number().optional(),
  sessionId: z3.string().optional()
});
var CommandStatusSchema = z3.enum([
  "success",
  "blocked",
  "failed",
  "noop",
  "human_required",
  "doctor_required"
]);
var CommandContextSchema = z3.object({
  taskId: z3.string().optional(),
  worktree: z3.string().optional(),
  branch: z3.string().optional()
});
var AgentPromptEnvelopeSchema = z3.object({
  role: z3.enum(["implementer", "reviewer", "planner", "intake", "doctor"]).default("implementer"),
  instruction: z3.string().optional()
});
var TaskForgeCommandResultSchema = z3.object({
  ok: z3.boolean(),
  status: CommandStatusSchema,
  metadata: CommandMetadataSchema,
  context: CommandContextSchema,
  agentPrompt: AgentPromptEnvelopeSchema,
  validNextCommands: z3.array(ValidNextCommandSchema).default([]),
  todoMerge: TodoMergeInstructionSchema.default({ required: false, items: [] }),
  contextCleanup: ContextCleanupInstructionSchema.default({ required: false, actions: [] }),
  prohibitedActions: z3.array(ProhibitedActionSchema).default([]),
  recovery: RecoveryInstructionSchema.default({ required: false, steps: [] }),
  diagnostics: z3.array(DiagnosticItemSchema).default([]),
  audit: AuditReferenceSchema.optional(),
  guidance: z3.string().optional(),
  error: z3.string().optional(),
  code: z3.string().optional()
});
var STANDARD_PROHIBITED_ACTIONS = [
  { action: "git commit", reason: "Use taskforge checkpoint instead" },
  { action: "git push", reason: "Use taskforge submit instead" },
  { action: "git worktree add", reason: "Use taskforge start instead" },
  { action: "git branch -D", reason: "Use taskforge done --delete-branch instead" },
  { action: "direct task-state file edits", reason: "Use taskforge CLI commands instead" }
];

// src/core/next-command-maps.ts
var NEXT_COMMAND_MAPS = {
  init: {
    success: [
      { command: "taskforge next", purpose: "Find the next available task", when: "After successful initialization", allowedFor: "all", priority: 1 }
    ],
    failed: [
      { command: "taskforge doctor", purpose: "Diagnose initialization issues", when: "On initialization failure", allowedFor: "all", priority: 1 }
    ]
  },
  next: {
    success: [
      { command: "taskforge start <TASK-ID>", purpose: "Begin working on the selected task", when: "After finding a task", allowedFor: "all", priority: 1 },
      { command: "taskforge claim <TASK-ID>", purpose: "Claim without creating worktree", when: "If you only need to claim", allowedFor: "all", priority: 2 }
    ],
    noop: [
      { command: "taskforge release <TASK-ID>", purpose: "Release current task to find another", when: "If you have an outstanding task", allowedFor: "all", priority: 1 }
    ]
  },
  start: {
    success: [
      { command: "taskforge checkpoint <TASK-ID>", purpose: "Save progress", when: "After making changes", allowedFor: "all", priority: 1 },
      { command: "taskforge done <TASK-ID>", purpose: "Mark task complete", when: "When all ACs are satisfied", allowedFor: "all", priority: 2 },
      { command: "taskforge heartbeat <TASK-ID>", purpose: "Extend lease", when: "Before lease expires", allowedFor: "all", priority: 3 }
    ],
    failed: [
      { command: "taskforge resume <TASK-ID>", purpose: "Retry starting the task", when: "On start failure", allowedFor: "all", priority: 1 }
    ]
  },
  claim: {
    success: [
      { command: "taskforge start <TASK-ID>", purpose: "Create worktree and begin work", when: "After claiming", allowedFor: "all", priority: 1 }
    ],
    failed: [
      { command: "taskforge next", purpose: "Find a different task", when: "On claim failure", allowedFor: "all", priority: 1 }
    ]
  },
  done: {
    success: [
      { command: "taskforge next", purpose: "Find the next task", when: "After completing a task", allowedFor: "all", priority: 1 }
    ],
    failed: [
      { command: "taskforge start <TASK-ID>", purpose: "Return to In Progress to fix issues", when: "On done failure", allowedFor: "all", priority: 1 }
    ]
  },
  release: {
    success: [
      { command: "taskforge next", purpose: "Find a different task", when: "After releasing", allowedFor: "all", priority: 1 }
    ]
  },
  heartbeat: {
    success: [
      { command: "taskforge checkpoint <TASK-ID>", purpose: "Save progress", when: "After heartbeat", allowedFor: "all", priority: 1 }
    ]
  },
  checkpoint: {
    success: [
      { command: "taskforge submit <TASK-ID>", purpose: "Push changes", when: "After checkpoint", allowedFor: "all", priority: 1 },
      { command: "taskforge done <TASK-ID>", purpose: "Mark task complete", when: "When all ACs are satisfied", allowedFor: "all", priority: 2 }
    ]
  },
  submit: {
    success: [
      { command: "taskforge pr <TASK-ID>", purpose: "Create pull request", when: "After push", allowedFor: "all", priority: 1 }
    ]
  },
  pr: {
    success: [
      { command: "taskforge next", purpose: "Find the next task", when: "After PR creation", allowedFor: "all", priority: 1 }
    ]
  },
  block: {
    success: [
      { command: "taskforge next", purpose: "Find a different task", when: "After blocking", allowedFor: "all", priority: 1 }
    ]
  },
  unlock: {
    success: [
      { command: "taskforge start <TASK-ID>", purpose: "Begin working on unlocked task", when: "After unlock", allowedFor: "all", priority: 1 }
    ]
  },
  sweep: {
    success: [
      { command: "taskforge next", purpose: "Find the next task after sweep", when: "After sweep", allowedFor: "all", priority: 1 }
    ]
  },
  gates: {
    success: [
      { command: "taskforge done <TASK-ID>", purpose: "Mark task complete", when: "When all gates pass and ACs satisfied", allowedFor: "all", priority: 1 }
    ],
    failed: [
      { command: "taskforge start <TASK-ID>", purpose: "Fix gate failures", when: "On gate failure", allowedFor: "all", priority: 1 }
    ]
  },
  status: {
    success: [
      { command: "taskforge next", purpose: "Find the next task", when: "After reviewing status", allowedFor: "all", priority: 1 }
    ]
  },
  summary: {
    success: [
      { command: "taskforge next", purpose: "Find the next task", when: "After reviewing summary", allowedFor: "all", priority: 1 }
    ]
  },
  inspect: {
    success: [
      { command: "taskforge start <TASK-ID>", purpose: "Begin working on inspected task", when: "After inspection", allowedFor: "all", priority: 1 }
    ]
  },
  report: {
    success: [
      { command: "taskforge done <TASK-ID>", purpose: "Mark task complete", when: "After report generation", allowedFor: "all", priority: 1 }
    ]
  },
  cleanup: {
    success: [
      { command: "taskforge next", purpose: "Find the next task", when: "After cleanup", allowedFor: "all", priority: 1 }
    ]
  },
  new: {
    success: [
      { command: "taskforge start <TASK-ID>", purpose: "Begin working on new task", when: "After task creation", allowedFor: "all", priority: 1 }
    ]
  },
  resume: {
    success: [
      { command: "taskforge checkpoint <TASK-ID>", purpose: "Save progress", when: "After resuming", allowedFor: "all", priority: 1 },
      { command: "taskforge done <TASK-ID>", purpose: "Mark task complete", when: "When all ACs are satisfied", allowedFor: "all", priority: 2 }
    ]
  },
  doctor: {
    success: [
      { command: "taskforge doctor --fix", purpose: "Apply automatic fixes", when: "If doctor found fixable issues", allowedFor: "doctor", priority: 1 },
      { command: "taskforge next", purpose: "Continue with next task", when: "If no issues found", allowedFor: "all", priority: 2 }
    ]
  },
  "config-validate": {
    success: [
      { command: "taskforge init", purpose: "Reinitialize if config invalid", when: "On validation failure", allowedFor: "all", priority: 1 }
    ]
  },
  reject: {
    success: [
      { command: "taskforge next", purpose: "Find the next task", when: "After rejection", allowedFor: "all", priority: 1 }
    ]
  },
  "validate-state": {
    success: [
      { command: "taskforge doctor", purpose: "Fix found issues", when: "If validation found issues", allowedFor: "all", priority: 1 }
    ]
  },
  audit: {
    success: [
      { command: "taskforge timeline <TASK-ID>", purpose: "View event timeline", when: "After reviewing audit", allowedFor: "all", priority: 1 }
    ]
  },
  transcript: {
    success: [
      { command: "taskforge audit <TASK-ID>", purpose: "View raw audit events", when: "After reviewing transcript", allowedFor: "all", priority: 1 }
    ]
  },
  timeline: {
    success: [
      { command: "taskforge start <TASK-ID>", purpose: "Resume working on task", when: "After reviewing timeline", allowedFor: "all", priority: 1 }
    ]
  },
  "ac-check": {
    success: [
      { command: "taskforge done <TASK-ID>", purpose: "Mark task complete", when: "If no AC issues found", allowedFor: "all", priority: 1 }
    ]
  },
  diff: {
    success: [
      { command: "taskforge checkpoint <TASK-ID>", purpose: "Commit changes", when: "After reviewing diff", allowedFor: "all", priority: 1 }
    ]
  },
  sync: {
    success: [
      { command: "taskforge next", purpose: "Find the next task", when: "After sync", allowedFor: "all", priority: 1 }
    ]
  },
  list: {
    success: [
      { command: "taskforge start <TASK-ID>", purpose: "Begin working on listed task", when: "After listing", allowedFor: "all", priority: 1 }
    ]
  },
  prompt: {
    success: [
      { command: "taskforge start <TASK-ID>", purpose: "Begin working with prompt", when: "After generating prompt", allowedFor: "all", priority: 1 }
    ]
  },
  agents: {
    success: [
      { command: "taskforge next", purpose: "Find the next task", when: "After reviewing agents", allowedFor: "all", priority: 1 }
    ]
  },
  "deps scan": {
    success: [
      { command: "taskforge deps audit", purpose: "Run detailed audit", when: "After scan", allowedFor: "all", priority: 1 }
    ]
  },
  "deps audit": {
    success: [
      { command: "taskforge deps plan", purpose: "Generate remediation plan", when: "After audit", allowedFor: "all", priority: 1 }
    ]
  },
  "deps outdated": {
    success: [
      { command: "taskforge deps plan", purpose: "Generate remediation plan", when: "After outdated check", allowedFor: "all", priority: 1 }
    ]
  },
  "deps deprecated": {
    success: [
      { command: "taskforge deps plan", purpose: "Generate remediation plan", when: "After deprecated check", allowedFor: "all", priority: 1 }
    ]
  },
  "deps plan": {
    success: [
      { command: "taskforge deps pr", purpose: "Create update PRs", when: "After plan review", allowedFor: "all", priority: 1 }
    ]
  },
  "deps create-tasks": {
    success: [
      { command: "taskforge next", purpose: "Find the next task", when: "After task creation", allowedFor: "all", priority: 1 }
    ]
  },
  "deps pr": {
    success: [
      { command: "taskforge next", purpose: "Find the next task", when: "After PR creation", allowedFor: "all", priority: 1 }
    ]
  },
  "deps summary": {
    success: [
      { command: "taskforge deps scan", purpose: "Run full scan", when: "After summary", allowedFor: "all", priority: 1 }
    ]
  }
};
function getValidNextCommands(command, outcome) {
  return NEXT_COMMAND_MAPS[command]?.[outcome] ?? [];
}

// src/core/state-validator.ts
function validateTaskState(tasks) {
  const errors = [];
  const warnings = [];
  const ids = /* @__PURE__ */ new Set();
  for (const t of tasks) {
    if (ids.has(t.id)) {
      errors.push({ severity: "error", code: "DUPLICATE_ID", taskId: t.id, message: `Duplicate task ID`, suggestedFix: "Remove or rename the duplicate" });
    }
    ids.add(t.id);
    if (t.status === STATUS.DONE && t.assignee) {
      errors.push({ severity: "error", code: "DONE_WITH_ASSIGNEE", taskId: t.id, message: "Done but still has assignee", suggestedFix: `Clear the assignee/claimed_at fields from ${t.id}` });
    }
    if (t.status === STATUS.DONE && t.claimed_at) {
      errors.push({ severity: "error", code: "DONE_WITH_CLAIM", taskId: t.id, message: "Done but still has claimed_at", suggestedFix: "Clear the claim field" });
    }
    if (t.status === STATUS.READY && t.assignee) {
      errors.push({ severity: "error", code: "READY_WITH_ASSIGNEE", taskId: t.id, message: "Ready but still has assignee", suggestedFix: "Clear the assignee/claimed_at fields" });
    }
    if ((t.status === STATUS.REJECTED || t.status === STATUS.DEFERRED) && t.assignee) {
      warnings.push({ severity: "warning", code: "TERMINAL_WITH_ASSIGNEE", taskId: t.id, message: `${t.status} but still has assignee`, suggestedFix: "Clear the claim fields" });
    }
    const activeNeedsAssignee = [STATUS.IN_PROGRESS, STATUS.IMPLEMENTATION_COMPLETE, STATUS.SUBMITTED, STATUS.REVIEW, STATUS.MERGE_READY, STATUS.VERIFY];
    if (activeNeedsAssignee.includes(t.status) && !t.assignee) {
      warnings.push({ severity: "warning", code: "ACTIVE_NO_ASSIGNEE", taskId: t.id, message: `${t.status} but no assignee`, suggestedFix: "Claim the task or reset to Ready" });
    }
    if (activeNeedsAssignee.includes(t.status) && !t.claimed_at) {
      warnings.push({ severity: "warning", code: "ACTIVE_NO_CLAIMED_AT", taskId: t.id, message: `${t.status} but no claimed_at` });
    }
    if (t.status === STATUS.BLOCKED && !t.blocked_reason) {
      errors.push({ severity: "error", code: "BLOCKED_NO_REASON", taskId: t.id, message: "Blocked but no blocked_reason" });
    }
    if (t.status === STATUS.BLOCKED && !t.blocked_since) {
      warnings.push({ severity: "warning", code: "BLOCKED_NO_SINCE", taskId: t.id, message: "Blocked but no blocked_since" });
    }
    if (t.dependsOn?.includes(t.id)) {
      errors.push({ severity: "error", code: "SELF_DEPENDENCY", taskId: t.id, message: "Task depends on itself" });
    }
    if (t.branch && !/^agent\//.test(t.branch)) {
      warnings.push({ severity: "warning", code: "BRANCH_PATTERN", taskId: t.id, message: `Branch "${t.branch}" does not match expected agent/ pattern` });
    }
  }
  const allIds = new Set(tasks.map((t) => t.id));
  for (const t of tasks) {
    if (t.dependsOn) {
      for (const dep of t.dependsOn) {
        if (!allIds.has(dep)) {
          errors.push({ severity: "error", code: "BROKEN_DEPENDENCY", taskId: t.id, message: `dependsOn references non-existent task: ${dep}` });
        }
      }
    }
  }
  for (const t of tasks) {
    if (t.dependsOn) {
      for (const dep of t.dependsOn) {
        const depTask = tasks.find((d) => d.id === dep);
        if (depTask?.dependsOn?.includes(t.id)) {
          errors.push({ severity: "error", code: "CIRCULAR_DEPENDENCY", taskId: t.id, message: `Circular dependency with ${dep}` });
        }
      }
    }
  }
  const schemaResult = validateCommandReturnSchema();
  errors.push(...schemaResult.errors);
  warnings.push(...schemaResult.warnings);
  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}
function validateCommandReturnSchema() {
  const errors = [];
  const warnings = [];
  if (STANDARD_PROHIBITED_ACTIONS.length !== 5) {
    errors.push({
      severity: "error",
      code: "INVALID_PROHIBITED_ACTIONS",
      message: `Expected 5 standard prohibited actions, found ${STANDARD_PROHIBITED_ACTIONS.length}`,
      suggestedFix: "Ensure STANDARD_PROHIBITED_ACTIONS has exactly 5 entries"
    });
  }
  const forceActions = STANDARD_PROHIBITED_ACTIONS.filter((a) => a.action.includes("--force"));
  if (forceActions.length > 0) {
    errors.push({
      severity: "error",
      code: "FORCE_IN_PROHIBITED",
      message: "Standard prohibited actions should not include --force references",
      suggestedFix: "Remove --force from standard prohibited actions"
    });
  }
  const majorCommands = ["init", "next", "start", "done", "claim", "release", "heartbeat", "checkpoint", "submit", "pr"];
  for (const cmd of majorCommands) {
    if (!NEXT_COMMAND_MAPS[cmd]) {
      errors.push({
        severity: "error",
        code: "MISSING_NEXT_COMMAND_MAP",
        message: `No validNextCommands map defined for command: ${cmd}`,
        suggestedFix: `Add next command map for ${cmd} in next-command-maps.ts`
      });
    }
  }
  for (const [cmd, outcomes] of Object.entries(NEXT_COMMAND_MAPS)) {
    for (const [outcome, commands] of Object.entries(outcomes)) {
      for (const nextCmd of commands) {
        if (nextCmd.command.includes("--force") && nextCmd.allowedFor !== "human" && nextCmd.allowedFor !== "doctor") {
          errors.push({
            severity: "error",
            code: "FORCE_IN_NEXT_COMMANDS",
            message: `Command ${cmd} (${outcome}) includes --force in validNextCommands for normal agents: ${nextCmd.command}`,
            suggestedFix: "Remove --force from next commands or set allowedFor to human/doctor"
          });
        }
      }
    }
  }
  const sampleResult = {
    ok: true,
    status: "success",
    metadata: { command: "test", timestamp: (/* @__PURE__ */ new Date()).toISOString() },
    context: {},
    agentPrompt: { role: "implementer" },
    validNextCommands: [],
    todoMerge: { required: false, items: [] },
    contextCleanup: { required: false, actions: [] },
    prohibitedActions: STANDARD_PROHIBITED_ACTIONS,
    recovery: { required: false, steps: [] },
    diagnostics: []
  };
  const parsed = TaskForgeCommandResultSchema.safeParse(sampleResult);
  if (!parsed.success) {
    errors.push({
      severity: "error",
      code: "INVALID_COMMAND_RESULT_SCHEMA",
      message: "TaskForgeCommandResult schema validation failed for sample result",
      suggestedFix: "Fix the schema definition in command-result.ts"
    });
  }
  return { errors, warnings };
}

// src/util/json-result.ts
function statusToJson(status) {
  return status.toLowerCase().replace(/ /g, "_");
}
function jsonOk(overrides) {
  return {
    ok: true,
    ...overrides
  };
}
function jsonError(error, code, extras) {
  return {
    ok: false,
    error,
    code,
    ...extras
  };
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
function printJson(result) {
  console.log(JSON.stringify(result, null, 2));
}

export {
  STATUS,
  ACTIVE_STATUSES,
  normalizeStatus,
  parseTaskFile,
  writeTaskFile,
  updateTaskStatus,
  updateTaskIssue,
  clearTaskLock,
  appendAgentNote,
  loadAllTasks,
  loadTaskById,
  hasAcceptanceCriteriaSection,
  hasBlankAcceptanceCriteria,
  hasUncheckedAcceptanceCriteria,
  getNextId,
  STANDARD_PROHIBITED_ACTIONS,
  getValidNextCommands,
  validateTaskState,
  jsonOk,
  jsonError,
  buildJsonTask,
  printJson
};
//# sourceMappingURL=chunk-G7TYBCAP.js.map