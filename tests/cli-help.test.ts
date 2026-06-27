import { describe, it, expect } from "vitest";
import { execa } from "execa";
import path from "node:path";

// TF-SIMP-05: contract test for command classification.
// Default help exposes only the entry surface; hidden commands stay callable
// but are not advertised; sync/deps/mcp are opt-in and absent by default.
const CLI = path.resolve(__dirname, "..", "src", "cli.ts");

const VISIBLE = [
  "init", "next", "prompt", "inspect", "list",
  "new", "update", "gates", "validate-state", "doctor",
];
const HIDDEN = [
  "claim", "heartbeat", "release", "block", "promote", "done", "reject",
  "status", "summary", "unlock", "sweep", "agents", "report",
  "audit", "transcript", "timeline", "ac-check", "config-validate", "guard",
];
const OPT_IN = ["sync", "deps", "mcp"];

async function runCli(...args: string[]): Promise<string> {
  const res = await execa("node", ["--import", "tsx", CLI, ...args], {
    reject: false,
  });
  return res.stdout + res.stderr;
}

describe("TF-SIMP-05: CLI command classification", () => {
  it("default --help exposes only the 10 core commands", async () => {
    const help = await runCli("--help");

    for (const cmd of VISIBLE) {
      expect(help, `visible command '${cmd}' should appear in --help`).toContain(cmd);
    }
  });

  it("default --help omits hidden commands", async () => {
    const help = await runCli("--help");

    for (const cmd of HIDDEN) {
      expect(help, `hidden command '${cmd}' must not appear in --help`).not.toContain(`\n  ${cmd} `);
    }
  });

  it("default --help omits opt-in commands (sync/deps/mcp)", async () => {
    const help = await runCli("--help");

    for (const cmd of OPT_IN) {
      expect(help, `opt-in command '${cmd}' must not appear in --help by default`).not.toContain(`\n  ${cmd} `);
    }
  });

  it("hidden commands remain callable", async () => {
    // A hidden command still responds to --help (exit 0, shows usage).
    const out = await runCli("status", "--help");
    expect(out).toContain("Show project status summary");
  });

  it("opt-in commands are absent unless their env var is set", async () => {
    // mcp without TASKFORGE_WITH_MCP falls through to top-level help.
    const out = await runCli("mcp", "--help");
    expect(out).toContain("TaskForge Autonomous Coding Board CLI");
    expect(out).not.toContain("Model Context Protocol");
  });
});
