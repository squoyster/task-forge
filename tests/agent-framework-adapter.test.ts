import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { OpenCodeAgentFrameworkAdapter, GenericAgentFrameworkAdapter, getAgentFrameworkAdapter } from "../src/core/agent-framework-adapter.js";
import fs from "node:fs";
import path from "node:path";

describe("AgentFrameworkAdapter", () => {
  describe("GenericAgentFrameworkAdapter", () => {
    it("returns no issues", () => {
      const adapter = new GenericAgentFrameworkAdapter();
      const issues = adapter.doctor("/fake/repo");
      expect(issues).toEqual([]);
    });

    it("fix returns no repairs", () => {
      const adapter = new GenericAgentFrameworkAdapter();
      const repairs = adapter.fix("/fake/repo");
      expect(repairs).toEqual([]);
    });
  });

  describe("OpenCodeAgentFrameworkAdapter", () => {
    const adapter = new OpenCodeAgentFrameworkAdapter();
    let repoRoot: string;
    let agentsMdPath: string;
    let openCodeJsonPath: string;
    let auditDir: string;

    beforeEach(() => {
      repoRoot = fs.mkdtempSync("/tmp/taskforge-doctor-");
      agentsMdPath = path.join(repoRoot, "AGENTS.md");
      openCodeJsonPath = path.join(repoRoot, "opencode.json");
      auditDir = path.join(repoRoot, ".taskforge", "runtime", "logs", "taskforge", "audit");
    });

    afterEach(() => {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    });

    it("warns when AGENTS.md is missing", () => {
      const issues = adapter.doctor(repoRoot);
      const agentsMdIssue = issues.find((i) => i.code === "OPENCODE_AGENTS_MD");
      expect(agentsMdIssue).toBeDefined();
      expect(agentsMdIssue?.severity).toBe("warn");
    });

    it("warns when AGENTS.md lacks managed-agent-policy block", () => {
      fs.writeFileSync(agentsMdPath, "# Agents\nNo managed block here");
      const issues = adapter.doctor(repoRoot);
      const agentsMdIssue = issues.find((i) => i.code === "OPENCODE_AGENTS_MD");
      expect(agentsMdIssue).toBeDefined();
      expect(agentsMdIssue?.severity).toBe("warn");
    });

    it("does not warn when AGENTS.md has managed-agent-policy block", () => {
      fs.writeFileSync(agentsMdPath, "# Agents\n<!-- TASKFORGE:BEGIN managed-agent-policy -->\n<!-- TASKFORGE:END managed-agent-policy -->");
      const issues = adapter.doctor(repoRoot);
      const agentsMdIssue = issues.find((i) => i.code === "OPENCODE_AGENTS_MD");
      expect(agentsMdIssue).toBeUndefined();
    });

    it("warns when opencode.json is missing", () => {
      const issues = adapter.doctor(repoRoot);
      const permsIssue = issues.find((i) => i.code === "OPENCODE_PERMISSIONS");
      const doctorAgentIssue = issues.find((i) => i.code === "OPENCODE_DOCTOR_AGENT");
      expect(permsIssue).toBeUndefined();
      expect(doctorAgentIssue).toBeUndefined();
    });

    it("warns when opencode.json has incomplete permissions", () => {
      fs.writeFileSync(openCodeJsonPath, JSON.stringify({ permission: { bash: {}, edit: {} } }));
      const issues = adapter.doctor(repoRoot);
      const permsIssue = issues.find((i) => i.code === "OPENCODE_PERMISSIONS");
      expect(permsIssue).toBeDefined();
      expect(permsIssue?.severity).toBe("warn");
    });

    it("does not warn when opencode.json has correct permissions", () => {
      fs.writeFileSync(openCodeJsonPath, JSON.stringify({
        permission: { bash: { "git push --force*": "deny" }, edit: { ".git/**": "deny", "tasks/**": "deny" } },
        agent: {
          doctor: true,
          implementer: { permission: { bash: { "git push *": "allow", "git push --force*": "deny" } } },
        },
      }));
      const issues = adapter.doctor(repoRoot);
      const permsIssue = issues.find((i) => i.code === "OPENCODE_PERMISSIONS");
      const doctorAgentIssue = issues.find((i) => i.code === "OPENCODE_DOCTOR_AGENT");
      expect(permsIssue).toBeUndefined();
      expect(doctorAgentIssue).toBeUndefined();
    });

    it("warns when opencode.json is invalid JSON", () => {
      fs.writeFileSync(openCodeJsonPath, "not json");
      const issues = adapter.doctor(repoRoot);
      const jsonIssue = issues.find((i) => i.code === "OPENCODE_JSON");
      expect(jsonIssue).toBeDefined();
      expect(jsonIssue?.severity).toBe("warn");
    });

    it("reports info about audit directory", () => {
      const issues = adapter.doctor(repoRoot);
      const auditIssue = issues.find((i) => i.code === "OPENCODE_AUDIT_DIR");
      expect(auditIssue).toBeDefined();
      expect(auditIssue?.severity).toBe("info");
    });

    it("reports audit directory exists when created", () => {
      fs.mkdirSync(auditDir, { recursive: true });
      const issues = adapter.doctor(repoRoot);
      const auditIssue = issues.find((i) => i.code === "OPENCODE_AUDIT_DIR");
      expect(auditIssue?.message).toContain("exists");
    });

    describe("fix", () => {
      it("creates missing AGENTS.md", () => {
        const repairs = adapter.fix(repoRoot);
        const agentsMdRepair = repairs.find((r) => r.code === "OPENCODE_AGENTS_MD");
        expect(agentsMdRepair).toBeDefined();
        expect(fs.existsSync(agentsMdPath)).toBe(true);
      });

      it("adds missing managed-agent-policy block to AGENTS.md", () => {
        fs.writeFileSync(agentsMdPath, "# Agents\nNo managed block");
        const repairs = adapter.fix(repoRoot);
        const agentsMdRepair = repairs.find((r) => r.code === "OPENCODE_AGENTS_MD");
        expect(agentsMdRepair).toBeDefined();
        const content = fs.readFileSync(agentsMdPath, "utf-8");
        expect(content).toContain("<!-- TASKFORGE:BEGIN managed-agent-policy -->");
      });

      it("does not repair AGENTS.md when already valid", () => {
        fs.writeFileSync(agentsMdPath, "# Agents\n<!-- TASKFORGE:BEGIN managed-agent-policy -->\n<!-- TASKFORGE:END managed-agent-policy -->");
        const repairs = adapter.fix(repoRoot);
        const agentsMdRepair = repairs.find((r) => r.code === "OPENCODE_AGENTS_MD");
        expect(agentsMdRepair).toBeUndefined();
      });

      it("creates missing opencode.json", () => {
        const repairs = adapter.fix(repoRoot);
        const jsonRepair = repairs.find((r) => r.code === "OPENCODE_JSON");
        expect(jsonRepair).toBeDefined();
        expect(fs.existsSync(openCodeJsonPath)).toBe(true);
      });

      it("repairs incomplete opencode.json permissions", () => {
        fs.writeFileSync(openCodeJsonPath, JSON.stringify({ permission: { bash: {}, edit: {} } }));
        const repairs = adapter.fix(repoRoot);
        const permsRepair = repairs.find((r) => r.code === "OPENCODE_PERMISSIONS");
        expect(permsRepair).toBeDefined();
        const config = JSON.parse(fs.readFileSync(openCodeJsonPath, "utf-8"));
        expect(config.permission?.bash?.["git push --force*"]).toBe("deny");
        expect(config.permission?.edit?.[".git/**"]).toBe("deny");
        expect(config.agent?.implementer?.permission?.bash?.["git push *"]).toBe("allow");
      });

      it("creates missing audit directory", () => {
        const repairs = adapter.fix(repoRoot);
        const auditRepair = repairs.find((r) => r.code === "OPENCODE_AUDIT_DIR");
        expect(auditRepair).toBeDefined();
        expect(fs.existsSync(auditDir)).toBe(true);
      });

      it("does not repair when everything is already valid", () => {
        fs.writeFileSync(agentsMdPath, "# Agents\n<!-- TASKFORGE:BEGIN managed-agent-policy -->\n<!-- TASKFORGE:END managed-agent-policy -->");
        fs.writeFileSync(openCodeJsonPath, JSON.stringify({
          permission: { bash: { "git *": "deny" }, edit: { "../task-state/**": "deny" } },
          agent: { doctor: true },
        }));
        fs.mkdirSync(auditDir, { recursive: true });
        const repairs = adapter.fix(repoRoot);
        expect(repairs).toEqual([]);
      });

      it("doctor after fix shows no issues", () => {
        adapter.fix(repoRoot);
        const issues = adapter.doctor(repoRoot);
        const warnIssues = issues.filter((i) => i.severity === "warn");
        expect(warnIssues).toEqual([]);
      });
    });
  });

  describe("getAgentFrameworkAdapter", () => {
    it("returns OpenCodeAdapter for 'opencode' id", () => {
      const adapter = getAgentFrameworkAdapter("opencode");
      expect(adapter).toBeInstanceOf(OpenCodeAgentFrameworkAdapter);
    });

    it("returns GenericAdapter for undefined id", () => {
      const adapter = getAgentFrameworkAdapter(undefined);
      expect(adapter).toBeInstanceOf(GenericAgentFrameworkAdapter);
    });

    it("returns GenericAdapter for unknown id", () => {
      const adapter = getAgentFrameworkAdapter("custom-framework");
      expect(adapter).toBeInstanceOf(GenericAgentFrameworkAdapter);
    });

    it("returns GenericAdapter for 'generic' id", () => {
      const adapter = getAgentFrameworkAdapter("generic");
      expect(adapter).toBeInstanceOf(GenericAgentFrameworkAdapter);
    });
  });
});
