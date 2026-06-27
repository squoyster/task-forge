import { describe, it, expect } from "vitest";
import { installAgentFiles } from "../src/core/agent-files.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("installAgentFiles", () => {
  it("creates all agent role files", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-agents-"));
    installAgentFiles(tmp, false);

    const agentsDir = path.join(tmp, ".opencode", "agents");
    expect(fs.existsSync(path.join(agentsDir, "implementer.md"))).toBe(true);
    expect(fs.existsSync(path.join(agentsDir, "reviewer.md"))).toBe(true);
    expect(fs.existsSync(path.join(agentsDir, "qa.md"))).toBe(true);
    expect(fs.existsSync(path.join(agentsDir, "doctor.md"))).toBe(true);

    const impl = fs.readFileSync(path.join(agentsDir, "implementer.md"), "utf-8");
    expect(impl).toContain("taskforge claim TASK-ID");
    expect(impl).toContain("taskforge done TASK-ID");

    const doc = fs.readFileSync(path.join(agentsDir, "doctor.md"), "utf-8");
    expect(doc).toContain("taskforge doctor --check");
    expect(doc).toContain("git push --force");

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("dry-run does not write files", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-agents-"));
    installAgentFiles(tmp, true);
    expect(fs.existsSync(path.join(tmp, ".opencode"))).toBe(false);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("updates existing files idempotently", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-agents-"));
    installAgentFiles(tmp, false);
    const first = fs.readFileSync(path.join(tmp, ".opencode", "agents", "implementer.md"), "utf-8");

    installAgentFiles(tmp, false);
    const second = fs.readFileSync(path.join(tmp, ".opencode", "agents", "implementer.md"), "utf-8");

    expect(second).toBe(first);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
