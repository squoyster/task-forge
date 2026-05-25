import path from "node:path";
import fs from "node:fs";
import { hasManagedBlock } from "./templates.js";

export interface DoctorIssue {
  severity: "error" | "warn" | "info";
  code: string;
  message: string;
  taskId?: string;
}

export interface AgentFrameworkAdapter {
  doctor(repoRoot: string): DoctorIssue[];
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

    // opencode.json permissions check
    const openCodeJsonPath = path.join(repoRoot, "opencode.json");
    if (fs.existsSync(openCodeJsonPath)) {
      try {
        const ocConfig = JSON.parse(fs.readFileSync(openCodeJsonPath, "utf-8"));
        const bashPerms = ocConfig?.permission?.bash ?? {};
        const editPerms = ocConfig?.permission?.edit ?? {};
        if (bashPerms["git *"] === "deny" && editPerms["../task-state/**"] === "deny") {
          // OK
        } else {
          issues.push({ severity: "warn", code: "OPENCODE_PERMISSIONS", message: "opencode.json agent permissions incomplete" });
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
    const auditDir = path.join(repoRoot, "logs", "taskforge", "audit");
    if (fs.existsSync(auditDir)) {
      issues.push({ severity: "info", code: "OPENCODE_AUDIT_DIR", message: "Audit directory exists" });
    } else {
      issues.push({ severity: "info", code: "OPENCODE_AUDIT_DIR", message: "Audit directory not yet created (will be created on first event)" });
    }

    return issues;
  }
}

export class GenericAgentFrameworkAdapter implements AgentFrameworkAdapter {
  doctor(_repoRoot: string): DoctorIssue[] {
    return [];
  }
}

export function getAgentFrameworkAdapter(frameworkId?: string): AgentFrameworkAdapter {
  if (frameworkId === "opencode") {
    return new OpenCodeAgentFrameworkAdapter();
  }
  return new GenericAgentFrameworkAdapter();
}
