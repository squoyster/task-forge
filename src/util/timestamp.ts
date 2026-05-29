/**
 * Timestamp formatting utilities with explicit timezone indicators.
 * 
 * All timestamps are stored and displayed in UTC with explicit 'Z' designator
 * to avoid confusion about timezone.
 */

/**
 * Format a Date or timestamp string for JSON output.
 * Returns ISO 8601 format with 'Z' designator (e.g., "2024-01-01T00:00:00Z").
 */
export function formatTimestampJson(date: Date | string | undefined | null): string {
  if (!date) return "";
  if (date instanceof Date) {
    return date.toISOString();
  }
  // If already a valid ISO string with Z, return as-is
  if (date.endsWith("Z")) return date;
  // Parse and re-format to ensure Z suffix
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return date; // Return original if unparseable
  return parsed.toISOString();
}

/**
 * Format a Date or timestamp string for Markdown/human-readable output.
 * Returns ISO 8601 format with 'Z' designator (e.g., "2024-01-01T00:00:00Z").
 */
export function formatTimestampMarkdown(date: Date | string | undefined | null): string {
  return formatTimestampJson(date);
}

/**
 * Format a timestamp for agent notes with date and time.
 * Returns format: "2024-01-01T00:00:00Z" for consistency and auditability.
 */
export function formatAgentNoteTimestamp(date: Date | string | undefined | null): string {
  return formatTimestampJson(date);
}

/**
 * Format a timestamp for task frontmatter (claimed_at, blocked_since, etc.).
 * Returns ISO 8601 format with 'Z' designator for storage consistency.
 */
export function formatTaskTimestamp(date: Date | string | undefined | null): string {
  return formatTimestampJson(date);
}

/**
 * Parse a timestamp string that may be in various formats and return a Date.
 * Handles: ISO 8601 with Z, space-separated datetime, and other common formats.
 */
export function parseTimestamp(value: string | undefined | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}
