import fs from "node:fs";
import path from "node:path";
import { getTaskforgeDir } from "../util/paths.js";

const PENDING_PUBLISH_FILE = "pending-publish.json";

interface PendingEntry {
  id: string;
  title: string;
  filePath: string;
  createdAt: string;
}

interface PendingPublishData {
  pending: PendingEntry[];
}

function getPendingPublishPath(repoRoot: string): string {
  return path.join(getTaskforgeDir(repoRoot), PENDING_PUBLISH_FILE);
}

/**
 * Load the pending publish registry from disk.
 * Returns an empty array if the file doesn't exist or is corrupt.
 */
export function loadPendingPublish(repoRoot: string): PendingEntry[] {
  const filePath = getPendingPublishPath(repoRoot);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as PendingPublishData;
    if (Array.isArray(data.pending)) {
      return data.pending;
    }
    return [];
  } catch {
    return [];
  }
}

function savePendingPublish(repoRoot: string, entries: PendingEntry[]): void {
  const filePath = getPendingPublishPath(repoRoot);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const data: PendingPublishData = { pending: entries };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Add a task to the pending publish list.
 */
export function addPendingPublish(
  repoRoot: string,
  entry: { id: string; title: string; filePath: string },
): void {
  const entries = loadPendingPublish(repoRoot);
  // Avoid duplicates
  if (entries.some((e) => e.id === entry.id)) {
    return;
  }
  entries.push({
    id: entry.id,
    title: entry.title,
    filePath: entry.filePath,
    createdAt: new Date().toISOString(),
  });
  savePendingPublish(repoRoot, entries);
}

/**
 * Remove a task from the pending publish list by ID.
 */
export function removePendingPublish(repoRoot: string, taskId: string): void {
  const entries = loadPendingPublish(repoRoot);
  const filtered = entries.filter((e) => e.id !== taskId);
  if (filtered.length !== entries.length) {
    savePendingPublish(repoRoot, filtered);
  }
}

/**
 * Clear all pending publish entries.
 */
export function clearPendingPublish(repoRoot: string): void {
  savePendingPublish(repoRoot, []);
}

/**
 * Find a pending entry by task title (case-insensitive).
 */
export function findPendingByTitle(repoRoot: string, title: string): PendingEntry | undefined {
  const entries = loadPendingPublish(repoRoot);
  return entries.find((e) => e.title.toLowerCase() === title.toLowerCase());
}

/**
 * Get the total count of pending entries.
 */
export function pendingPublishCount(repoRoot: string): number {
  return loadPendingPublish(repoRoot).length;
}
