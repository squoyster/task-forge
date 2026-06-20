import { execa } from "execa";
import { loadConfig } from "../core/config.js";
import { logHeader, logDivider, logError, logSuccess, logInfo } from "../util/logging.js";
import { getRepoRoot } from "../util/paths.js";
import { writeResult } from "../util/write-command-result.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { gatesStateMachine } from "../core/command-states.js";
import { getDefaultGuidanceAdapter } from "../core/guidance-adapter.js";
import {
  isCleanTree,
  headSha,
  writeGateStamp,
  runnerSession,
} from "../core/gate-stamp.js";

export interface GatesOptions {
  only?: string;
  json?: boolean;
}

export interface GateResult {
  name: string;
  command: string;
  passed: boolean;
  duration: number;
}

/**
 * Run gates and return results without printing output.
 *
 * Requires a clean working tree so the gate stamp (written on all-pass) binds
 * to an exact commit. On a dirty tree, returns `{ passed: false, error }`
 * without running any gate.
 */
export async function runGates(
  options?: GatesOptions,
): Promise<{ passed: boolean; results: GateResult[]; error?: string }> {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);

  // Require a clean working tree so the gate stamp binds to an exact HEAD.
  // Skippable via config gates.requireCleanTree (default true).
  if (config.gates?.requireCleanTree ?? true) {
    const { clean, porcelain } = await isCleanTree(repoRoot);
    if (!clean) {
      const sample = porcelain
        .split("\n")
        .slice(0, 10)
        .join("\n");
      return {
        passed: false,
        results: [],
        error:
          "Working tree is dirty. Commit or stash before gating — gates validate a specific tree.\n" +
          "Uncommitted changes:\n" +
          sample,
      };
    }
  }

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
    return {
      passed: false,
      results: [],
      error: `Unknown gate(s): ${invalidGates.join(", ")}`,
    };
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

  // On all-pass, stamp the exact HEAD so the pre-push hook can verify the
  // pushed commit was gated. The stamp is gitignored (local only).
  if (allPassed) {
    const sha = await headSha(repoRoot);
    writeGateStamp(repoRoot, {
      commit_sha: sha,
      gates: Object.fromEntries(results.map((r) => [r.name, r.passed])),
      timestamp: new Date().toISOString(),
      runner_session: runnerSession(),
    });
  }

  return { passed: allPassed, results };
}

export async function cmdGates(options?: GatesOptions): Promise<boolean> {
  const { passed, results, error } = await runGates(options);

  // Surface pre-gate aborts (dirty tree, unknown gate) without running anything.
  if (error) {
    if (options?.json) {
      writeResult(
        failedResult({ command: "gates", error, code: "GATES_ABORTED" }),
        options.json,
      );
    } else {
      logHeader("# TaskForge Gates");
      logDivider();
      logError(error);
    }
    return false;
  }

  const failedGates = results
    .filter((r) => !r.passed)
    .map((r) => ({ name: r.name, command: r.command }));

  const result = gatesStateMachine({
    totalGates: results.length,
    passedGates: results.filter((r) => r.passed).length,
    failedGates,
  });
  getDefaultGuidanceAdapter().pushGuidance(result);

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
    logInfo(result.guidance);
  } else {
    writeResult(successResult({
      command: "gates",
      guidance: result.guidance,
    }), options.json);
  }

  return passed;
}