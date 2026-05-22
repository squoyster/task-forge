import { z } from "zod";

export const TaskStatus = z.enum([
  "Inbox",
  "Needs Spec",
  "Ready",
  "In Progress",
  "Blocked",
  "Review",
  "Verify",
  "Done",
  "Rejected",
  "Deferred",
]);

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

export const TaskSchema = z.object({
  id: z.string(),
  type: TaskType.default("Task"),
  status: TaskStatus.default("Inbox"),
  priority: TaskPriority.default("P2"),
  agentRole: z.string().optional(),
  riskLevel: RiskLevel.default("Low"),
  humanInterventionRequired: z.boolean().default(false),
  dependsOn: z.array(z.string()).optional(),
  lockedBy: z.string().optional(),
  lockedAt: z.string().optional(),
  branch: z.string().optional(),
  worktree: z.string().optional(),
  issue: z.number().optional(),
  pr: z.number().optional(),
});

export type Task = z.infer<typeof TaskSchema>;

export const ALLOWED_STATUSES = TaskStatus.options;
export const ALLOWED_PRIORITIES = TaskPriority.options;
export const ALLOWED_TYPES = TaskType.options;
