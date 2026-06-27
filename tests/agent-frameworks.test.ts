import { describe, it, expect } from "vitest";
import { getAdapter, getAdapters } from "../src/agent-frameworks/registry.js";
import { genericAdapter } from "../src/agent-frameworks/generic.js";
import { opencodeAdapter } from "../src/agent-frameworks/opencode.js";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

describe("adapter registry", () => {
  it("returns generic adapter", () => {
    const adapter = getAdapter("generic");
    expect(adapter).toBeDefined();
    expect(adapter!.id).toBe("generic");
  });

  it("returns opencode adapter", () => {
    const adapter = getAdapter("opencode");
    expect(adapter).toBeDefined();
    expect(adapter!.id).toBe("opencode");
  });

  it("returns undefined for unknown adapter", () => {
    expect(getAdapter("nonexistent")).toBeUndefined();
  });

  it("getAdapters returns both builtin adapters", () => {
    const adapters = getAdapters();
    expect(adapters.length).toBeGreaterThanOrEqual(2);
    expect(adapters.some((a) => a.id === "generic")).toBe(true);
    expect(adapters.some((a) => a.id === "opencode")).toBe(true);
  });
});

describe("generic adapter", () => {
  it("always detects", async () => {
    const result = await genericAdapter.detect("/tmp");
    expect(result.detected).toBe(true);
    expect(result.frameworkId).toBe("generic");
  });

  it("plan returns portable skill files", async () => {
    const plan = await genericAdapter.plan({
      projectRoot: "/tmp",
      configPaths: [],
      policy: "managed",
      installHooks: true,
      audit: true,
      guard: true,
      dryRun: false,
    });
    const paths = plan.files.map((f) => f.path);
    expect(paths).toContain(path.join(".agents", "skills", "taskforge-work-task", "SKILL.md"));
    expect(paths).toContain(path.join(".agents", "skills", "taskforge-recover-state", "SKILL.md"));
  });

  it("apply installs skill files", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-gen-"));
    await genericAdapter.apply({
      projectRoot: tmp,
      configPaths: [],
      policy: "managed",
      installHooks: true,
      audit: true,
      guard: true,
      dryRun: false,
    });
    expect(
      fs.existsSync(path.join(tmp, ".agents", "skills", "taskforge-work-task", "SKILL.md")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tmp, ".agents", "skills", "taskforge-recover-state", "SKILL.md")),
    ).toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe("opencode adapter", () => {
  it("detects opencode.json", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-oc-"));
    fs.writeFileSync(path.join(tmp, "opencode.json"), "{}");
    const result = await opencodeAdapter.detect(tmp);
    expect(result.detected).toBe(true);
    expect(result.frameworkId).toBe("opencode");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("detects .opencode directory", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-oc-"));
    fs.mkdirSync(path.join(tmp, ".opencode"));
    const result = await opencodeAdapter.detect(tmp);
    expect(result.detected).toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("does not detect when nothing exists", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-oc-"));
    const result = await opencodeAdapter.detect(tmp);
    expect(result.detected).toBe(false);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("plan reports files for managed init", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-oc-"));
    const plan = await opencodeAdapter.plan({
      projectRoot: tmp,
      configPaths: [],
      policy: "managed",
      installHooks: true,
      audit: true,
      guard: true,
      dryRun: true,
    });
    const paths = plan.files.map((f) => f.path);
    expect(paths).toContain("opencode.json");
    expect(paths).toContain(".opencode/agents/implementer.md");
    expect(paths).toContain(".opencode/agents/reviewer.md");
    expect(paths).toContain(".opencode/agents/doctor.md");
    expect(paths).toContain(".opencode/plugins/taskforge-audit.ts");
    expect(paths).toContain(".opencode/plugins/taskforge-guard.ts");
    expect(paths).toContain(path.join(".agents", "skills", "taskforge-work-task", "SKILL.md"));
    expect(paths).toContain(path.join(".agents", "skills", "taskforge-recover-state", "SKILL.md"));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("doctor reports warn when opencode.json missing", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-oc-"));
    const diags = await opencodeAdapter.doctor({ projectRoot: tmp, configPaths: [] });
    expect(diags.some((d) => d.check === "opencode-config" && d.severity === "warn")).toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("doctor reports pass when opencode.json has correct permissions", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-oc-"));
    fs.writeFileSync(
      path.join(tmp, "opencode.json"),
      JSON.stringify({
        permission: {
          bash: { "git push --force*": "deny" },
          edit: { ".git/**": "deny", "tasks/**": "deny" },
        },
        agent: {
          doctor: {},
          implementer: {
            permission: {
              bash: { "git push *": "allow", "git push --force*": "deny" },
            },
          },
        },
      }),
    );
    const diags = await opencodeAdapter.doctor({ projectRoot: tmp, configPaths: [] });
    expect(diags.some((d) => d.check === "opencode-policy" && d.severity === "pass")).toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
