import { z } from "zod";
import { STATUS, ALL_STATUSES, ACTIVE_STATUSES, TERMINAL_STATUSES, createStatusSchema } from "../util/status-constants.js";

export const TaskPriority = z.enum(["P0", "P1", "P2", "P3"]);

export const TaskType = z.enum([
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
  "Maintenance",
]);

export const RiskLevel = z.enum(["Low", "Medium", "High"]);

export const TaskStatus = z.enum([
  STATUS.INBOX,
  STATUS.NEEDS_SPEC,
  STATUS.READY,
  STATUS.IN_PROGRESS,
  STATUS.BLOCKED,
  STATUS.REVIEW,
  STATUS.VERIFY,
  STATUS.DONE,
  STATUS.REJECTED,
  STATUS.DEFERRED,
]);

export const TaskSchema = z.object({
  id: z.string(),
  type: TaskType.default("Task"),
  status: createStatusSchema().default(STATUS.INBOX),
  priority: TaskPriority.default("P2"),
  agentRole: z.string().optional(),
  riskLevel: RiskLevel.default("Low"),
  humanInterventionRequired: z.boolean().default(false),
  dependsOn: z.array(z.string()).optional(),
  assignee: z.string().optional(),
  claimed_at: z.union([z.string(), z.date()]).optional(),
  branch: z.string().optional(),
  worktree: z.string().optional(),
  issue: z.number().optional(),
  pr: z.number().optional(),
});

export type Task = z.infer<typeof TaskSchema>;

export { STATUS, ALL_STATUSES, ACTIVE_STATUSES, TERMINAL_STATUSES };
export const ALLOWED_STATUSES = TaskStatus.options;
export const ALLOWED_PRIORITIES = TaskPriority.options;
export const ALLOWED_TYPES = TaskType.options;
