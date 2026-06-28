import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  OpenCodeAgentFrameworkAdapter,
  GenericAgentFrameworkAdapter,
  getAgentFrameworkAdapter,
} from "../src/core/agent-framework-adapter.js";
import { installSkillFiles, WORK_TASK_SKILL_MD, RECOVER_STATE_SKILL_MD } from "../src/core/skill-files.js";
import { installOpenCodeConfig } from "../src/core/opencode-config.js";
import { installAgentsMd } from "../src/core/agents-md.js";

const OPENCODE = new OpenCodeAgentFrameworkAdapter();

function freshProject(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-doctor-"));
  // Minimal healthy baseline so only the drift under test is flagged.
  installAgentsMd(tmp, false);
  installOpenCodeConfig(tmp, "managed", true, true, false);
  installSkillFiles(tmp, false);
  return tmp;
}

function codes(issues: { code: string }[]): Set<string> {
  return new Set(issues.map((i) => i.code));
}

let projects: string[] = [];

afterEach(() => {
  for (const p of projects) fs.rmSync(p, { recursive: true, force: true });
  projects = [];
});

describe("OpenCodeAgentFrameworkAdapter — managed skill drift detection (R-E03-002)", () => {
  it("reports no skill drift on a healthy project", () => {
    const tmp = freshProject();
    projects.push(tmp);
    const skillIssues = OPENCODE.doctor(tmp).filter((i) => i.code.startsWith("SKILL_"));
    expect(skillIssues).toEqual([]);
  });

  it("flags SKILL_MISSING when a managed skill is absent", () => {
    const tmp = freshProject();
    projects.push(tmp);
    fs.unlinkSync(path.join(tmp, ".agents", "skills", "taskforge-work-task", "SKILL.md"));
    const skillIssues = OPENCODE.doctor(tmp).filter((i) => i.code.startsWith("SKILL_"));
    expect(skillIssues.map((i) => i.code)).toContain("SKILL_MISSING");
    expect(skillIssues.length).toBe(1);
  });

  it("flags SKILL_STALE when managed content is tampered", () => {
    const tmp = freshProject();
    projects.push(tmp);
    const skillPath = path.join(tmp, ".agents", "skills", "taskforge-recover-state", "SKILL.md");
    fs.writeFileSync(skillPath, RECOVER_STATE_SKILL_MD + "\n# tampered\n", "utf-8");
    const skillIssues = OPENCODE.doctor(tmp).filter((i) => i.code.startsWith("SKILL_"));
    expect(skillIssues.map((i) => i.code)).toContain("SKILL_STALE");
    expect(skillIssues.length).toBe(1);
  });
});

describe("OpenCodeAgentFrameworkAdapter — MCP drift detection (AC #3, R-E03-002)", () => {
  it("reports no MCP drift when mcp.taskforge is present and disabled (default)", () => {
    const tmp = freshProject();
    projects.push(tmp);
    const mcpIssues = OPENCODE.doctor(tmp).filter((i) => i.code.startsWith("OPENCODE_MCP"));
    expect(mcpIssues).toEqual([]);
  });

  it("flags OPENCODE_MCP_MISSING when the mcp.taskforge block is removed", () => {
    const tmp = freshProject();
    projects.push(tmp);
    const ocPath = path.join(tmp, "opencode.json");
    const oc = JSON.parse(fs.readFileSync(ocPath, "utf-8"));
    delete oc.mcp;
    fs.writeFileSync(ocPath, JSON.stringify(oc), "utf-8");
    const mcpIssues = OPENCODE.doctor(tmp).filter((i) => i.code.startsWith("OPENCODE_MCP"));
    expect(mcpIssues.map((i) => i.code)).toContain("OPENCODE_MCP_MISSING");
  });

  it("flags OPENCODE_MCP_INVALID_STDIO when enabled but command is not a stdio launcher", () => {
    const tmp = freshProject();
    projects.push(tmp);
    const ocPath = path.join(tmp, "opencode.json");
    const oc = JSON.parse(fs.readFileSync(ocPath, "utf-8"));
    oc.mcp.taskforge.enabled = true;
    oc.mcp.taskforge.type = "sse"; // not a local stdio launcher
    fs.writeFileSync(ocPath, JSON.stringify(oc), "utf-8");
    const mcpIssues = OPENCODE.doctor(tmp).filter((i) => i.code.startsWith("OPENCODE_MCP"));
    expect(mcpIssues.map((i) => i.code)).toContain("OPENCODE_MCP_INVALID_STDIO");
  });

  it("accepts enabled MCP with a valid local stdio launcher", () => {
    const tmp = freshProject();
    projects.push(tmp);
    const ocPath = path.join(tmp, "opencode.json");
    const oc = JSON.parse(fs.readFileSync(ocPath, "utf-8"));
    oc.mcp.taskforge.enabled = true; // type:'local' + command[] already canonical
    fs.writeFileSync(ocPath, JSON.stringify(oc), "utf-8");
    const mcpIssues = OPENCODE.doctor(tmp).filter((i) => i.code.startsWith("OPENCODE_MCP"));
    expect(mcpIssues).toEqual([]);
  });
});

describe("OpenCodeAgentFrameworkAdapter.fix — idempotent repair (R-E03-002, R-E03-003)", () => {
  it("repairs missing + stale skills and reaches a clean steady state", () => {
    const tmp = freshProject();
    projects.push(tmp);
    // Drift both skills
    fs.unlinkSync(path.join(tmp, ".agents", "skills", "taskforge-work-task", "SKILL.md"));
    const recoverPath = path.join(tmp, ".agents", "skills", "taskforge-recover-state", "SKILL.md");
    fs.writeFileSync(recoverPath, "tampered", "utf-8");

    expect(OPENCODE.doctor(tmp).filter((i) => i.code.startsWith("SKILL_"))).toHaveLength(2);

    const repairs = OPENCODE.fix(tmp);
    expect(repairs.some((r) => r.code === "SKILL_MISSING")).toBe(true);
    expect(repairs.some((r) => r.code === "SKILL_STALE")).toBe(true);

    // Content restored to canonical
    const workPath = path.join(tmp, ".agents", "skills", "taskforge-work-task", "SKILL.md");
    expect(fs.readFileSync(workPath, "utf-8")).toBe(WORK_TASK_SKILL_MD);
    expect(fs.readFileSync(recoverPath, "utf-8")).toBe(RECOVER_STATE_SKILL_MD);

    // Idempotent: second fix repairs nothing
    expect(OPENCODE.fix(tmp).filter((r) => r.code.startsWith("SKILL_"))).toEqual([]);
    // Doctor steady state: no skill drift
    expect(OPENCODE.doctor(tmp).filter((i) => i.code.startsWith("SKILL_"))).toEqual([]);
  });

  it("repairs a missing mcp.taskforge block", () => {
    const tmp = freshProject();
    projects.push(tmp);
    const ocPath = path.join(tmp, "opencode.json");
    const oc = JSON.parse(fs.readFileSync(ocPath, "utf-8"));
    delete oc.mcp;
    fs.writeFileSync(ocPath, JSON.stringify(oc), "utf-8");
    expect(codes(OPENCODE.doctor(tmp)).has("OPENCODE_MCP_MISSING")).toBe(true);

    OPENCODE.fix(tmp);
    const repaired = JSON.parse(fs.readFileSync(ocPath, "utf-8"));
    expect(repaired.mcp?.taskforge).toBeTruthy();
    expect(OPENCODE.doctor(tmp).filter((i) => i.code.startsWith("OPENCODE_MCP"))).toEqual([]);
  });

  it("preserves an unmanaged neighboring skill through repair", () => {
    const tmp = freshProject();
    projects.push(tmp);
    const neighborDir = path.join(tmp, ".agents", "skills", "custom-skill");
    fs.mkdirSync(neighborDir, { recursive: true });
    const neighborPath = path.join(neighborDir, "SKILL.md");
    fs.writeFileSync(neighborPath, "# Keep me", "utf-8");

    // Drift a managed skill to force a repair pass
    fs.unlinkSync(path.join(tmp, ".agents", "skills", "taskforge-work-task", "SKILL.md"));
    OPENCODE.fix(tmp);

    expect(fs.readFileSync(neighborPath, "utf-8")).toBe("# Keep me");
  });

  it("preserves unmanaged opencode.json keys through MCP repair", () => {
    const tmp = freshProject();
    projects.push(tmp);
    const ocPath = path.join(tmp, "opencode.json");
    const oc = JSON.parse(fs.readFileSync(ocPath, "utf-8"));
    oc.theme = "dark";
    oc.customUserKey = "preserve-me";
    delete oc.mcp;
    fs.writeFileSync(ocPath, JSON.stringify(oc), "utf-8");

    OPENCODE.fix(tmp);
    const repaired = JSON.parse(fs.readFileSync(ocPath, "utf-8"));
    expect(repaired.theme).toBe("dark");
    expect(repaired.customUserKey).toBe("preserve-me");
    expect(repaired.mcp?.taskforge).toBeTruthy();
  });
});

describe("GenericAgentFrameworkAdapter — skill drift gated on framework (AC #1)", () => {
  it("detects skill drift when checkSkills is enabled (generic/auto)", () => {
    const tmp = freshProject();
    projects.push(tmp);
    fs.unlinkSync(path.join(tmp, ".agents", "skills", "taskforge-work-task", "SKILL.md"));
    const generic = new GenericAgentFrameworkAdapter({ checkSkills: true });
    expect(generic.doctor(tmp).map((i) => i.code)).toContain("SKILL_MISSING");
  });

  it("is a no-op for framework 'none' (no managed skills expected)", () => {
    const tmp = freshProject();
    projects.push(tmp);
    fs.unlinkSync(path.join(tmp, ".agents", "skills", "taskforge-work-task", "SKILL.md"));
    const none = new GenericAgentFrameworkAdapter({ checkSkills: false });
    expect(none.doctor(tmp)).toEqual([]);
    expect(none.fix(tmp)).toEqual([]);
  });
});

describe("getAgentFrameworkAdapter factory — wiring (AC #1)", () => {
  it("returns a skill-checking adapter for generic/auto/undefined", () => {
    const tmp = freshProject();
    projects.push(tmp);
    fs.unlinkSync(path.join(tmp, ".agents", "skills", "taskforge-work-task", "SKILL.md"));
    for (const id of ["generic", "auto", undefined]) {
      const a = getAgentFrameworkAdapter(id);
      expect(a.doctor(tmp).some((i) => i.code === "SKILL_MISSING")).toBe(true);
    }
  });

  it("returns a no-skill-check adapter for 'none'", () => {
    const tmp = freshProject();
    projects.push(tmp);
    fs.unlinkSync(path.join(tmp, ".agents", "skills", "taskforge-work-task", "SKILL.md"));
    const a = getAgentFrameworkAdapter("none");
    expect(a.doctor(tmp)).toEqual([]);
  });

  it("returns the OpenCode adapter for 'opencode' (skill + MCP aware)", () => {
    const a = getAgentFrameworkAdapter("opencode");
    expect(a).toBeInstanceOf(OpenCodeAgentFrameworkAdapter);
  });
});
