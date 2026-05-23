import { describe, it, expect } from "vitest";
import { installAgentsMd } from "../src/core/agents-md.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tf-agents-"));
}

describe("installAgentsMd", () => {
  it("creates AGENTS.md when it does not exist", () => {
    const tmp = makeTempDir();
    installAgentsMd(tmp, false);
    const content = fs.readFileSync(path.join(tmp, "AGENTS.md"), "utf-8");
    expect(content).toContain("<!-- TASKFORGE:BEGIN managed-agent-policy -->");
    expect(content).toContain("## TaskForge Managed Policy");
    expect(content).toContain("<!-- TASKFORGE:END managed-agent-policy -->");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("inserts managed block into existing AGENTS.md", () => {
    const tmp = makeTempDir();
    fs.writeFileSync(path.join(tmp, "AGENTS.md"), "# My Custom Agents\n\nCustom instructions here.\n");
    installAgentsMd(tmp, false);
    const content = fs.readFileSync(path.join(tmp, "AGENTS.md"), "utf-8");
    expect(content).toContain("# My Custom Agents");
    expect(content).toContain("Custom instructions here.");
    expect(content).toContain("<!-- TASKFORGE:BEGIN managed-agent-policy -->");
    expect(content).toContain("<!-- TASKFORGE:END managed-agent-policy -->");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("replaces existing managed block on re-run", () => {
    const tmp = makeTempDir();
    installAgentsMd(tmp, false);
    const first = fs.readFileSync(path.join(tmp, "AGENTS.md"), "utf-8");

    installAgentsMd(tmp, false);
    const second = fs.readFileSync(path.join(tmp, "AGENTS.md"), "utf-8");
    expect(second).toBe(first);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("does not duplicate managed block", () => {
    const tmp = makeTempDir();
    installAgentsMd(tmp, false);
    installAgentsMd(tmp, false);
    const content = fs.readFileSync(path.join(tmp, "AGENTS.md"), "utf-8");
    const beginCount = (content.match(/<!-- TASKFORGE:BEGIN managed-agent-policy -->/g) ?? []).length;
    expect(beginCount).toBe(1);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("dry-run does not write files", () => {
    const tmp = makeTempDir();
    installAgentsMd(tmp, true);
    expect(fs.existsSync(path.join(tmp, "AGENTS.md"))).toBe(false);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("preserves user content before and after managed block", () => {
    const tmp = makeTempDir();
    const original = "# Title\n\nUser content at top.\n\n## Section\n\nMore content.\n";
    fs.writeFileSync(path.join(tmp, "AGENTS.md"), original);
    installAgentsMd(tmp, false);
    const content = fs.readFileSync(path.join(tmp, "AGENTS.md"), "utf-8");
    expect(content).toContain("User content at top.");
    expect(content).toContain("More content.");
    expect(content).toContain("<!-- TASKFORGE:BEGIN managed-agent-policy -->");
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
