import type { CommandResult } from "./command-states.js";

/**
 * Interface for pushing command guidance to agent frameworks.
 *
 * Implementations bridge CommandResult.nextAction and CommandResult.guidance
 * to the agent's task/todo system.
 */
export interface GuidanceAdapter {
  /**
   * Push guidance from a CommandResult to the agent framework.
   * Called after every command invocation.
   */
  pushGuidance(result: CommandResult): void;
}

/**
 * No-op implementation for CLI-only mode.
 * Does nothing — guidance is displayed to the terminal but not pushed
 * to any external system.
 */
export class NoOpGuidanceAdapter implements GuidanceAdapter {
  pushGuidance(_result: CommandResult): void {
    // Intentionally empty — CLI-only mode
  }
}

/**
 * OpenCode implementation that uses todowrite to add guidance
 * as todo items in the agent's todo list.
 *
 * This is a placeholder — in practice, OpenCode agents receive guidance
 * through the todowrite tool call, which is handled by the agent runtime.
 * This adapter exists to satisfy the interface contract.
 */
export class OpenCodeGuidanceAdapter implements GuidanceAdapter {
  pushGuidance(result: CommandResult): void {
    // In OpenCode, guidance is surfaced through the todowrite tool.
    // The agent runtime handles this automatically when the command
    // returns structured output with nextAction and guidance fields.
    // This adapter is a no-op here because todowrite is called directly
    // by the agent, not through this adapter.
    // The adapter exists to document the contract and allow other
    // frameworks to implement their own pushGuidance logic.
    void result;
  }
}

/**
 * Default guidance adapter used by CLI commands.
 * Returns NoOpGuidanceAdapter unless overridden by environment.
 */
export function getDefaultGuidanceAdapter(): GuidanceAdapter {
  const adapter = process.env.TASKFORGE_GUIDANCE_ADAPTER;
  switch (adapter) {
    case "opencode":
      return new OpenCodeGuidanceAdapter();
    case "noop":
    default:
      return new NoOpGuidanceAdapter();
  }
}
