import { runSweeperAndPrint } from "../core/sweeper.js";

/**
 * CLI command: run the Sweeper Protocol manually.
 * The core logic lives in src/core/sweeper.ts.
 */
export async function cmdSweep(): Promise<void> {
  await runSweeperAndPrint();
}
