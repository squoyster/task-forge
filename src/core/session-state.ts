import fs from "node:fs";
import path from "node:path";

export interface SessionState {
  session_id: string;
  task_id: string;
  claimed_at: string;
  worktree_path: string;
  last_heartbeat: string;
}

const SESSION_FILE = ".taskforge-session.json";

/**
 * Write the session state file to the worktree directory.
 */
export function writeSessionState(worktreePath: string, state: SessionState): void {
  const filePath = path.join(worktreePath, SESSION_FILE);
  // Ensure the directory exists (worktree may not be fully set up yet)
  if (!fs.existsSync(worktreePath)) {
    fs.mkdirSync(worktreePath, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

/**
 * Read the session state file from the worktree directory.
 * Returns null if the file doesn't exist or is invalid.
 */
export function readSessionState(worktreePath: string): SessionState | null {
  const filePath = path.join(worktreePath, SESSION_FILE);
  if (!fs.existsSync(filePath)) return null;

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content) as SessionState;
    if (parsed.session_id && parsed.task_id) return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * Remove the session state file from the worktree directory.
 */
export function removeSessionState(worktreePath: string): void {
  const filePath = path.join(worktreePath, SESSION_FILE);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Update the last_heartbeat timestamp in the session state file.
 */
export function updateSessionHeartbeat(worktreePath: string): void {
  const state = readSessionState(worktreePath);
  if (!state) return;

  state.last_heartbeat = new Date().toISOString();
  writeSessionState(worktreePath, state);
}
