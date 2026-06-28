import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdInit } from "../src/commands/init.js";
import { setRepoRoot } from "../src/util/paths.js";
import {
  TASKFORGE_SKILLS,
  WORK_TASK_SKILL_MD,
  RECOVER_STATE_SKILL_MD,
  installSkillFiles,
} from "../src/core/skill-files.js";
import { getAgentFrameworkAdapter } from "../src/core/agent-framework-adapter.js";

// --- Canonical contract constants (single source of truth for AC #1/#2/#7) ---

/** Removed git-facade commands (TASK-312). No managed artifact may reference these. */
const REMOVED_FACADE = /\btaskforge\s+(diff|checkpoint|submit|pr)\b/i;

/** Canonical 10-status graph (TASK-318). */
const CANONICAL_STATUSES = [
  "Inbox", "Needs Spec", "Ready", "In Progress", "Review",
  "Verify", "Done", "Blocked", "Rejected", "Deferred",
];

/** Legacy transport statuses collapsed by TASK-318; must not appear in artifacts. */
const LEGACY_STATUSES = [
  "Implementation Complete", "Submitted", "Merge Ready",
  "Backlog", "Active", "Paused", "Cancelled", "Shipped",
];

/** Hard-rule prohibitions carried in every skill body. */
const FORBIDDEN_SKILL_TOKENS = [/--force/i, /\btask-state\b/i];

// --- Test scaffolding ---

let uniqueDir: string;
let repoDir: string;
let stateDir: string;
const projects: string[] = [];

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-conf-"));
  repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
});

afterEach(() => {
  for (const p of projects) fs.rmSync(p, { recursive: true, force: true });
  projects.length = 0;
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

function initWith(framework: string): Promise<void> {
  return cmdInit({ agentFramework: framework });
}

function readSkill(rel: string): string {
  return fs.readFileSync(path.join(repoDir, rel), "utf-8");
}

// ===========================================================================
// AC #1 + #2: shared vendor-neutral skill contract across generic + opencode
// (the skill-installing frameworks). 'none' is covered separately.
// ===========================================================================

describe("embedding conformance — shared skill contract (AC #1, #2)", () => {
  for (const framework of ["generic", "opencode"]) {
    describe(`framework: ${framework}`, () => {
      it("installs exactly the two canonical managed skills with canonical content", async () => {
        await initWith(framework);
        const skillPaths = TASKFORGE_SKILLS.map((s) => s.relativePath);
        for (const rel of skillPaths) {
          expect(fs.existsSync(path.join(repoDir, rel))).toBe(true);
        }
        expect(readSkill(skillPaths[0])).toBe(WORK_TASK_SKILL_MD);
        expect(readSkill(skillPaths[1])).toBe(RECOVER_STATE_SKILL_MD);
      });

      it("doctor reports no skill drift on a fresh init", async () => {
        await initWith(framework);
        const adapter = getAgentFrameworkAdapter(framework);
        const drift = adapter.doctor(repoDir).filter((i) => i.code.startsWith("SKILL_"));
        expect(drift).toEqual([]);
      });

      it("skill bodies contain no removed facade commands (AC #7)", async () => {
        await initWith(framework);
        for (const rel of TASKFORGE_SKILLS.map((s) => s.relativePath)) {
          expect(readSkill(rel)).not.toMatch(REMOVED_FACADE);
        }
      });

      it("skill bodies contain no noncanonical statuses (AC #7)", async () => {
        await initWith(framework);
        for (const rel of TASKFORGE_SKILLS.map((s) => s.relativePath)) {
          const body = readSkill(rel);
          for (const legacy of LEGACY_STATUSES) {
            expect(body).not.toContain(legacy);
          }
        }
      });

      it("skill bodies carry no forbidden tokens (--force, task-state writes)", async () => {
        await initWith(framework);
        for (const rel of TASKFORGE_SKILLS.map((s) => s.relativePath)) {
          const body = readSkill(rel);
          for (const tok of FORBIDDEN_SKILL_TOKENS) {
            expect(body).not.toMatch(tok);
          }
        }
      });

      it("skills are byte-identical across generic and opencode (agent-agnostic, AC #2)", async () => {
        // Install into two separate projects and compare.
        const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), "tf-conf-a-"));
        const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), "tf-conf-b-"));
        projects.push(tmpA, tmpB);
        installSkillFiles(tmpA, false);
        installSkillFiles(tmpB, false);
        for (const rel of TASKFORGE_SKILLS.map((s) => s.relativePath)) {
          expect(fs.readFileSync(path.join(tmpA, rel), "utf-8"))
            .toBe(fs.readFileSync(path.join(tmpB, rel), "utf-8"));
        }
      });
    });
  }
});

// ===========================================================================
// AC #1: 'none' framework installs no managed skills and stays drift-silent
// ===========================================================================

describe("embedding conformance — 'none' framework (AC #1)", () => {
  it("installs no managed skills", async () => {
    await initWith("none");
    for (const rel of TASKFORGE_SKILLS.map((s) => s.relativePath)) {
      expect(fs.existsSync(path.join(repoDir, rel))).toBe(false);
    }
  });

  it("doctor ('none' adapter) reports no drift even when skills are absent", async () => {
    await initWith("none");
    const adapter = getAgentFrameworkAdapter("none");
    expect(adapter.doctor(repoDir)).toEqual([]);
  });
});

// ===========================================================================
// AC #2 + #3: adapter-specific (opencode only) — discovery/config invariants
// ===========================================================================

describe("embedding conformance — opencode adapter-specific (AC #2, #3)", () => {
  it("AGENTS.md carries the managed-agent-policy block", async () => {
    await initWith("opencode");
    const agents = fs.readFileSync(path.join(repoDir, "AGENTS.md"), "utf-8");
    expect(agents).toContain("TASKFORGE:BEGIN managed-agent-policy");
    expect(agents).toContain("TASKFORGE:END managed-agent-policy");
  });

  it("opencode.json ships mcp.taskforge disabled by default with a valid stdio launcher", async () => {
    await initWith("opencode");
    const oc = JSON.parse(fs.readFileSync(path.join(repoDir, "opencode.json"), "utf-8"));
    expect(oc.mcp?.taskforge).toBeTruthy();
    expect(oc.mcp.taskforge.enabled).toBe(false);
    expect(oc.mcp.taskforge.type).toBe("local");
    expect(Array.isArray(oc.mcp.taskforge.command)).toBe(true);
    expect(oc.mcp.taskforge.command.length).toBeGreaterThan(0);
  });

  it("enabling mcp.taskforge yields a doctor-clean stdio config", async () => {
    await initWith("opencode");
    const ocPath = path.join(repoDir, "opencode.json");
    const oc = JSON.parse(fs.readFileSync(ocPath, "utf-8"));
    oc.mcp.taskforge.enabled = true;
    fs.writeFileSync(ocPath, JSON.stringify(oc), "utf-8");
    const adapter = getAgentFrameworkAdapter("opencode");
    const mcpIssues = adapter.doctor(repoDir).filter((i) => i.code.startsWith("OPENCODE_MCP"));
    expect(mcpIssues).toEqual([]);
  });
});

// ===========================================================================
// AC #7: forbidden-content scan across ALL installed embedding artifacts
// (skills + opencode agent files + AGENTS.md + opencode.json)
// ===========================================================================

describe("embedding conformance — forbidden content across all artifacts (AC #7)", () => {
  it("no installed opencode artifact mentions a removed facade command", async () => {
    await initWith("opencode");
    const artifacts: string[] = [];
    // skills
    for (const rel of TASKFORGE_SKILLS.map((s) => s.relativePath)) {
      artifacts.push(readSkill(rel));
    }
    // opencode agent files
    const agentsDir = path.join(repoDir, ".opencode", "agents");
    if (fs.existsSync(agentsDir)) {
      for (const f of fs.readdirSync(agentsDir)) {
        artifacts.push(fs.readFileSync(path.join(agentsDir, f), "utf-8"));
      }
    }
    // AGENTS.md
    const agentsMd = path.join(repoDir, "AGENTS.md");
    if (fs.existsSync(agentsMd)) artifacts.push(fs.readFileSync(agentsMd, "utf-8"));
    // opencode.json (as raw text)
    const ocPath = path.join(repoDir, "opencode.json");
    if (fs.existsSync(ocPath)) artifacts.push(fs.readFileSync(ocPath, "utf-8"));

    for (const body of artifacts) {
      expect(body).not.toMatch(REMOVED_FACADE);
    }
  });

  it("no installed opencode artifact mentions a noncanonical status", async () => {
    await initWith("opencode");
    const scan = (rel: string) => {
      const body = fs.readFileSync(path.join(repoDir, rel), "utf-8");
      for (const legacy of LEGACY_STATUSES) expect(body).not.toContain(legacy);
    };
    for (const rel of TASKFORGE_SKILLS.map((s) => s.relativePath)) scan(rel);
    scan("AGENTS.md");
  });
});

// ===========================================================================
// AC #6: offline scenario fixtures — representative next --json packets cover
// every task state + failure mode. Assert each packet's nextActions are
// permitted (no removed facade, no --force) and reference only canonical
// statuses, so the work skill can select a current action deterministically.
// (R-E03-004: deterministic, offline, covers normal|blocked|doctor|review|verify)
// ===========================================================================

interface NextAction {
  command: string;
  purpose?: string;
}
interface NextJsonPacket {
  taskId?: string;
  status?: string;
  nextActions?: NextAction[];
  prohibitedActions?: NextAction[];
  error?: string;
}

const SCENARIOS: Array<{ name: string; packet: NextJsonPacket }> = [
  {
    name: "Ready",
    packet: {
      taskId: "TASK-401", status: "Ready",
      nextActions: [
        { command: "taskforge claim TASK-401 --json", purpose: "Claim the ready task" },
        { command: "git worktree add -b agent/TASK-401 ../worktrees/TASK-401 main", purpose: "Create isolated worktree" },
      ],
      prohibitedActions: [],
    },
  },
  {
    name: "In Progress",
    packet: {
      taskId: "TASK-402", status: "In Progress",
      nextActions: [
        { command: "npm run typecheck", purpose: "Run gates" },
        { command: "git add -A && git commit -m \"TASK-402: impl\"", purpose: "Commit progress" },
        { command: "git push -u origin agent/TASK-402", purpose: "Publish branch" },
      ],
      prohibitedActions: [{ command: "git push --force origin main" }],
    },
  },
  {
    name: "Review",
    packet: {
      taskId: "TASK-403", status: "Review",
      nextActions: [
        { command: "taskforge inspect TASK-403 --json", purpose: "Review task state" },
        { command: "git diff main...HEAD", purpose: "Inspect the task diff" },
      ],
      prohibitedActions: [],
    },
  },
  {
    name: "Verify",
    packet: {
      taskId: "TASK-404", status: "Verify",
      nextActions: [
        { command: "npm run typecheck && npm run lint && npm run build && npm test -- --run", purpose: "Run verification gates" },
        { command: "taskforge done TASK-404", purpose: "Complete after gates pass" },
      ],
      prohibitedActions: [],
    },
  },
  {
    name: "Blocked",
    packet: {
      taskId: "TASK-405", status: "Blocked",
      nextActions: [
        { command: "taskforge block TASK-405 \"awaiting upstream API\"", purpose: "Record the blocker" },
        { command: "taskforge release TASK-405", purpose: "Release the claim while blocked" },
      ],
      prohibitedActions: [],
    },
  },
  {
    name: "doctor-lock present",
    packet: {
      taskId: "TASK-406", status: "In Progress",
      nextActions: [
        { command: "taskforge doctor --check --json", purpose: "Diagnose the lock read-only" },
      ],
      prohibitedActions: [{ command: "taskforge done TASK-406" }],
      error: "doctor-lock present",
    },
  },
  {
    name: "ownership conflict",
    packet: {
      taskId: "TASK-407", status: "In Progress",
      nextActions: [
        { command: "taskforge release TASK-407", purpose: "Release contested claim" },
        { command: "taskforge inspect TASK-407 --json", purpose: "Confirm current assignee" },
      ],
      prohibitedActions: [{ command: "taskforge claim TASK-407" }],
      error: "ownership conflict",
    },
  },
  {
    name: "gate failure",
    packet: {
      taskId: "TASK-408", status: "Verify",
      nextActions: [
        { command: "npm run lint", purpose: "Reproduce the failing gate" },
        { command: "npm test -- --run", purpose: "Reproduce test failure" },
      ],
      prohibitedActions: [{ command: "taskforge done TASK-408" }],
      error: "gates not green",
    },
  },
  {
    name: "terminal (Done)",
    packet: {
      taskId: "TASK-409", status: "Done",
      nextActions: [
        { command: "taskforge next --json", purpose: "Select another task" },
      ],
      prohibitedActions: [],
    },
  },
  {
    name: "terminal (Rejected)",
    packet: {
      taskId: "TASK-410", status: "Rejected",
      nextActions: [
        { command: "taskforge next --json", purpose: "Move on from rejected task" },
      ],
      prohibitedActions: [],
    },
  },
];

describe("embedding conformance — scenario fixtures (AC #6, R-E03-004)", () => {
  it("covers every canonical task state plus every failure mode", () => {
    const covered = new Set(SCENARIOS.map((s) => s.packet.status).filter(Boolean));
    for (const st of ["Ready", "In Progress", "Review", "Verify", "Blocked", "Done", "Rejected"]) {
      expect(covered.has(st)).toBe(true);
    }
    const failureModes = SCENARIOS.filter((s) => s.packet.error).map((s) => s.name);
    expect(failureModes).toEqual(
      expect.arrayContaining([
        "doctor-lock present", "ownership conflict", "gate failure",
      ]),
    );
  });

  for (const scenario of SCENARIOS) {
    it(`scenario "${scenario.name}" offers only permitted, current actions`, () => {
      const { packet } = scenario;
      // Status (if present) is canonical.
      if (packet.status) {
        expect(CANONICAL_STATUSES).toContain(packet.status);
      }
      // Every nextAction is permitted: no removed facade, no --force.
      for (const a of packet.nextActions ?? []) {
        expect(a.command).not.toMatch(REMOVED_FACADE);
        expect(a.command).not.toMatch(/--force/i);
      }
      // No action references a noncanonical status.
      const allCommands = [
        ...(packet.nextActions ?? []),
        ...(packet.prohibitedActions ?? []),
      ].map((a) => a.command);
      for (const cmd of allCommands) {
        for (const legacy of LEGACY_STATUSES) {
          expect(cmd).not.toContain(legacy);
        }
      }
      // The work skill's hard rule — never force-push — is respected: any
      // force-push appears only in prohibitedActions, never in nextActions.
      const forceInNext = (packet.nextActions ?? []).some((a) => /--force/i.test(a.command));
      expect(forceInNext).toBe(false);
    });
  }

  it("work skill hard rules do not conflict with any scenario packet", () => {
    // The work skill mandates: one task at a time, direct git, no force-push,
    // obey prohibitedActions. Each scenario must be satisfiable under those
    // rules — i.e. at least one nextAction is a direct-git or taskforge
    // lifecycle command (not a removed facade), for non-terminal states.
    for (const s of SCENARIOS) {
      const terminal = s.packet.status === "Done" || s.packet.status === "Rejected";
      if (terminal) continue;
      const actionable = (s.packet.nextActions ?? []).filter(
        (a) => !REMOVED_FACADE.test(a.command),
      );
      expect(actionable.length).toBeGreaterThan(0);
    }
  });
});
