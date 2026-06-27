import { z } from "zod";

// ─── Sub-schemas ───────────────────────────────────────────────────────────

export const ValidNextCommandSchema = z.object({
  command: z.string(),
  purpose: z.string(),
  when: z.string(),
  allowedFor: z.enum(["all", "human", "doctor", "agent"]).default("all"),
  priority: z.number().int().min(1).max(3).default(2),
});
export type ValidNextCommand = z.infer<typeof ValidNextCommandSchema>;

export const SafetySchema = z.enum(["safe", "requires_human", "doctor_only", "blocked"]);
export type Safety = z.infer<typeof SafetySchema>;

export const NextActionSchema = z.object({
  command: z.string(),
  reason: z.string(),
  safety: SafetySchema,
  preferred: z.boolean(),
  stateTransition: z.object({
    from: z.string(),
    to: z.string(),
  }).optional(),
});
export type NextAction = z.infer<typeof NextActionSchema>;

export const CommandErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  handled: z.boolean(),
  createTaskCommand: z.string().optional(),
});
export type CommandError = z.infer<typeof CommandErrorSchema>;

export const TodoMergeItemSchema = z.object({
  taskId: z.string(),
  action: z.enum(["add", "remove", "update"]),
  content: z.string(),
});
export type TodoMergeItem = z.infer<typeof TodoMergeItemSchema>;

export const TodoMergeInstructionSchema = z.object({
  required: z.boolean().default(false),
  items: z.array(TodoMergeItemSchema).default([]),
});
export type TodoMergeInstruction = z.infer<typeof TodoMergeInstructionSchema>;

export const ContextCleanupInstructionSchema = z.object({
  required: z.boolean().default(false),
  reason: z.string().optional(),
  actions: z.array(z.string()).default([]),
});
export type ContextCleanupInstruction = z.infer<typeof ContextCleanupInstructionSchema>;

export const ProhibitedActionSchema = z.object({
  action: z.string(),
  reason: z.string(),
});
export type ProhibitedAction = z.infer<typeof ProhibitedActionSchema>;

export const RecoveryInstructionSchema = z.object({
  required: z.boolean().default(false),
  steps: z.array(z.string()).default([]),
  createTaskBody: z.string().optional(),
});
export type RecoveryInstruction = z.infer<typeof RecoveryInstructionSchema>;

export const DiagnosticItemSchema = z.object({
  level: z.enum(["info", "warn", "error"]),
  message: z.string(),
});
export type DiagnosticItem = z.infer<typeof DiagnosticItemSchema>;

export const AuditReferenceSchema = z.object({
  taskId: z.string().optional(),
  transcriptPath: z.string().optional(),
  eventId: z.string().optional(),
});
export type AuditReference = z.infer<typeof AuditReferenceSchema>;

export const CommandMetadataSchema = z.object({
  command: z.string(),
  timestamp: z.string(),
  duration: z.number().optional(),
  sessionId: z.string().optional(),
});
export type CommandMetadata = z.infer<typeof CommandMetadataSchema>;

export const CommandStatusSchema = z.enum([
  "success",
  "blocked",
  "failed",
  "noop",
  "human_required",
  "doctor_required",
]);
export type CommandStatus = z.infer<typeof CommandStatusSchema>;

export const CommandContextSchema = z.object({
  taskId: z.string().optional(),
  worktree: z.string().optional(),
  branch: z.string().optional(),
});
export type CommandContext = z.infer<typeof CommandContextSchema>;

export const AgentPromptEnvelopeSchema = z.object({
  role: z.enum(["implementer", "reviewer", "planner", "intake", "doctor"]).default("implementer"),
  instruction: z.string().optional(),
});
export type AgentPromptEnvelope = z.infer<typeof AgentPromptEnvelopeSchema>;

// ─── Main schema ───────────────────────────────────────────────────────────

export const TaskForgeCommandResultSchema = z.object({
  ok: z.boolean(),
  status: CommandStatusSchema,
  metadata: CommandMetadataSchema,
  context: CommandContextSchema,
  agentPrompt: AgentPromptEnvelopeSchema,
  validNextCommands: z.array(ValidNextCommandSchema).default([]),
  nextActions: z.array(NextActionSchema).default([]),
  todoMerge: TodoMergeInstructionSchema.default({ required: false, items: [] }),
  contextCleanup: ContextCleanupInstructionSchema.default({ required: false, actions: [] }),
  prohibitedActions: z.array(ProhibitedActionSchema).default([]),
  recovery: RecoveryInstructionSchema.default({ required: false, steps: [] }),
  diagnostics: z.array(DiagnosticItemSchema).default([]),
  audit: AuditReferenceSchema.optional(),
  guidance: z.string().optional(),
  commandError: CommandErrorSchema.optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  data: z.unknown().optional(),
});

export type TaskForgeCommandResult = z.infer<typeof TaskForgeCommandResultSchema>;

// ─── Standard prohibited actions ───────────────────────────────────────────

export const STANDARD_PROHIBITED_ACTIONS: ProhibitedAction[] = [
  { action: "git commit", reason: "Forbidden in managed agent sessions" },
  { action: "git push", reason: "Forbidden in managed agent sessions" },
  { action: "git worktree add", reason: "Forbidden in managed agent sessions" },
  { action: "git branch -D", reason: "Forbidden in managed agent sessions" },
  { action: "direct task-state file edits", reason: "Use taskforge CLI commands instead" },
];
