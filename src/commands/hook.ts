import {
  runPreCommitLogic,
  runPrePushLogic,
  type PushRef,
} from "../core/hook-logic.js";
import { loadConfig } from "../core/config.js";
import { getRepoRoot } from "../util/paths.js";
import { logError, logSuccess } from "../util/logging.js";
import { writeResult } from "../util/write-command-result.js";
import { successResult, failedResult } from "../core/result-builder.js";

export interface HookOptions {
  json?: boolean;
}

/**
 * Hidden internals command that runs hook logic in TypeScript so the
 * enforcement (pre-commit, pre-push) is testable. The generated bash hooks
 * delegate here (see hooks.ts).
 *
 * Usage:
 *   taskforge _hook pre-commit
 *   taskforge _hook pre-push        # reads "<remote> <url>" args + refs on stdin
 */
export async function cmdHook(
  name: string,
  options: HookOptions = {},
): Promise<boolean> {
  const repoRoot = getRepoRoot();
  let ok: boolean;
  let reasons: string[];

  switch (name) {
    case "pre-commit": {
      const r = await runPreCommitLogic(repoRoot);
      ok = r.ok;
      reasons = r.reasons;
      break;
    }
    case "pre-push": {
      const refs = await readPushRefsFromStdin();
      const config = loadConfig(repoRoot);
      // Expected gates = runnable gates from config (typecheck/lint/build/test).
      // `requireCleanTree` is a precondition (checked separately in gates.ts),
      // not a gate that produces a pass/fail result, so exclude it — otherwise
      // every push would be blocked because gates.ts never records it in the stamp.
      const expectedGates = config?.gates
        ? Object.keys(config.gates).filter((g) => g !== "requireCleanTree")
        : undefined;
      const r = await runPrePushLogic(repoRoot, refs, {
        expectedGates,
        allowedBranches: config?.push?.allowedBranches,
      });
      ok = r.ok;
      reasons = r.reasons;
      break;
    }
    default:
      ok = false;
      reasons = [`Unknown hook: ${name}`];
  }

  if (options.json) {
    const result = ok
      ? successResult({ command: "_hook", guidance: `hook ${name}: ok` })
      : failedResult({
          command: "_hook",
          error: `hook ${name} blocked:\n${reasons.join("\n")}`,
          code: "HOOK_BLOCKED",
        });
    writeResult(result, options.json);
  } else if (ok) {
    logSuccess(`hook ${name}: ok`);
  } else {
    logError(`hook ${name} blocked:`);
    for (const reason of reasons) logError(`  ${reason}`);
  }

  return ok;
}

/**
 * Read pre-push ref lines from stdin. The git pre-push hook receives the
 * remote name and url as arguments and one "<local_ref> <local_sha>
 * <remote_ref> <remote_sha>" line per ref on stdin.
 */
async function readPushRefsFromStdin(): Promise<PushRef[]> {
  const input = await readStdin();
  const refs: PushRef[] = [];
  for (const line of input.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length === 4) {
      refs.push({
        local_ref: parts[0]!,
        local_sha: parts[1]!,
        remote_ref: parts[2]!,
        remote_sha: parts[3]!,
      });
    }
  }
  return refs;
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (c) => {
      data += c;
    });
    process.stdin.on("end", () => resolve(data));
    // Defensive: if no data arrives within a beat, resolve with what we have.
    setTimeout(() => resolve(data), 100);
  });
}
