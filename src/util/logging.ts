import type { NextAction } from "../core/command-result.js";

export function logInfo(msg: string): void {
  console.log(msg);
}

export function logWarn(msg: string): void {
  console.warn(`\x1b[33mWarning:\x1b[0m ${msg}`);
}

export function logError(msg: string): void {
  console.error(`\x1b[31mError:\x1b[0m ${msg}`);
}

export function logSuccess(msg: string): void {
  console.log(`\x1b[32m${msg}\x1b[0m`);
}

export function logHeader(msg: string): void {
  console.log(`\n\x1b[1m${msg}\x1b[0m`);
}

export function logSub(msg: string): void {
  console.log(`  ${msg}`);
}

export function logDivider(): void {
  console.log("");
}

export function printNextActions(actions: NextAction[]): void {
  if (actions.length === 0) {
    return;
  }

  logInfo("Valid next actions:");
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]!;
    logSub(`${i + 1}. ${action.command}`);
    logSub(`   Reason: ${action.reason}`);
    logSub(`   Safety: ${action.safety}`);
    if (action.stateTransition) {
      logSub(`   State transition: ${action.stateTransition.from} -> ${action.stateTransition.to}`);
    }
  }
}
