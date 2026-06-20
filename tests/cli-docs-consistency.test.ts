import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { COMMAND_STATE_REGISTRY } from "../src/core/command-states.js";

/**
 * TASK-225: CLI/documentation consistency drift detection.
 *
 * These tests guard against docs drifting from the implemented CLI. When a
 * command is added, renamed, or removed in `src/cli.ts`, the docs and the
 * command-state registry must follow. When a `--force` path is introduced, it
 * must be authority-gated, and the docs must never recommend `--force` or raw
 * safety-bypassing git to normal agents.
 *
 * Authoritative ("live") docs are scanned for content checks. Historical design
 * snapshots under `specs/` (e.g. the historical full spec) are intentionally
 * excluded because they describe past behavior, not the current contract.
 */

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CLI_SRC = fs.readFileSync(path.join(ROOT, "src", "cli.ts"), "utf-8");

// ---------------------------------------------------------------------------
// CLI parsing helpers
// ---------------------------------------------------------------------------

function commandHead(spec: string): string {
  return spec.split(/\s+/)[0]!;
}

/**
 * Every command registered in `src/cli.ts`.
 *
 * Handles three registration forms:
 *   - `program\n.command("x")`
 *   - `const v = program.command("group")` (group variable)
 *   - `v\n.command("child")` (subcommand of a group)
 *
 * Hidden plumbing commands (leading "_", e.g. `_hook`) are excluded — they are
 * invoked by git hooks, not user-facing commands that need doc coverage.
 */
function registeredCliCommands(): string[] {
  const commands = new Set<string>();
  const groupVars = new Map<string, string>();

  for (const m of CLI_SRC.matchAll(/const\s+(\w+)\s*=\s*program\.command\("([^"]+)"/g)) {
    groupVars.set(m[1]!, commandHead(m[2]!));
  }
  for (const m of CLI_SRC.matchAll(/program\s*\n\s*\.command\("([^"]+)"/g)) {
    commands.add(commandHead(m[1]!));
  }
  for (const [variable, prefix] of groupVars) {
    const childRe = new RegExp(`${variable}\\s*\\n\\s*\\.command\\("([^"]+)"`, "g");
    for (const m of CLI_SRC.matchAll(childRe)) {
      commands.add(`${prefix} ${commandHead(m[1]!)}`);
    }
  }

  return [...commands].filter((c) => !c.startsWith("_")).sort();
}

/**
 * Commands that expose a `--force` option, parsed by tracking the enclosing
 * `.command("...")` block in `src/cli.ts`.
 */
function forceCommands(): string[] {
  const force = new Set<string>();
  let current: string | null = null;
  for (const line of CLI_SRC.split("\n")) {
    const cmdMatch = line.match(/\.command\("([^"]+)"/);
    if (cmdMatch) {
      current = commandHead(cmdMatch[1]!);
      continue;
    }
    if (current && /\.option\(\s*"--force"/.test(line)) {
      force.add(current);
    }
  }
  return [...force].sort();
}

// ---------------------------------------------------------------------------
// Doc parsing helpers
// ---------------------------------------------------------------------------

/**
 * A token is a subcommand (not an argument/placeholder) only when it is a
 * lowercase identifier. Arguments like `TASK-N`, `<taskId>`, `COMMAND` are
 * uppercase or placeholder tokens and must not be mistaken for subcommands.
 */
function isSubcommand(token: string | undefined): token is string {
  return !!token && /^[a-z][\w-]*$/.test(token);
}

function joinCommand(head: string, sub: string | undefined): string {
  return isSubcommand(sub) ? `${head} ${sub}` : head;
}

/**
 * Command names referenced in a doc's `taskforge <cmd>` mentions. Captures the
 * command head plus an optional lowercase subcommand (e.g. `guard status`,
 * `deps scan`) but ignores arguments and option flags.
 */
function docCommands(content: string): string[] {
  const cmds = new Set<string>();
  const re = /`taskforge\s+([a-zA-Z][\w-]*)(?:\s+([a-zA-Z][\w-]*))?/g;
  for (const m of content.matchAll(re)) {
    cmds.add(joinCommand(m[1]!, m[2]));
  }
  return [...cmds];
}

/**
 * Command names listed in the README command table. A table row looks like:
 *   | `taskforge <cmd> [ARGS] [--flag]` | description |
 */
function readmeTableCommands(): string[] {
  const readme = fs.readFileSync(path.join(ROOT, "specs", "README.md"), "utf-8");
  const cmds = new Set<string>();
  for (const line of readme.split("\n")) {
    const m = line.match(/^\|\s*`taskforge\s+([a-zA-Z][\w-]*)(?:\s+([a-zA-Z][\w-]*))?/);
    if (m) cmds.add(joinCommand(m[1]!, m[2]));
  }
  return [...cmds];
}

const ROOT_TASKFORGE_MD = fs.readFileSync(path.join(ROOT, "TASKFORGE.md"), "utf-8");

/** Authoritative docs whose content is checked for safety guidance. */
function liveDocs(): Array<[string, string]> {
  const paths = [
    "specs/README.md",
    "TASKFORGE.md",
    "docs/workflow.md",
    "docs/architecture/command-state-machine-and-invariants.md",
    "docs/architecture/command-return-contract.md",
    "AGENTS.md",
  ];
  return paths
    .filter((p) => fs.existsSync(path.join(ROOT, p)))
    .map((p) => [p, fs.readFileSync(path.join(ROOT, p), "utf-8")] as [string, string]);
}

// ---------------------------------------------------------------------------
// 1 & 3. CLI <-> README command table
// ---------------------------------------------------------------------------

describe("CLI <-> README command table", () => {
  it("every CLI command is documented in the README command table", () => {
    const readme = new Set(readmeTableCommands());
    const missing = registeredCliCommands().filter((c) => !readme.has(c));
    expect(missing, "CLI commands missing from specs/README.md command table").toEqual([]);
  });

  it("every README command exists in the CLI", () => {
    const cli = new Set(registeredCliCommands());
    const phantom = readmeTableCommands().filter((c) => !cli.has(c));
    expect(phantom, "README documents commands that are not registered in the CLI").toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. CLI -> TASKFORGE.md / README documentation coverage
// ---------------------------------------------------------------------------

describe("CLI documentation coverage", () => {
  it("every CLI command is listed or categorized in TASKFORGE.md or the README", () => {
    const documented = new Set([
      ...docCommands(ROOT_TASKFORGE_MD),
      ...readmeTableCommands(),
    ]);
    const missing = registeredCliCommands().filter((c) => !documented.has(c));
    expect(missing, "CLI commands with no documentation reference").toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. CLI -> command-state registry
// ---------------------------------------------------------------------------

describe("CLI -> command-state registry", () => {
  it("every CLI command has a CommandStateRule entry", () => {
    const missing = registeredCliCommands().filter((c) => !COMMAND_STATE_REGISTRY[c]);
    expect(missing, "CLI commands without a COMMAND_STATE_REGISTRY entry").toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. Force authority restrictions
// ---------------------------------------------------------------------------

describe("force commands are authority-gated", () => {
  it("every --force command gates via assertCanForce/canForce in its handler", () => {
    const commandsDir = path.join(ROOT, "src", "commands");
    const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".ts"));
    // Handler-file convention: <cmd>.ts or <cmd>-*.ts (e.g. cleanup -> cleanup-cmd.ts).
    const missing = forceCommands().filter((cmd) => {
      const candidates = files.filter((f) => {
        const base = f.replace(/\.ts$/, "");
        return base === cmd || base.startsWith(`${cmd}-`);
      });
      return !candidates.some((f) =>
        /\b(assertCanForce|canForce)\b/.test(
          fs.readFileSync(path.join(commandsDir, f), "utf-8"),
        ),
      );
    });
    expect(missing, "force commands lacking authority gating in their handler").toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 6. Docs must not recommend --force for normal agents
// ---------------------------------------------------------------------------

describe("docs do not recommend --force for normal agents", () => {
  it("live docs never give an unqualified recommendation to use --force", () => {
    // A line is only flagged when it looks like a positive instruction to use
    // --force AND carries no qualifying phrase restricting it to human/doctor
    // authority or explicitly prohibiting it.
    const qualifier =
      /(human|doctor|may not|do not use|don't use|never|not implemented|requires human|forbidden|not recommended|only|restricted)/i;
    const recommendation =
      /\b(use|using|run|running|pass|invoke|call)\b[^`]{0,60}--force|--force\b[^`]{0,40}\bto\s+(override|force|skip|bypass)/i;

    const violations: string[] = [];
    for (const [file, content] of liveDocs()) {
      for (const line of content.split("\n")) {
        if (!line.includes("--force")) continue;
        if (recommendation.test(line) && !qualifier.test(line)) {
          violations.push(`${file}: ${line.trim()}`);
        }
      }
    }
    expect(violations, "docs recommend --force without a human/doctor qualifier").toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 7. Docs must not recommend raw-git safety bypasses
// ---------------------------------------------------------------------------

describe("docs do not recommend raw-git safety bypasses", () => {
  it("live docs never recommend force-push, hard-reset, or --no-verify", () => {
    // "Bypass" = circumventing TaskForge safety controls (push protection, gate
    // enforcement). The sanctioned direct-git routine workflow (commit, push,
    // branch, worktree) is allowed; only dangerous circumventions are flagged.
    const dangerous =
      /git\s+push\s+(-f\b|--force(\b|-with-lease))|git\s+reset\s+--hard\b|git\s+(commit|push)\b[^`]{0,40}--no-verify/;
    const prohibition =
      /(never|do not|don't|must not|cannot|can't|prohibit|denied|blocked|not allowed|forbidden|hook-enforced|removed|deprecated)/i;

    const violations: string[] = [];
    for (const [file, content] of liveDocs()) {
      for (const line of content.split("\n")) {
        if (!dangerous.test(line)) continue;
        if (!prohibition.test(line)) {
          violations.push(`${file}: ${line.trim()}`);
        }
      }
    }
    expect(violations, "docs recommend a raw-git safety bypass").toEqual([]);
  });
});
