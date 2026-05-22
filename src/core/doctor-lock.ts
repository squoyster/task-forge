import fs from "node:fs";
import path from "node:path";
import { getTaskStateDir, getRepoRoot } from "../util/paths.js";

const LOCK_FILENAME = ".doctor-lock";
const DEFAULT_TTL_HOURS = 1;

interface DoctorLockData {
  reason: string;
  created: string;
  ttl_hours: number;
  recoveryTaskId?: string;
}

function getLockPath(repoRoot?: string): string {
  return path.join(getTaskStateDir(repoRoot ?? getRepoRoot()), LOCK_FILENAME);
}

export function createDoctorLock(
  reason: string,
  options?: { ttlHours?: number; recoveryTaskId?: string; repoRoot?: string },
): void {
  const lockPath = getLockPath(options?.repoRoot);
  const data: DoctorLockData = {
    reason,
    created: new Date().toISOString(),
    ttl_hours: options?.ttlHours ?? DEFAULT_TTL_HOURS,
    recoveryTaskId: options?.recoveryTaskId,
  };
  fs.writeFileSync(lockPath, JSON.stringify(data, null, 2), "utf-8");
}

export function removeDoctorLock(repoRoot?: string): void {
  const lockPath = getLockPath(repoRoot);
  if (fs.existsSync(lockPath)) {
    fs.unlinkSync(lockPath);
  }
}

export function isDoctorLocked(repoRoot?: string): { locked: boolean; reason?: string; expired?: boolean } {
  const lockPath = getLockPath(repoRoot);
  if (!fs.existsSync(lockPath)) return { locked: false };

  try {
    const raw = fs.readFileSync(lockPath, "utf-8");
    const data: DoctorLockData = JSON.parse(raw);

    const created = new Date(data.created).getTime();
    const now = Date.now();
    const ttlMs = (data.ttl_hours ?? DEFAULT_TTL_HOURS) * 60 * 60 * 1000;

    if (now - created > ttlMs) {
      return { locked: false, reason: data.reason, expired: true };
    }

    return { locked: true, reason: data.reason };
  } catch {
    return { locked: false };
  }
}
