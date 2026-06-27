import { STATUS } from "../util/status-constants.js";

// Canonical ten-status graph (TF-SIMP-02):
//   Inbox -> Needs Spec -> Ready -> In Progress -> Review -> Verify -> Done
// Blocked is reachable from Ready/In Progress; Deferred returns to Ready;
// Rejected is terminal. Review/Verify may step back (rework / verify failure),
// block, or defer. Legacy transport statuses were collapsed into Review/Verify.
const TRANSITIONS: Record<string, string[]> = {
  [STATUS.INBOX]: [STATUS.NEEDS_SPEC, STATUS.REJECTED],
  [STATUS.NEEDS_SPEC]: [STATUS.READY, STATUS.DEFERRED],
  [STATUS.READY]: [STATUS.IN_PROGRESS, STATUS.BLOCKED, STATUS.DEFERRED],
  [STATUS.IN_PROGRESS]: [STATUS.REVIEW, STATUS.BLOCKED, STATUS.DEFERRED],
  [STATUS.BLOCKED]: [STATUS.READY, STATUS.IN_PROGRESS],
  [STATUS.REVIEW]: [STATUS.VERIFY, STATUS.IN_PROGRESS, STATUS.BLOCKED, STATUS.DEFERRED],
  [STATUS.VERIFY]: [STATUS.DONE, STATUS.REVIEW, STATUS.BLOCKED, STATUS.DEFERRED],
  [STATUS.DONE]: [STATUS.IN_PROGRESS],
  [STATUS.REJECTED]: [],
  [STATUS.DEFERRED]: [STATUS.READY],
};

export function isValidTransition(
  from: string,
  to: string,
): boolean {
  const allowed = TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export function getAllowedTransitions(from: string): string[] {
  return TRANSITIONS[from] ?? [];
}

export function validateTransition(
  from: string,
  to: string,
): string | null {
  if (isValidTransition(from, to)) return null;
  const allowed = getAllowedTransitions(from);
  if (allowed.length === 0) {
    return `Cannot transition from "${from}" — terminal state`;
  }
  return `Cannot transition from "${from}" to "${to}". Allowed: ${allowed.join(", ")}`;
}
