import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { COMMAND_STATE_REGISTRY } from "../src/core/command-states.js";
import { STANDARD_PROHIBITED_ACTIONS } from "../src/core/command-result.js";
import { DENIED_GIT_COMMANDS, getReplacement } from "../src/core/mutation-guard.js";

/**
 * TF-SIMP-01 contract: the git facade commands `checkpoint`, `submit`, `diff`,
 * and `pr` were removed (TASK-312). No guidance emitted to agents — neither
 * structured next actions, prohibited-action metadata, mutation-guard
 * replacement suggestions, generator output, nor authoritative docs — may name
 * them. The chief regression risk is replacing prose while leaving a structured
 * `nextActions[].command` stale.
 */
const REMOVED = ["checkpoint", "submit", "diff", "pr"] as const;
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

function removedIn(text: string): string[] {
  return REMOVED.filter((c) => new RegExp(`\\btaskforge ${c}\\b`).test(text));
}

describe("TF-SIMP-01: no stale git-facade command guidance", () => {
  // Structured next actions + prohibited actions + mutation-guard suggestions
  // are the dynamically-emitted guidance an agent reads from a CommandResult.
  it("runtime-emitted structured guidance names no removed command", () => {
    const violations: string[] = [];

    for (const [name, rule] of Object.entries(COMMAND_STATE_REGISTRY)) {
      for (const a of rule.nextActions) {
        for (const field of [a.command, a.reason]) {
          const hits = removedIn(field);
          if (hits.length) violations.push(`${name}.nextActions "${field}" → ${hits.join(",")}`);
        }
      }
      for (const [code, actions] of Object.entries(rule.errorActions)) {
        for (const a of actions) {
          for (const field of [a.command, a.reason]) {
            const hits = removedIn(field);
            if (hits.length) violations.push(`${name}.errorActions[${code}] "${field}" → ${hits.join(",")}`);
          }
        }
      }
    }

    for (const p of STANDARD_PROHIBITED_ACTIONS) {
      const hits = removedIn(`${p.action} ${p.reason}`);
      if (hits.length) violations.push(`prohibitedActions ${p.action} → ${hits.join(",")}`);
    }

    for (const denied of DENIED_GIT_COMMANDS) {
      const r = getReplacement(denied);
      if (r) {
        const hits = removedIn(r);
        if (hits.length) violations.push(`mutation-guard ${denied} → ${hits.join(",")}`);
      }
    }

    expect(violations, "emitted structured guidance references removed facade commands").toEqual([]);
  });

  // Static scan of guidance-emitting source + authoritative docs. These strings
  // reach agents (generated agent files, guard plugin, rendered guidance) but do
  // not all flow through the registries above, so they are scanned textually.
  const STATIC_FILES = [
    "src/core/command-states.ts",
    "src/core/command-result.ts",
    "src/core/mutation-guard.ts",
    "src/core/guard-plugin.ts",
    "src/core/agent-files.ts",
    "src/core/agents-md.ts",
    "src/core/next-command-maps.ts",
    "src/core/completion-policy.ts",
    "src/commands/next.ts",
    "src/commands/resume.ts",
    "docs/architecture/command-return-contract.md",
    "docs/architecture/command-state-machine-and-invariants.md",
    "docs/next-action-semantics.md",
    "docs/deployment/container-runtime.md",
    "specs/AGENTS.md",
  ];

  it("guidance-emitting source and authoritative docs name no removed command", () => {
    const violations: string[] = [];
    for (const rel of STATIC_FILES) {
      const content = fs.readFileSync(path.join(ROOT, rel), "utf-8");
      for (const c of removedIn(content)) violations.push(`${rel}: taskforge ${c}`);
    }
    expect(violations, "files still reference removed facade commands").toEqual([]);
  });
});
