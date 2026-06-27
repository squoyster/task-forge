import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  installSkillFiles,
  TASKFORGE_SKILLS,
  WORK_TASK_SKILL_MD,
  RECOVER_STATE_SKILL_MD,
} from "../src/core/skill-files.js";

function parseFrontmatter(md: string): Record<string, string> {
  const match = md.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error("no frontmatter");
  const fm: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return fm;
}

describe("skill-files — structure & content", () => {
  it("installs exactly two canonical skills", () => {
    expect(TASKFORGE_SKILLS).toHaveLength(2);
    expect(TASKFORGE_SKILLS.map((s) => s.relativePath)).toEqual([
      path.join(".agents", "skills", "taskforge-work-task", "SKILL.md"),
      path.join(".agents", "skills", "taskforge-recover-state", "SKILL.md"),
    ]);
  });

  it("each skill has valid name/description frontmatter", () => {
    for (const md of [WORK_TASK_SKILL_MD, RECOVER_STATE_SKILL_MD]) {
      const fm = parseFrontmatter(md);
      expect(fm.name).toBeTruthy();
      expect(fm.description.length).toBeGreaterThan(40);
    }
  });

  it("work skill name is taskforge-work-task", () => {
    expect(parseFrontmatter(WORK_TASK_SKILL_MD).name).toBe("taskforge-work-task");
  });

  it("recovery skill name is taskforge-recover-state", () => {
    expect(parseFrontmatter(RECOVER_STATE_SKILL_MD).name).toBe("taskforge-recover-state");
  });

  it("each skill is under 200 lines", () => {
    for (const md of [WORK_TASK_SKILL_MD, RECOVER_STATE_SKILL_MD]) {
      expect(md.split("\n").length).toBeLessThan(200);
    }
  });
});

describe("skill-files — forbidden content (AC #3, AC #5)", () => {
  it("work skill has no doctor override, --force, task-state write, or git-facade guidance", () => {
    const lower = WORK_TASK_SKILL_MD.toLowerCase();
    expect(lower).not.toMatch(/doctor\s+override/);
    expect(lower).not.toContain("--force");
    expect(lower).not.toContain("task-state");
    expect(lower).not.toMatch(/checkpoint|submit|taskforge diff|taskforge pr/);
  });

  it("skills contain no vendor-specific required metadata", () => {
    for (const md of [WORK_TASK_SKILL_MD, RECOVER_STATE_SKILL_MD]) {
      const fm = parseFrontmatter(md);
      // Only name + description in frontmatter
      expect(Object.keys(fm).sort()).toEqual(["description", "name"]);
    }
  });
});

describe("skill-files — recovery requires diagnosis first (AC #4)", () => {
  it("recovery skill mandates read-only diagnosis before mutation", () => {
    const lines = RECOVER_STATE_SKILL_MD.split("\n");
    const diagnoseIdx = lines.findIndex((l) => /diagnos/i.test(l));
    const mutateIdx = lines.findIndex((l) => /lock|mutate|repair|fix/i.test(l) && !/diagnos/i.test(l));
    expect(diagnoseIdx).toBeGreaterThanOrEqual(0);
    expect(mutateIdx).toBeGreaterThan(diagnoseIdx);
    expect(RECOVER_STATE_SKILL_MD.toLowerCase()).toContain("read-only");
  });
});

describe("skill-files — trigger coverage (AC #7)", () => {
  it("work skill has positive triggers for normal task work", () => {
    const d = WORK_TASK_SKILL_MD.toLowerCase();
    expect(d).toMatch(/next task/);
    expect(d).toMatch(/claim/);
    expect(d).toMatch(/execut/);
    expect(d).toMatch(/verif/);
    expect(d).toMatch(/complet/);
  });

  it("work skill has negative trigger pointing to recovery", () => {
    expect(WORK_TASK_SKILL_MD.toLowerCase()).toContain("taskforge-recover-state");
  });

  it("recovery skill triggers on doctor lock and state failure", () => {
    const d = RECOVER_STATE_SKILL_MD.toLowerCase();
    expect(d).toMatch(/doctor.?lock/);
    expect(d).toMatch(/validate-state/);
    expect(d).toMatch(/ownership conflict/);
    expect(d).toMatch(/stale agent/);
  });

  it("recovery skill has negative trigger pointing to work skill", () => {
    expect(RECOVER_STATE_SKILL_MD.toLowerCase()).toContain("taskforge-work-task");
  });

  it("skills do not duplicate the status graph or command map", () => {
    for (const md of [WORK_TASK_SKILL_MD, RECOVER_STATE_SKILL_MD]) {
      // Should reference JSON as the live contract, not hardcode transitions
      expect(md).toContain("--json");
      expect(md).not.toMatch(/Inbox.*Needs Spec.*Ready.*In Progress.*Review.*Verify.*Done/s);
    }
  });
});

describe("skill-files — install behavior (AC #1, AC #6)", () => {
  it("installSkillFiles creates both SKILL.md files", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-skill-"));
    installSkillFiles(tmp, false);

    const workPath = path.join(tmp, ".agents", "skills", "taskforge-work-task", "SKILL.md");
    const recoveryPath = path.join(tmp, ".agents", "skills", "taskforge-recover-state", "SKILL.md");
    expect(fs.existsSync(workPath)).toBe(true);
    expect(fs.existsSync(recoveryPath)).toBe(true);
    expect(fs.readFileSync(workPath, "utf-8")).toBe(WORK_TASK_SKILL_MD);
    expect(fs.readFileSync(recoveryPath, "utf-8")).toBe(RECOVER_STATE_SKILL_MD);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("install is idempotent (re-run produces identical content)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-skill-"));
    installSkillFiles(tmp, false);
    const workPath = path.join(tmp, ".agents", "skills", "taskforge-work-task", "SKILL.md");

    installSkillFiles(tmp, false); // second run
    expect(fs.readFileSync(workPath, "utf-8")).toBe(WORK_TASK_SKILL_MD);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("does not overwrite unmanaged neighboring skills", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-skill-"));
    const neighborDir = path.join(tmp, ".agents", "skills", "my-custom-skill");
    fs.mkdirSync(neighborDir, { recursive: true });
    const neighborPath = path.join(neighborDir, "SKILL.md");
    fs.writeFileSync(neighborPath, "# Custom", "utf-8");

    installSkillFiles(tmp, false);

    expect(fs.readFileSync(neighborPath, "utf-8")).toBe("# Custom");

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("dry-run writes nothing", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tf-skill-"));
    installSkillFiles(tmp, true);

    expect(fs.existsSync(path.join(tmp, ".agents"))).toBe(false);

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
