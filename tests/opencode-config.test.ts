import { describe, it, expect } from "vitest";
import {
  generateOpenCodeConfig,
  installOpenCodeConfig,
  mergeConfig,
} from "../src/core/opencode-config.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("generateOpenCodeConfig", () => {
  it("generates valid config with managed policy", () => {
    const config = generateOpenCodeConfig("managed", true, true);
    expect(config.$schema).toBeDefined();
    expect(config.taskforge).toBeUndefined();

    const perm = config.permission as Record<string, unknown>;
    expect(perm["*"]).toBe("ask");

    const edit = perm.edit as Record<string, string>;
    expect(edit["../task-state/**"]).toBe("deny");
    expect(edit["tasks/**"]).toBe("deny");

    const bash = perm.bash as Record<string, string>;
    expect(bash["git *"]).toBe("deny");
    expect(bash["taskforge *"]).toBe("allow");
    expect(bash["npm test *"]).toBe("allow");

    const agent = config.agent as Record<string, unknown>;
    const doctor = agent.doctor as Record<string, unknown>;
    const docPerm = doctor.permission as Record<string, unknown>;
    const docBash = docPerm.bash as Record<string, string>;
    expect(docBash["git status *"]).toBe("allow");
    expect(docBash["git push --force*"]).toBe("deny");
  });

  it("no longer emits taskforge block (moved to .taskforge/config.json)", () => {
    const config = generateOpenCodeConfig("managed", false, false);
    expect(config.taskforge).toBeUndefined();
  });
});

describe("installOpenCodeConfig", () => {
  it("creates opencode.json when it does not exist", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-occ-"));
    installOpenCodeConfig(tmp, "managed", true, true, false);
    const raw = fs.readFileSync(path.join(tmp, "opencode.json"), "utf-8");
    const config = JSON.parse(raw);
    expect(config.taskforge).toBeUndefined();
    const bash = config.permission.bash as Record<string, string>;
    expect(bash["git *"]).toBe("deny");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("merges into existing opencode.json preserving providers", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-occ-"));
    const existing = {
      providers: { openai: { apiKey: "sk-test" } },
      theme: "dark",
    };
    fs.writeFileSync(path.join(tmp, "opencode.json"), JSON.stringify(existing));

    installOpenCodeConfig(tmp, "managed", true, true, false);

    const raw = fs.readFileSync(path.join(tmp, "opencode.json"), "utf-8");
    const config = JSON.parse(raw);
    expect(config.providers.openai.apiKey).toBe("sk-test");
    expect(config.theme).toBe("dark");
    expect(config.taskforge).toBeUndefined();
    const bash = config.permission.bash as Record<string, string>;
    expect(bash["git *"]).toBe("deny");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("dry-run does not write files", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-occ-"));
    installOpenCodeConfig(tmp, "managed", true, true, true);
    expect(fs.existsSync(path.join(tmp, "opencode.json"))).toBe(false);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("adds doctor agent permissions", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-occ-"));
    installOpenCodeConfig(tmp, "managed", true, true, false);

    const raw = fs.readFileSync(path.join(tmp, "opencode.json"), "utf-8");
    const config = JSON.parse(raw);

    expect(config.agent).toBeDefined();
    expect(config.agent.doctor).toBeDefined();
    const docBash = config.agent.doctor.permission.bash as Record<string, string>;
    expect(docBash["git status *"]).toBe("allow");
    expect(docBash["git push --force*"]).toBe("deny");
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe("mergeConfig", () => {
  it("preserves unrelated fields", () => {
    const existing = { providers: { openai: { apiKey: "sk-test" } } };
    const generated = { permission: { bash: { "git *": "deny" } } };
    const result = mergeConfig(existing, generated);
    expect(result.providers).toEqual(existing.providers);
    expect(result.permission).toEqual(generated.permission);
  });

  it("deep merges nested sections", () => {
    const existing = { customSection: { existingKey: "value1" } };
    const generated = { customSection: { newKey: "value2" } };
    const result = mergeConfig(existing, generated);
    expect(result.customSection).toEqual({ existingKey: "value1", newKey: "value2" });
  });

  it("does not overwrite $schema", () => {
    const existing = { $schema: "custom" };
    const generated = { $schema: "https://opencode.ai/config.json", permission: {} };
    const result = mergeConfig(existing, generated);
    expect(result.$schema).toBe("custom");
  });
});
