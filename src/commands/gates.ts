import { execa } from "execa";
import { loadConfig } from "../core/config.js";
import { logHeader, logDivider, logError, logSuccess } from "../util/logging.js";
import { getRepoRoot } from "../util/paths.js";
import { printJson } from "../util/json-result.js";
import { envelopeOk } from "../core/envelope.js";

export interface GatesOptions {
  only?: string;
  json?: boolean;
  classifyUpstream?: string;
}

export interface GateResult {
  name: string;
  command: string;
  passed: boolean;
  duration: number;
}

/**
 * Run gates and return results without printing output.
 */
export async function runGates(options?: GatesOptions): Promise<{ passed: boolean; results: GateResult[] }> {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);

  const availableGates: Record<string, string> = {
    typecheck: config.gates?.typecheck ?? "npm run typecheck",
    lint: config.gates?.lint ?? "npm run lint",
    build: config.gates?.build ?? "npm run build",
    test: config.gates?.test ?? "npm test -- --run",
  };

  let gateNames: string[];
  if (options?.only) {
    gateNames = options.only.split(",").map((g) => g.trim());
  } else {
    gateNames = Object.keys(availableGates);
  }

  const invalidGates = gateNames.filter((g) => !(g in availableGates));
  if (invalidGates.length > 0) {
    return { passed: false, results: [] };
  }

  const results: GateResult[] = [];
  let allPassed = true;

  for (const name of gateNames) {
    const command = availableGates[name]!;
    const start = process.hrtime.bigint();

    try {
      await execa(command, { shell: true, cwd: repoRoot });
      const duration = Number(process.hrtime.bigint() - start) / 1e6;
      results.push({ name, command, passed: true, duration });
    } catch {
      const duration = Number(process.hrtime.bigint() - start) / 1e6;
      results.push({ name, command, passed: false, duration });
      allPassed = false;
    }
  }

  return { passed: allPassed, results };
}

export async function cmdGates(options?: GatesOptions): Promise<boolean> {
  const { passed, results } = await runGates(options);

  if (!options?.json) {
    logHeader("# TaskForge Gates");
    logDivider();
    for (const r of results) {
      if (r.passed) {
        logSuccess(`✓ ${r.name} (${r.duration.toFixed(0)}ms): ${r.command}`);
      } else {
        logError(`✗ ${r.name} (${r.duration.toFixed(0)}ms): ${r.command}`);
      }
    }
    logDivider();
    if (passed) {
      logSuccess(`All ${results.length} gate(s) passed.`);
    } else {
      const failedCount = results.filter((r) => !r.passed).length;
      logError(`${failedCount}/${results.length} gate(s) failed.`);
    }
  } else {
    if (passed) {
      printJson(envelopeOk(
        "gates_passed",
        {
          gates: results.map((r) => ({
            name: r.name,
            command: r.command,
            passed: r.passed,
            duration: r.duration,
          })),
          allPassed: passed,
        },
        {
          kind: "CONTINUE",
          instruction: "All gates passed. Proceed with next steps.",
          stop: false,
          allowedCommands: ["taskforge done", "taskforge block", "taskforge checkpoint"],
        },
      ));
    } else if (options?.classifyUpstream) {
      printJson({
        ok: false,
        state: "gates_failed_upstream",
        data: {
          gates: results.map((r) => ({
            name: r.name,
            command: r.command,
            passed: r.passed,
            duration: r.duration,
          })),
          allPassed: passed,
          upstreamReason: options.classifyUpstream,
        },
        nextAction: {
          kind: "CREATE_BUG_TASK_AND_CONTINUE",
          instruction: `Classified as upstream failure: ${options.classifyUpstream}. Create a bug task and continue only if safe.`,
          stop: false,
          allowedCommands: ["taskforge new", "taskforge gates"],
        },
      });
    } else {
      printJson({
        ok: false,
        state: "gates_failed",
        data: {
          gates: results.map((r) => ({
            name: r.name,
            command: r.command,
            passed: r.passed,
            duration: r.duration,
          })),
          allPassed: passed,
        },
        nextAction: {
          kind: "FIX_CURRENT_TASK",
          instruction: "Fix local failures and rerun gates before proceeding.",
          stop: true,
          allowedCommands: ["taskforge gates"],
        },
      });
    }
  }

  return passed;
}