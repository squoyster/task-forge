/**
 * Standard command feedback contract that tells agents what to do next.
 */
export interface CommandResultEnvelope<T = unknown> {
  ok: boolean;
  state: string;
  data?: T;
  nextAction: {
    kind: string;
    instruction: string;
    stop: boolean;
    allowedCommands: string[];
  };
}

/**
 * Create a success envelope with a next action.
 */
export function envelopeOk<T>(
  state: string,
  data: T,
  nextAction: CommandResultEnvelope<T>["nextAction"],
): CommandResultEnvelope<T> {
  return {
    ok: true,
    state,
    data,
    nextAction,
  };
}

/**
 * Create an error envelope with a stopping next action.
 */
export function envelopeError(
  state: string,
  instruction: string,
): CommandResultEnvelope<never> {
  return {
    ok: false,
    state,
    nextAction: {
      kind: "error",
      instruction,
      stop: true,
      allowedCommands: [],
    },
  };
}
