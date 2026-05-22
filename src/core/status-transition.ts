const TRANSITIONS: Record<string, string[]> = {
  Inbox: ["Needs Spec", "Rejected"],
  "Needs Spec": ["Ready", "Deferred"],
  Ready: ["In Progress", "Blocked", "Deferred"],
  "In Progress": ["Review", "Verify", "Blocked", "Deferred"],
  Blocked: ["Ready", "In Progress"],
  Review: ["In Progress", "Verify", "Done"],
  Verify: ["In Progress", "Review", "Done"],
  Done: ["In Progress"],
  Rejected: [],
  Deferred: ["Ready"],
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
