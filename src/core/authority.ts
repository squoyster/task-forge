/**
 * Authority model for force operations.
 *
 * Normal agents may never use --force. Force is reserved for:
 * - human operators (via TASKFORGE_ACTOR=human env var),
 * - doctor-mode recovery (via TASKFORGE_ACTOR=doctor env var).
 */

export type ActorAuthority = "agent" | "human" | "doctor";

/**
 * Resolve the current actor's authority level.
 *
 * Priority:
 * 1. TASKFORGE_ACTOR env var (human | doctor)
 * 2. Default: agent
 */
export function resolveAuthority(env: NodeJS.ProcessEnv = process.env): ActorAuthority {
  const actor = env.TASKFORGE_ACTOR;
  if (actor === "human") return "human";
  if (actor === "doctor") return "doctor";
  return "agent";
}

/**
 * Assert that the current authority is allowed to perform force operations.
 *
 * Throws ForceRequiresHumanOrDoctorError if authority is "agent".
 */
export function assertCanForce(authority: ActorAuthority): void {
  if (authority === "agent") {
    throw new ForceRequiresHumanOrDoctorError();
  }
}

/**
 * Check if force is allowed for the current authority.
 * Returns true if force can proceed, false if rejected.
 */
export function canForce(authority: ActorAuthority): boolean {
  return authority !== "agent";
}

/**
 * Build nextActions for force rejection responses.
 */
export function getForceRejectionNextActions(taskId?: string): Array<{ command: string; reason: string; safety: "safe" | "requires_human" | "doctor_only" | "blocked"; preferred: boolean }> {
  const actions: Array<{ command: string; reason: string; safety: "safe" | "requires_human" | "doctor_only" | "blocked"; preferred: boolean }> = [
    {
      command: "taskforge doctor --json",
      reason: "Diagnose whether a recovery path exists.",
      safety: "safe",
      preferred: true,
    },
  ];
  if (taskId) {
    actions.push({
      command: `taskforge block ${taskId} "Force operation requires human or doctor-mode authorization" --category unsafe_operation --blocked-by human`,
      reason: "Escalate unsafe operation without bypassing TaskForge.",
      safety: "requires_human",
      preferred: false,
    });
  }
  return actions;
}

export class ForceRequiresHumanOrDoctorError extends Error {
  code = "FORCE_REQUIRES_HUMAN_OR_DOCTOR";
  exitCode = 1;

  constructor() {
    super("Normal agents may not use --force. Use 'taskforge doctor --json' or block for human authorization.");
  }
}
