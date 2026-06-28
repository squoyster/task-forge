import path from "node:path";
import fs from "node:fs";
import { hasManagedBlock } from "./templates.js";
import { installAgentsMd } from "./agents-md.js";
import { RUNTIME_AUDIT_BASE } from "./audit.js";
import { installOpenCodeConfig } from "./opencode-config.js";
import { loadConfig } from "./config.js";
import { doctorSkillFiles, fixSkillFiles } from "./skill-files.js";

export interface DoctorIssue {
  severity: "error" | "warn" | "info";
  code: string;
  message: string;
  taskId?: string;
}

export interface DoctorRepair {
  code: string;
  message: string;
}

export interface AgentFrameworkAdapter {
  doctor(repoRoot: string): DoctorIssue[];
  fix(repoRoot: string): DoctorRepair[];
}

export class OpenCodeAgentFrameworkAdapter implements AgentFrameworkAdapter {
  doctor(repoRoot: string): DoctorIssue[] {
    const issues: DoctorIssue[] = [];

    // AGENTS.md managed block check
    const agentsMdPath = path.join(repoRoot, "AGENTS.md");
    if (fs.existsSync(agentsMdPath)) {
      const content = fs.readFileSync(agentsMdPath, "utf-8");
      if (hasManagedBlock(content, "managed-agent-policy")) {
        // OK
      } else {
        issues.push({ severity: "warn", code: "OPENCODE_AGENTS_MD", message: "AGENTS.md missing managed-agent-policy block" });
      }
    } else {
      issues.push({ severity: "warn", code: "OPENCODE_AGENTS_MD", message: "AGENTS.md not found — run 'taskforge init' to create" });
    }

    // opencode.json least-privilege permissions check (TF-SIMP-06)
    const openCodeJsonPath = path.join(repoRoot, "opencode.json");
    if (fs.existsSync(openCodeJsonPath)) {
      try {
        const ocConfig = JSON.parse(fs.readFileSync(openCodeJsonPath, "utf-8"));
        const bashPerms = ocConfig?.permission?.bash ?? {};
        const editPerms = ocConfig?.permission?.edit ?? {};
        const implBash = ocConfig?.agent?.implementer?.permission?.bash ?? {};
        const forceDeny = bashPerms["git push --force*"] === "deny" && implBash["git push --force*"] === "deny";
        const hardDeny = editPerms[".git/**"] === "deny" && editPerms["tasks/**"] === "deny";
        const implGitAllow = implBash["git push *"] === "allow" || implBash["git commit *"] === "allow";
        if (forceDeny && hardDeny && implGitAllow) {
          // OK
        } else {
          issues.push({ severity: "warn", code: "OPENCODE_PERMISSIONS", message: "opencode.json least-privilege invariants incomplete" });
        }
        if (ocConfig?.agent?.doctor) {
          // OK
        } else {
          issues.push({ severity: "warn", code: "OPENCODE_DOCTOR_AGENT", message: "opencode.json missing doctor agent" });
        }

        // MCP taskforge block check (AC #3, R-E03-002): the managed block must
        // exist; when enabled, it must be a valid local/stdio launcher.
        const mcp = ocConfig?.mcp?.taskforge;
        if (!mcp) {
          issues.push({ severity: "warn", code: "OPENCODE_MCP_MISSING", message: "opencode.json missing mcp.taskforge block — run 'taskforge init --repair'" });
        } else if (mcp.enabled === true) {
          const validStdio = mcp.type === "local" && Array.isArray(mcp.command) && mcp.command.length > 0;
          if (!validStdio) {
            issues.push({ severity: "warn", code: "OPENCODE_MCP_INVALID_STDIO", message: "mcp.taskforge enabled but not a valid stdio launcher (need type:'local' + non-empty command[])" });
          }
        }
      } catch {
        issues.push({ severity: "warn", code: "OPENCODE_JSON", message: "opencode.json is not valid JSON" });
      }
    }

    // Audit directory check
    const auditDir = path.join(repoRoot, RUNTIME_AUDIT_BASE, "audit");
    if (fs.existsSync(auditDir)) {
      issues.push({ severity: "info", code: "OPENCODE_AUDIT_DIR", message: "Audit directory exists" });
    } else {
      issues.push({ severity: "info", code: "OPENCODE_AUDIT_DIR", message: "Audit directory not yet created (will be created on first event)" });
    }

    // Managed skill drift (R-E03-002): shared across all skill-installing
    // frameworks. opencode installs skills via its adapter.apply().
    issues.push(...doctorSkillFiles(repoRoot));

    return issues;
  }

  fix(repoRoot: string): DoctorRepair[] {
    const repairs: DoctorRepair[] = [];
    const config = loadConfig(repoRoot);
    const policy = config.opencode?.policy ?? "managed";
    const audit = config.opencode?.audit ?? true;
    const guard = config.opencode?.guard ?? true;

    // Fix AGENTS.md
    const agentsMdPath = path.join(repoRoot, "AGENTS.md");
    if (!fs.existsSync(agentsMdPath)) {
      installAgentsMd(repoRoot, false);
      repairs.push({ code: "OPENCODE_AGENTS_MD", message: "Created AGENTS.md with managed-agent-policy block" });
    } else {
      const content = fs.readFileSync(agentsMdPath, "utf-8");
      if (!hasManagedBlock(content, "managed-agent-policy")) {
        installAgentsMd(repoRoot, false);
        repairs.push({ code: "OPENCODE_AGENTS_MD", message: "Added managed-agent-policy block to AGENTS.md" });
      }
    }

    // Fix opencode.json (permissions + MCP block)
    const openCodeJsonPath = path.join(repoRoot, "opencode.json");
    if (!fs.existsSync(openCodeJsonPath)) {
      installOpenCodeConfig(repoRoot, policy, audit, guard, false);
      repairs.push({ code: "OPENCODE_JSON", message: "Created opencode.json with TaskForge-managed permissions" });
    } else {
      try {
        const ocConfig = JSON.parse(fs.readFileSync(openCodeJsonPath, "utf-8"));
        const bashPerms = ocConfig?.permission?.bash ?? {};
        const editPerms = ocConfig?.permission?.edit ?? {};
        const mcp = ocConfig?.mcp?.taskforge;
        const mcpDrift = !mcp || (mcp.enabled === true && !(mcp.type === "local" && Array.isArray(mcp.command) && mcp.command.length > 0));
        const needsFix = bashPerms["git *"] !== "deny" || editPerms["../task-state/**"] !== "deny" || !ocConfig?.agent?.doctor || mcpDrift;
        if (needsFix) {
          installOpenCodeConfig(repoRoot, policy, audit, guard, false);
          repairs.push({ code: mcpDrift && bashPerms["git *"] === "deny" ? "OPENCODE_MCP" : "OPENCODE_PERMISSIONS", message: "Repaired opencode.json (permissions/MCP block/doctor agent)" });
        }
      } catch {
        installOpenCodeConfig(repoRoot, policy, audit, guard, false);
        repairs.push({ code: "OPENCODE_JSON", message: "Recreated opencode.json (was invalid JSON)" });
      }
    }

    // Create audit directory
    const auditDir = path.join(repoRoot, RUNTIME_AUDIT_BASE, "audit");
    if (!fs.existsSync(auditDir)) {
      fs.mkdirSync(auditDir, { recursive: true });
      repairs.push({ code: "OPENCODE_AUDIT_DIR", message: "Created audit directory" });
    }

    // Repair managed skill drift (R-E03-002, R-E03-003): idempotent reinstall
    // of canonical skill files only.
    repairs.push(...fixSkillFiles(repoRoot));

    return repairs;
  }
}

export class GenericAgentFrameworkAdapter implements AgentFrameworkAdapter {
  /**
   * When checkSkills is true (framework installs skills: generic/auto), the
   * adapter reports managed-skill drift. When false (framework 'none'), no
   * managed skills are expected and the adapter is a no-op.
   */
  constructor(private readonly opts: { checkSkills?: boolean } = {}) {}

  doctor(repoRoot: string): DoctorIssue[] {
    if (!this.opts.checkSkills) return [];
    return doctorSkillFiles(repoRoot);
  }

  fix(repoRoot: string): DoctorRepair[] {
    if (!this.opts.checkSkills) return [];
    return fixSkillFiles(repoRoot);
  }
}

export function getAgentFrameworkAdapter(frameworkId?: string): AgentFrameworkAdapter {
  if (frameworkId === "opencode") {
    return new OpenCodeAgentFrameworkAdapter();
  }
  // 'none' installs no managed skills; everything else (generic, auto,
  // undefined) does.
  const checkSkills = frameworkId !== "none";
  return new GenericAgentFrameworkAdapter({ checkSkills });
}
