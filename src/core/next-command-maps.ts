import type { ValidNextCommand } from "./command-result.js";

export interface NextCommandMap {
  [command: string]: {
    [outcome: string]: ValidNextCommand[];
  };
}

/**
 * Command-specific validNextCommands maps per spec §8.
 * Maps keyed by command name + outcome state.
 */
export const NEXT_COMMAND_MAPS: NextCommandMap = {
  init: {
    success: [
      { command: "taskforge next", purpose: "Find the next available task", when: "After successful initialization", allowedFor: "all", priority: 1 },
    ],
    failed: [
      { command: "taskforge doctor", purpose: "Diagnose initialization issues", when: "On initialization failure", allowedFor: "all", priority: 1 },
    ],
  },
  next: {
    success: [
      { command: "taskforge claim <TASK-ID>", purpose: "Claim the selected task (worktree is direct-git)", when: "After finding a task", allowedFor: "all", priority: 1 },
    ],
    noop: [
      { command: "taskforge release <TASK-ID>", purpose: "Release current task to find another", when: "If you have an outstanding task", allowedFor: "all", priority: 1 },
    ],
  },
  claim: {
    success: [
      { command: "git worktree add -b <branch> <worktree> main", purpose: "Create the worktree for the claimed task (direct-git)", when: "After claiming", allowedFor: "all", priority: 1 },
      { command: "git add -A && git commit", purpose: "Save progress", when: "After making changes", allowedFor: "all", priority: 2 },
    ],
    failed: [
      { command: "taskforge next", purpose: "Find a different task", when: "On claim failure", allowedFor: "all", priority: 1 },
    ],
  },
  done: {
    success: [
      { command: "taskforge next", purpose: "Find the next task", when: "After completing a task", allowedFor: "all", priority: 1 },
    ],
    failed: [
      { command: "git add -A && git commit", purpose: "Return to the worktree to fix issues", when: "On done failure", allowedFor: "all", priority: 1 },
    ],
  },
  release: {
    success: [
      { command: "taskforge next", purpose: "Find a different task", when: "After releasing", allowedFor: "all", priority: 1 },
    ],
  },
  heartbeat: {
    success: [
      { command: "git add -A && git commit", purpose: "Save progress", when: "After heartbeat", allowedFor: "all", priority: 1 },
    ],
  },
  checkpoint: {
    success: [
      { command: "git push -u origin <branch>", purpose: "Push changes", when: "After checkpoint", allowedFor: "all", priority: 1 },
      { command: "taskforge done <TASK-ID>", purpose: "Mark task complete", when: "When all ACs are satisfied", allowedFor: "all", priority: 2 },
    ],
  },
  submit: {
    success: [
      { command: "gh pr create", purpose: "Create pull request", when: "After push", allowedFor: "all", priority: 1 },
    ],
  },
  pr: {
    success: [
      { command: "taskforge next", purpose: "Find the next task", when: "After PR creation", allowedFor: "all", priority: 1 },
    ],
  },
  block: {
    success: [
      { command: "taskforge next", purpose: "Find a different task", when: "After blocking", allowedFor: "all", priority: 1 },
    ],
  },
  unlock: {
    success: [
      { command: "taskforge claim <TASK-ID>", purpose: "Claim the unlocked task (worktree is direct-git)", when: "After unlock", allowedFor: "all", priority: 1 },
    ],
  },
  sweep: {
    success: [
      { command: "taskforge next", purpose: "Find the next task after sweep", when: "After sweep", allowedFor: "all", priority: 1 },
    ],
  },
  gates: {
    success: [
      { command: "taskforge done <TASK-ID>", purpose: "Mark task complete", when: "When all gates pass and ACs satisfied", allowedFor: "all", priority: 1 },
    ],
    failed: [
      { command: "git add -A && git commit", purpose: "Fix gate failures in the worktree", when: "On gate failure", allowedFor: "all", priority: 1 },
    ],
  },
  status: {
    success: [
      { command: "taskforge next", purpose: "Find the next task", when: "After reviewing status", allowedFor: "all", priority: 1 },
    ],
  },
  summary: {
    success: [
      { command: "taskforge next", purpose: "Find the next task", when: "After reviewing summary", allowedFor: "all", priority: 1 },
    ],
  },
  inspect: {
    success: [
      { command: "taskforge claim <TASK-ID>", purpose: "Claim the inspected task (worktree is direct-git)", when: "After inspection", allowedFor: "all", priority: 1 },
    ],
  },
  report: {
    success: [
      { command: "taskforge done <TASK-ID>", purpose: "Mark task complete", when: "After report generation", allowedFor: "all", priority: 1 },
    ],
  },
  promote: {
    success: [
      { command: "taskforge promote <TASK-ID>", purpose: "Advance to the next valid workflow state", when: "After promotion", allowedFor: "all", priority: 1 },
      { command: "taskforge inspect <TASK-ID> --json", purpose: "Inspect current task state", when: "If the next state is unclear", allowedFor: "all", priority: 2 },
    ],
    failed: [
      { command: "taskforge inspect <TASK-ID> --json", purpose: "Inspect allowed task transitions", when: "On promotion failure", allowedFor: "all", priority: 1 },
    ],
  },
  update: {
    success: [
      { command: "taskforge inspect <TASK-ID> --json", purpose: "Verify the updated task document", when: "After updating task fields", allowedFor: "all", priority: 1 },
      { command: "taskforge next", purpose: "Return to task selection", when: "After verifying the update", allowedFor: "all", priority: 2 },
    ],
    failed: [
      { command: "taskforge inspect <TASK-ID> --json", purpose: "Reload current task state before retrying", when: "On update failure", allowedFor: "all", priority: 1 },
    ],
  },
  new: {
    success: [
      { command: "taskforge claim <TASK-ID>", purpose: "Claim the new task (worktree is direct-git)", when: "After task creation", allowedFor: "all", priority: 1 },
    ],
  },
  doctor: {
    success: [
      { command: "taskforge doctor --fix", purpose: "Apply automatic fixes", when: "If doctor found fixable issues", allowedFor: "doctor", priority: 1 },
      { command: "taskforge next", purpose: "Continue with next task", when: "If no issues found", allowedFor: "all", priority: 2 },
    ],
  },
  "config-validate": {
    success: [
      { command: "taskforge init", purpose: "Reinitialize if config invalid", when: "On validation failure", allowedFor: "all", priority: 1 },
    ],
  },
  reject: {
    success: [
      { command: "taskforge next", purpose: "Find the next task", when: "After rejection", allowedFor: "all", priority: 1 },
    ],
  },
  "validate-state": {
    success: [
      { command: "taskforge doctor", purpose: "Fix found issues", when: "If validation found issues", allowedFor: "all", priority: 1 },
    ],
  },
  audit: {
    success: [
      { command: "taskforge timeline <TASK-ID>", purpose: "View event timeline", when: "After reviewing audit", allowedFor: "all", priority: 1 },
    ],
  },
  transcript: {
    success: [
      { command: "taskforge audit <TASK-ID>", purpose: "View raw audit events", when: "After reviewing transcript", allowedFor: "all", priority: 1 },
    ],
  },
  timeline: {
    success: [
      { command: "taskforge claim <TASK-ID>", purpose: "Claim the task to resume work (worktree is direct-git)", when: "After reviewing timeline", allowedFor: "all", priority: 1 },
    ],
  },
  "ac-check": {
    success: [
      { command: "taskforge done <TASK-ID>", purpose: "Mark task complete", when: "If no AC issues found", allowedFor: "all", priority: 1 },
    ],
  },
  diff: {
    success: [
      { command: "git add -A && git commit", purpose: "Commit changes", when: "After reviewing diff", allowedFor: "all", priority: 1 },
    ],
  },
  sync: {
    success: [
      { command: "taskforge next", purpose: "Find the next task", when: "After sync", allowedFor: "all", priority: 1 },
    ],
  },
  list: {
    success: [
      { command: "taskforge claim <TASK-ID>", purpose: "Claim the listed task (worktree is direct-git)", when: "After listing", allowedFor: "all", priority: 1 },
    ],
  },
  prompt: {
    success: [
      { command: "taskforge claim <TASK-ID>", purpose: "Claim the task for the prompt (worktree is direct-git)", when: "After generating prompt", allowedFor: "all", priority: 1 },
    ],
  },
  mcp: {
    success: [
      { command: "taskforge next", purpose: "Continue the TaskForge workflow", when: "After MCP server use", allowedFor: "all", priority: 1 },
    ],
  },
  "guard status": {
    success: [
      { command: "taskforge next", purpose: "Continue after reviewing guard state", when: "After guard status", allowedFor: "all", priority: 1 },
    ],
  },
  "guard override": {
    success: [
      { command: "taskforge doctor --check", purpose: "Verify repository health after a guard override", when: "After override", allowedFor: "doctor", priority: 1 },
    ],
    failed: [
      { command: "taskforge doctor --check", purpose: "Diagnose guard override failure", when: "On override failure", allowedFor: "doctor", priority: 1 },
    ],
  },
  agents: {
    success: [
      { command: "taskforge next", purpose: "Find the next task", when: "After reviewing agents", allowedFor: "all", priority: 1 },
    ],
  },
  "deps scan": {
    success: [
      { command: "taskforge deps audit", purpose: "Run detailed audit", when: "After scan", allowedFor: "all", priority: 1 },
    ],
  },
  "deps audit": {
    success: [
      { command: "taskforge deps plan", purpose: "Generate remediation plan", when: "After audit", allowedFor: "all", priority: 1 },
    ],
  },
  "deps outdated": {
    success: [
      { command: "taskforge deps plan", purpose: "Generate remediation plan", when: "After outdated check", allowedFor: "all", priority: 1 },
    ],
  },
  "deps deprecated": {
    success: [
      { command: "taskforge deps plan", purpose: "Generate remediation plan", when: "After deprecated check", allowedFor: "all", priority: 1 },
    ],
  },
  "deps plan": {
    success: [
      { command: "taskforge deps pr", purpose: "Create update PRs", when: "After plan review", allowedFor: "all", priority: 1 },
    ],
  },
  "deps create-tasks": {
    success: [
      { command: "taskforge next", purpose: "Find the next task", when: "After task creation", allowedFor: "all", priority: 1 },
    ],
  },
  "deps pr": {
    success: [
      { command: "taskforge next", purpose: "Find the next task", when: "After PR creation", allowedFor: "all", priority: 1 },
    ],
  },
  "deps summary": {
    success: [
      { command: "taskforge deps scan", purpose: "Run full scan", when: "After summary", allowedFor: "all", priority: 1 },
    ],
  },
};

/**
 * Get valid next commands for a given command and outcome.
 */
export function getValidNextCommands(command: string, outcome: string): ValidNextCommand[] {
  return NEXT_COMMAND_MAPS[command]?.[outcome] ?? [];
}

/**
 * Get all valid next commands for a command (all outcomes).
 */
export function getAllValidNextCommands(command: string): ValidNextCommand[] {
  const outcomes = NEXT_COMMAND_MAPS[command];
  if (!outcomes) return [];
  return Object.values(outcomes).flat();
}
