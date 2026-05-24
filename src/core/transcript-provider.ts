import type { AuditEvent } from "./audit-schema.js";

/**
 * Generic interface for importing or appending session transcript events
 * independent of any specific agent framework (OpenCode, etc.).
 */
export interface TranscriptProvider {
  /**
   * Append a transcript event for a specific task.
   */
  appendEvent(taskId: string, event: AuditEvent): void;

  /**
   * Read all transcript events for a task.
   */
  readEvents(taskId: string): AuditEvent[];

  /**
   * Import a batch of transcript events for a task.
   */
  importEvents(taskId: string, events: AuditEvent[]): void;
}
