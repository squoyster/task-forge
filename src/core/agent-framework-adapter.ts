import path from "node:path";
import fs from "node:fs";
import { hasManagedBlock } from "./templates.js";
import { installAgentsMd } from "./agents-md.js";
import { RUNTIME_AUDIT_BASE } from "./audit.js";
import { installOpenCodeConfig } from "./opencode-config.js";
import { loadConfig } from "./config.js";

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

    // Fix opencode.json
    const openCodeJsonPath = path.join(repoRoot, "opencode.json");
    if (!fs.existsSync(openCodeJsonPath)) {
      installOpenCodeConfig(repoRoot, policy, audit, guard, false);
      repairs.push({ code: "OPENCODE_JSON", message: "Created opencode.json with TaskForge-managed permissions" });
    } else {
      try {
        const ocConfig = JSON.parse(fs.readFileSync(openCodeJsonPath, "utf-8"));
        const bashPerms = ocConfig?.permission?.bash ?? {};
        const editPerms = ocConfig?.permission?.edit ?? {};
        const needsFix = bashPerms["git *"] !== "deny" || editPerms["../task-state/**"] !== "deny" || !ocConfig?.agent?.doctor;
        if (needsFix) {
          installOpenCodeConfig(repoRoot, policy, audit, guard, false);
          repairs.push({ code: "OPENCODE_PERMISSIONS", message: "Repaired opencode.json agent permissions and doctor agent config" });
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

    return repairs;
  }
}

export class GenericAgentFrameworkAdapter implements AgentFrameworkAdapter {
  doctor(_repoRoot: string): DoctorIssue[] {
    return [];
  }

  fix(_repoRoot: string): DoctorRepair[] {
    return [];
  }
}

export function getAgentFrameworkAdapter(frameworkId?: string): AgentFrameworkAdapter {
  if (frameworkId === "opencode") {
    return new OpenCodeAgentFrameworkAdapter();
  }
  return new GenericAgentFrameworkAdapter();
}
