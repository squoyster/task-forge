import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { installAgentsMd } from "../src/core/agents-md.js";
import { installOpenCodeConfig } from "../src/core/opencode-config.js";
import { installAgentFiles } from "../src/core/agent-files.js";
import { installGitHooks } from "../src/core/hooks.js";

describe("init integration — OpenCode managed policy", () => {
  it("generates all required files with managed policy", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-int-"));

    installAgentsMd(tmp, false);
    installOpenCodeConfig(tmp, "managed", true, true, false);
    installAgentFiles(tmp, false);
    installGitHooks({ projectRoot: tmp, dryRun: false, installHooks: true });

    expect(fs.existsSync(path.join(tmp, "AGENTS.md"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "opencode.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, ".opencode", "agents", "implementer.md"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, ".opencode", "agents", "doctor.md"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, ".taskforge", "hooks", "pre-commit"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, ".taskforge", "hooks", "pre-push"))).toBe(true);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("does not duplicate managed blocks when init runs twice", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-int-"));

    installAgentsMd(tmp, false);
    installAgentsMd(tmp, false);

    const content = fs.readFileSync(path.join(tmp, "AGENTS.md"), "utf-8");
    const count = (content.match(/TASKFORGE:BEGIN managed-agent-policy/g) ?? []).length;
    expect(count).toBe(1);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("preserves existing opencode.json provider config when merging", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-int-"));

    const existingOpenCode = { providers: { openai: { apiKey: "sk-test123" } }, theme: "dark" };
    fs.writeFileSync(path.join(tmp, "opencode.json"), JSON.stringify(existingOpenCode));

    installOpenCodeConfig(tmp, "managed", true, true, false);

    const merged = JSON.parse(fs.readFileSync(path.join(tmp, "opencode.json"), "utf-8"));
    expect(merged.providers.openai.apiKey).toBe("sk-test123");
    expect(merged.theme).toBe("dark");
    expect(merged.taskforge.managed).toBe(true);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("generates correct permissions in opencode.json", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-int-"));
    installOpenCodeConfig(tmp, "managed", true, true, false);

    const config = JSON.parse(fs.readFileSync(path.join(tmp, "opencode.json"), "utf-8"));
    const bash = config.permission.bash as Record<string, string>;
    const edit = config.permission.edit as Record<string, string>;

    expect(bash["git *"]).toBe("deny");
    expect(edit["../task-state/**"]).toBe("deny");
    expect(bash["taskforge *"]).toBe("allow");
    expect(bash["npm test *"]).toBe("allow");

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("generates hooks that are executable", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-int-"));
    installGitHooks({ projectRoot: tmp, dryRun: false, installHooks: true });

    const preCommit = path.join(tmp, ".taskforge", "hooks", "pre-commit");
    const stats = fs.statSync(preCommit);
    expect(stats.mode & 0o111).not.toBe(0);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("dry-run mode does not write any files", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-int-"));
    installAgentsMd(tmp, true);
    installOpenCodeConfig(tmp, "managed", true, true, true);
    installAgentFiles(tmp, true);
    installGitHooks({ projectRoot: tmp, dryRun: true, installHooks: true });

    expect(fs.existsSync(path.join(tmp, "AGENTS.md"))).toBe(false);
    expect(fs.existsSync(path.join(tmp, "opencode.json"))).toBe(false);
    expect(fs.existsSync(path.join(tmp, ".opencode"))).toBe(false);
    expect(fs.existsSync(path.join(tmp, ".taskforge"))).toBe(false);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("all agent files contain required TaskForge command references", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-int-"));
    installAgentFiles(tmp, false);

    const impl = fs.readFileSync(path.join(tmp, ".opencode", "agents", "implementer.md"), "utf-8");
    expect(impl).toContain("taskforge start TASK-ID");
    expect(impl).toContain("taskforge done TASK-ID");
    expect(impl).toContain("taskforge checkpoint");

    const reviewer = fs.readFileSync(path.join(tmp, ".opencode", "agents", "reviewer.md"), "utf-8");
    expect(reviewer).toContain("taskforge inspect");
    expect(reviewer).toContain("taskforge diff");

    const doctor = fs.readFileSync(path.join(tmp, ".opencode", "agents", "doctor.md"), "utf-8");
    expect(doctor).toContain("taskforge doctor --check");
    expect(doctor).toContain("git push --force");

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
