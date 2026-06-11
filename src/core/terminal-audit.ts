import { summarizeTaskAudit } from "./audit.js";
import { summarizeTaskInvocations } from "./cli-audit.js";

export function buildTerminalAuditNotes(
  repoRoot: string,
  taskId: string,
  terminalState: "Done" | "Rejected",
): string[] {
  const auditSummary = summarizeTaskAudit(repoRoot, taskId);
  const invocationSummary = summarizeTaskInvocations(repoRoot, taskId);
  const notes = [
    `Terminal audit archived for ${terminalState}.`,
    `Audit events: ${auditSummary.totalEvents}; CLI invocations: ${invocationSummary.totalInvocations}; errors: ${auditSummary.errorCount}.`,
  ];

  if (auditSummary.firstEvent && auditSummary.lastEvent) {
    notes.push(`Audit window: ${auditSummary.firstEvent} -> ${auditSummary.lastEvent}.`);
  }

  if (auditSummary.durationMinutes !== undefined) {
    notes.push(`Observed duration: ${auditSummary.durationMinutes} minute(s).`);
  }

  if (invocationSummary.uniqueCommands.length > 0) {
    notes.push(`Commands observed: ${invocationSummary.uniqueCommands.join(", ")}.`);
  }

  return notes;
}
