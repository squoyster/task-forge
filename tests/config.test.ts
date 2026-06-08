import { describe, it, expect } from "vitest";
import { ConfigSchema, DEFAULT_CONFIG } from "../src/core/config.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("ConfigSchema", () => {
  it("parses an empty object with defaults", () => {
    const result = ConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.project.defaultBranch).toBe("main");
      expect(result.data.tasks.directory).toBe("tasks");
      expect(result.data.worktrees.root).toBe("../worktrees");
      expect(result.data.github.enabled).toBe(false);
      expect(result.data.opencode.enabled).toBe(true);
      expect(result.data.continuation.autoContinue).toBe(true);
      expect(result.data.dependencies.enabled).toBe(true);
      expect(result.data.dependencies.packageManager).toBe("pnpm");
    }
  });

  it("parses a full custom config", () => {
    const config = {
      project: { name: "my-project", defaultBranch: "develop" },
      tasks: { directory: "todos", idPrefix: "PROJ", template: "todos/template.md" },
      worktrees: { root: "../wt", branchPrefix: "bot" },
      github: { enabled: true, owner: "myorg", repo: "myrepo", projectNumber: 1 },
      opencode: { enabled: false, command: "custom-cli" },
      continuation: { autoContinue: false, maxTaskFixIterations: 5, allowDraftPr: false, allowCommit: false, allowPush: true },
      dependencies: {
        enabled: false,
        packageManager: "yarn",
        scan: { osv: false, packageAudit: false, snyk: true, trivy: true },
        policy: { autoPrPatchUpdates: false, requireHumanForMajor: false, maxLockfileChangedPackagesWithoutReview: 50 },
      },
    };
    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.project.name).toBe("my-project");
      expect(result.data.project.defaultBranch).toBe("develop");
      expect(result.data.tasks.directory).toBe("todos");
      expect(result.data.github.owner).toBe("myorg");
      expect(result.data.dependencies.scan.snyk).toBe(true);
      expect(result.data.dependencies.policy.maxLockfileChangedPackagesWithoutReview).toBe(50);
    }
  });

  it("rejects invalid packageManager", () => {
    const result = ConfigSchema.safeParse({ dependencies: { packageManager: "bun" } });
    expect(result.success).toBe(false);
  });

  it("rejects invalid continuation field type", () => {
    const result = ConfigSchema.safeParse({ continuation: { maxTaskFixIterations: "three" } });
    expect(result.success).toBe(false);
  });

  it("provides defaults for partial configs", () => {
    const result = ConfigSchema.safeParse({ project: { name: "test" } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.project.name).toBe("test");
      expect(result.data.project.defaultBranch).toBe("main");
      expect(result.data.github.enabled).toBe(false);
    }
  });

  it("provides opencode defaults", () => {
    const result = ConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.opencode.policy).toBe("managed");
      expect(result.data.opencode.audit).toBe(true);
      expect(result.data.opencode.guard).toBe(true);
      expect(result.data.opencode.policyVersion).toBe(1);
      expect(result.data.opencode.enabled).toBe(true);
    }
  });

  it("provides agentFramework defaults", () => {
    const result = ConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.agentFramework.installHooks).toBe(true);
      expect(result.data.agentFramework.id).toBeUndefined();
    }
  });

  it("parses full opencode config", () => {
    const result = ConfigSchema.safeParse({
      opencode: {
        enabled: false,
        command: "custom-cli",
        policy: "locked-down",
        audit: false,
        guard: true,
        policyVersion: 2,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.opencode.enabled).toBe(false);
      expect(result.data.opencode.command).toBe("custom-cli");
      expect(result.data.opencode.policy).toBe("locked-down");
      expect(result.data.opencode.audit).toBe(false);
      expect(result.data.opencode.guard).toBe(true);
      expect(result.data.opencode.policyVersion).toBe(2);
    }
  });

  it("parses full agentFramework config", () => {
    const result = ConfigSchema.safeParse({
      agentFramework: {
        id: "opencode",
        installHooks: false,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.agentFramework.id).toBe("opencode");
      expect(result.data.agentFramework.installHooks).toBe(false);
    }
  });

  it("rejects invalid opencode policy", () => {
    const result = ConfigSchema.safeParse({
      opencode: { policy: "nonexistent" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts generic framework id", () => {
    const result = ConfigSchema.safeParse({
      agentFramework: { id: "generic" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.agentFramework.id).toBe("generic");
    }
  });

  it("accepts future framework ids", () => {
    const result = ConfigSchema.safeParse({
      agentFramework: { id: "claude-code" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.agentFramework.id).toBe("claude-code");
    }
  });

  it("loads existing config without opencode or agentFramework", () => {
    const legacyConfig = {
      project: { name: "old-project" },
      continuation: { autoContinue: false },
    };
    const result = ConfigSchema.safeParse(legacyConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.project.name).toBe("old-project");
      expect(result.data.continuation.autoContinue).toBe(false);
      expect(result.data.opencode.policy).toBe("managed");
      expect(result.data.agentFramework.installHooks).toBe(true);
    }
  });
});

describe("DEFAULT_CONFIG", () => {
  it("is a valid config", () => {
    const result = ConfigSchema.safeParse(DEFAULT_CONFIG);
    expect(result.success).toBe(true);
  });
});

describe("loadConfig", () => {
  it("returns DEFAULT_CONFIG when config file does not exist", async () => {
    const { loadConfig } = await import("../src/core/config.js");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-config-test-"));
    const config = loadConfig(tmpDir);
    expect(config.project.defaultBranch).toBe("main");
    expect(config.dependencies.packageManager).toBe("pnpm");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads config from .taskforge/config.json", async () => {
    const { loadConfig } = await import("../src/core/config.js");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-config-test-"));
    const configDir = path.join(tmpDir, ".taskforge");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, "config.json"),
      JSON.stringify({ project: { name: "loaded" } }),
      "utf-8",
    );
    const config = loadConfig(tmpDir);
    expect(config.project.name).toBe("loaded");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws on invalid JSON", async () => {
    const { loadConfig } = await import("../src/core/config.js");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-config-test-"));
    const configDir = path.join(tmpDir, ".taskforge");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, "config.json"), "not json", "utf-8");
    expect(() => loadConfig(tmpDir)).toThrow("Invalid JSON in config file");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws on invalid schema", async () => {
    const { loadConfig } = await import("../src/core/config.js");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-config-test-"));
    const configDir = path.join(tmpDir, ".taskforge");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, "config.json"), JSON.stringify({ dependencies: { packageManager: "invalid" } }), "utf-8");
    expect(() => loadConfig(tmpDir)).toThrow("Invalid config schema");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});