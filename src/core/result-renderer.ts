import type { TaskForgeCommandResult } from "./command-result.js";

/**
 * Render a TaskForgeCommandResult to Markdown with exact section order per spec §4.
 */
export function renderResultMarkdown(result: TaskForgeCommandResult): string {
  const sections: string[] = [];

  // Section 1: Command Success Status
  sections.push(renderStatusSection(result));

  // Section 2: Current Context
  if (result.context.taskId || result.context.worktree || result.context.branch) {
    sections.push(renderContextSection(result));
  }

  // Section 3: Agentic Instruction
  if (result.agentPrompt.instruction) {
    sections.push(renderAgentPromptSection(result));
  }

  // Section 4: Todo Merge Required
  if (result.todoMerge.required || result.todoMerge.items.length > 0) {
    sections.push(renderTodoMergeSection(result));
  }

  // Section 5: Context Cleanup
  if (result.contextCleanup.required) {
    sections.push(renderContextCleanupSection(result));
  }

  // Section 6: Prohibited Actions
  if (result.prohibitedActions.length > 0) {
    sections.push(renderProhibitedActionsSection(result));
  }

  // Section 7: Recovery Guidance
  if (result.recovery.required) {
    sections.push(renderRecoverySection(result));
  }

  // Section 8: Audit and Trace
  if (result.audit || result.diagnostics.length > 0) {
    sections.push(renderAuditSection(result));
  }

  // Section 9: Valid Next Actions. Keep this last so human output ends with
  // immediately actionable commands.
  if (result.nextActions.length > 0) {
    sections.push(renderNextActionsSection(result));
  }

  return sections.join("\n\n");
}

function renderStatusSection(result: TaskForgeCommandResult): string {
  const statusLabel = result.status.replace(/_/g, " ");
  const icon = result.ok ? "✅" : "❌";
  let content = `## ${icon} Command ${result.ok ? "Success" : "Status"}: ${statusLabel}`;

  if (result.guidance) {
    content += `\n\n${result.guidance}`;
  }
  if (result.error) {
    content += `\n\n**Error:** ${result.error}`;
    if (result.code) {
      content += ` (\`${result.code}\`)`;
    }
  }

  return content;
}

function renderContextSection(result: TaskForgeCommandResult): string {
  const lines = ["## Current Context"];
  if (result.context.taskId) lines.push(`- **Task:** ${result.context.taskId}`);
  if (result.context.worktree) lines.push(`- **Worktree:** ${result.context.worktree}`);
  if (result.context.branch) lines.push(`- **Branch:** ${result.context.branch}`);
  return lines.join("\n");
}

function renderAgentPromptSection(result: TaskForgeCommandResult): string {
  return `## Agentic Instruction\n\n**Role:** ${result.agentPrompt.role}\n\n${result.agentPrompt.instruction}`;
}

function renderNextActionsSection(result: TaskForgeCommandResult): string {
  const lines = ["## Valid next actions:"];
  const sorted = [...result.nextActions].sort((a, b) => Number(b.preferred) - Number(a.preferred));
  for (let i = 0; i < sorted.length; i++) {
    const action = sorted[i]!;
    lines.push(`${i + 1}. \`${action.command}\``);
    lines.push(`   Reason: ${action.reason}`);
    lines.push(`   Safety: ${action.safety}`);
    if (action.stateTransition) {
      lines.push(`   State transition: ${action.stateTransition.from} -> ${action.stateTransition.to}`);
    }
  }
  return lines.join("\n");
}

function renderTodoMergeSection(result: TaskForgeCommandResult): string {
  const lines = ["## Todo Merge Required"];
  for (const item of result.todoMerge.items) {
    const icon = item.action === "add" ? "+" : item.action === "remove" ? "-" : "~";
    lines.push(`- ${icon} ${item.taskId}: ${item.content}`);
  }
  return lines.join("\n");
}

function renderContextCleanupSection(result: TaskForgeCommandResult): string {
  const lines = ["## Context Cleanup"];
  if (result.contextCleanup.reason) {
    lines.push(`**Reason:** ${result.contextCleanup.reason}`);
  }
  for (const action of result.contextCleanup.actions) {
    lines.push(`- ${action}`);
  }
  return lines.join("\n");
}

function renderProhibitedActionsSection(result: TaskForgeCommandResult): string {
  const lines = ["## Prohibited Actions"];
  for (const action of result.prohibitedActions) {
    lines.push(`- \`${action.action}\` — ${action.reason}`);
  }
  return lines.join("\n");
}

function renderRecoverySection(result: TaskForgeCommandResult): string {
  const lines = ["## Recovery Guidance"];
  lines.push("Follow these steps to recover:");
  for (let i = 0; i < result.recovery.steps.length; i++) {
    lines.push(`${i + 1}. ${result.recovery.steps[i]}`);
  }
  if (result.recovery.createTaskBody) {
    lines.push(`\n**Task Body:**\n\n\`\`\`\n${result.recovery.createTaskBody}\n\`\`\``);
  }
  return lines.join("\n");
}

function renderAuditSection(result: TaskForgeCommandResult): string {
  const lines = ["## Audit and Trace"];
  if (result.audit) {
    if (result.audit.taskId) lines.push(`- **Task:** ${result.audit.taskId}`);
    if (result.audit.transcriptPath) lines.push(`- **Transcript:** ${result.audit.transcriptPath}`);
    if (result.audit.eventId) lines.push(`- **Event:** ${result.audit.eventId}`);
  }
  if (result.diagnostics.length > 0) {
    lines.push("\n**Diagnostics:**");
    for (const d of result.diagnostics) {
      const icon = d.level === "error" ? "🔴" : d.level === "warn" ? "🟡" : "🔵";
      lines.push(`${icon} ${d.message}`);
    }
  }
  return lines.join("\n");
}

/**
 * Render a TaskForgeCommandResult to JSON.
 * JSON is authoritative; Markdown must render same semantics.
 */
export function renderResultJson(result: TaskForgeCommandResult): string {
  return JSON.stringify(result, null, 2);
}
