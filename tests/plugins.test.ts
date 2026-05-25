import { describe, it, expect } from "vitest";
import { generateAuditPlugin, installAuditPlugin } from "../src/core/audit-plugin.js";
import { generateGuardPlugin, installGuardPlugin } from "../src/core/guard-plugin.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("audit plugin", () => {
  it("generates valid TypeScript plugin", () => {
    const content = generateAuditPlugin();
    expect(content).toContain("taskforge-audit");
    expect(content).toContain("TASKFORGE_TASK_ID");
    expect(content).toContain("transcript.jsonl");
    expect(content).toContain("resolveTaskId");
    expect(content).toContain("REDACTED");
  });

  it("installs plugin file", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-plug-"));
    installAuditPlugin(tmp, false);
    const filePath = path.join(tmp, ".opencode", "plugins", "taskforge-audit.ts");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("taskforge-audit");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("dry-run does not write", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-plug-"));
    installAuditPlugin(tmp, true);
    expect(fs.existsSync(path.join(tmp, ".opencode"))).toBe(false);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("generated regex extracts TASK-ID from agent branches", () => {
    const content = generateAuditPlugin();
    // The generated regex should use \d+ not \\d+ (literal backslash)
    expect(content).toContain("TASK-\\d+");
    expect(content).not.toContain("TASK-\\\\d+");
  });

  it("generated regex extracts TASK-ID from worktree paths", () => {
    const content = generateAuditPlugin();
    expect(content).toMatch(/worktrees.*TASK-\\d\+/);
  });

  it("generated redaction is recursive", () => {
    const content = generateAuditPlugin();
    // redactSecrets should call itself for nested values
    expect(content).toContain("redactSecrets(val)");
  });

  it("generated redaction covers all secret patterns", () => {
    const content = generateAuditPlugin();
    expect(content).toContain("TOKEN");
    expect(content).toContain("SECRET");
    expect(content).toContain("PASSWORD");
    expect(content).toContain("API_KEY");
    expect(content).toContain("PRIVATE_KEY");
    expect(content).toContain("CREDENTIAL");
    expect(content).toContain("AUTHORIZATION");
  });

  it("generated writeAuditEvent applies redaction before writing", () => {
    const content = generateAuditPlugin();
    // redactSecrets should be called on the event before JSON.stringify
    expect(content).toContain("redactSecrets(event)");
  });
});

describe("guard plugin", () => {
  it("generates guard plugin with managed policy", () => {
    const content = generateGuardPlugin("managed");
    expect(content).toContain("taskforge-guard");
    expect(content).toContain("force push is forbidden");
    expect(content).toContain("task-state files must only be modified");
    expect(content).toContain("Doctor lock");
  });

  it("generates warn mode for permissive policy", () => {
    const content = generateGuardPlugin("permissive");
    expect(content).toContain('allow: true, reason: "WARNING:');
  });

  it("generates block mode for locked-down policy", () => {
    const content = generateGuardPlugin("locked-down");
    expect(content).toContain("allow: false");
  });

  it("installs guard plugin", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-plug-"));
    installGuardPlugin(tmp, "managed", false);
    const filePath = path.join(tmp, ".opencode", "plugins", "taskforge-guard.ts");
    expect(fs.existsSync(filePath)).toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("dry-run does not write", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-plug-"));
    installGuardPlugin(tmp, "managed", true);
    expect(fs.existsSync(path.join(tmp, ".opencode"))).toBe(false);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
