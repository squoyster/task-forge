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
      auditDir = path.join(repoRoot, "logs", "taskforge", "audit");
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
        permission: { bash: { "git *": "deny" }, edit: { "../task-state/**": "deny" } },
        agent: { doctor: true },
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
