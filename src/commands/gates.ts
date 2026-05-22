import { execa } from "execa";
import { loadConfig } from "../core/config.js";
import { logHeader, logDivider, logInfo, logError, logSuccess } from "../util/logging.js";
import { getRepoRoot } from "../util/paths.js";
import { printJson, jsonOk } from "../util/json-result.js";

export interface GatesOptions {
  only?: string;
  json?: boolean;
}

interface GateResult {
  name: string;
  command: string;
  passed: boolean;
  duration: number;
}

export async function cmdGates(options?: GatesOptions): Promise<boolean> {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);

  // Gate name → command mapping, in default execution order
  const availableGates: Record<string, string> = {
    typecheck: config.gates?.typecheck ?? "npm run typecheck",
    lint: config.gates?.lint ?? "npm run lint",
    build: config.gates?.build ?? "npm run build",
    test: config.gates?.test ?? "npm test -- --run",
  };

  // Filter to requested subset
  let gateNames: string[];
  if (options?.only) {
    gateNames = options.only.split(",").map((g) => g.trim());
  } else {
    gateNames = Object.keys(availableGates);
  }

  // Validate gate names
  const invalidGates = gateNames.filter((g) => !(g in availableGates));
  if (invalidGates.length > 0) {
    if (options?.json) {
      printJson(jsonOk({
        gates: [],
        error: `Unknown gates: ${invalidGates.join(", ")}. Available: ${Object.keys(availableGates).join(", ")}`,
      }));
      return false;
    }
    logError(`Unknown gates: ${invalidGates.join(", ")}`);
    logInfo(`Available gates: ${Object.keys(availableGates).join(", ")}`);
    return false;
  }

  const results: GateResult[] = [];

  if (!options?.json) {
    logHeader("# TaskForge Gates");
    logDivider();
  }

  let allPassed = true;

  for (const name of gateNames) {
    const command = availableGates[name]!;
    const start = process.hrtime.bigint();

    try {
      await execa(command, { shell: true, cwd: repoRoot });
      const duration = Number(process.hrtime.bigint() - start) / 1e6;
      results.push({ name, command, passed: true, duration });
      if (!options?.json) {
        logSuccess(`✓ ${name} (${duration.toFixed(0)}ms): ${command}`);
      }
    } catch (err) {
      const duration = Number(process.hrtime.bigint() - start) / 1e6;
      results.push({ name, command, passed: false, duration });
      allPassed = false;
      if (!options?.json) {
        logError(`✗ ${name} (${duration.toFixed(0)}ms): ${command}`);
        if (err instanceof Error && err.message) {
          logError(`   ${err.message}`);
        }
      }
    }
  }

  // Output
  if (options?.json) {
    printJson(jsonOk({
      gates: results.map((r) => ({
        name: r.name,
        command: r.command,
        passed: r.passed,
        duration: r.duration,
      })),
      allPassed,
    }));
  } else {
    logDivider();
    if (allPassed) {
      logSuccess(`All ${results.length} gate(s) passed.`);
    } else {
      const failedCount = results.filter((r) => !r.passed).length;
      logError(`${failedCount}/${results.length} gate(s) failed.`);
    }
  }

  return allPassed;
}