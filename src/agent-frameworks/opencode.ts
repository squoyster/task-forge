import fs from "node:fs";
import path from "node:path";
import type {
  AgentFrameworkAdapter,
  AgentFrameworkDetection,
  AgentFrameworkInitContext,
  AgentFrameworkDoctorContext,
  GeneratedFilePlan,
  Diagnostic,
} from "./types.js";
import { hasManagedBlock } from "../core/templates.js";

function detectConfig(projectRoot: string): AgentFrameworkDetection {
  const configPaths: string[] = [];
  const hasOpenCodeJson = fs.existsSync(path.join(projectRoot, "opencode.json"));
  const hasOpenCodeDir = fs.existsSync(path.join(projectRoot, ".opencode"));
  const hasAgentsDir = fs.existsSync(path.join(projectRoot, ".opencode", "agents"));

  if (hasOpenCodeJson) configPaths.push("opencode.json");
  if (hasOpenCodeDir) configPaths.push(".opencode/");
  if (hasAgentsDir) configPaths.push(".opencode/agents/");

  const detected = hasOpenCodeJson || hasOpenCodeDir;

  return {
    detected,
    frameworkId: detected ? "opencode" : undefined,
    configPaths,
  };
}

function checkOpenCodeJson(projectRoot: string): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const configPath = path.join(projectRoot, "opencode.json");

  if (!fs.existsSync(configPath)) {
    diags.push({ severity: "warn", check: "opencode-config", message: "opencode.json not found." });
    return diags;
  }

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);

    const permissions = config.permission ?? {};
    const bash = permissions.bash ?? {};
    const edit = permissions.edit ?? {};

    // Least-privilege invariants (TF-SIMP-06): global hard denies for force-push,
    // .git/**, and tasks/** that no broad allow can silently override, plus an
    // implementer profile that allows normal direct-git work while still denying force-push.
    const globalForceDeny = bash["git push --force*"] === "deny";
    const globalEditDeny = edit[".git/**"] === "deny" && edit["tasks/**"] === "deny";
    const impl = config.agent?.implementer?.permission ?? {};
    const implBash = impl.bash ?? {};
    const implAllowsGit = implBash["git push *"] === "allow" || implBash["git commit *"] === "allow";
    const implDeniesForce = implBash["git push --force*"] === "deny";

    if (globalForceDeny && globalEditDeny && implAllowsGit && implDeniesForce) {
      diags.push({ severity: "pass", check: "opencode-policy", message: "Least-privilege profiles enforce force-push/.git/tasks denials while allowing implementer direct-git work." });
    } else {
      diags.push({ severity: "fail", check: "opencode-policy", message: "Least-privilege invariants not met: global force-push/.git/tasks denies or implementer git-allow/force-deny missing." });
    }

    if (config.agent?.doctor) {
      diags.push({ severity: "pass", check: "opencode-doctor-agent", message: "Doctor agent is configured." });
    } else {
      diags.push({ severity: "warn", check: "opencode-doctor-agent", message: "Doctor agent is not configured." });
    }
  } catch {
    diags.push({ severity: "fail", check: "opencode-parse", message: "opencode.json is not valid JSON." });
  }

  return diags;
}

function checkAgentsMd(projectRoot: string): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const agentsPath = path.join(projectRoot, "AGENTS.md");

  if (!fs.existsSync(agentsPath)) {
    diags.push({ severity: "warn", check: "agents-md", message: "AGENTS.md not found." });
    return diags;
  }

  const content = fs.readFileSync(agentsPath, "utf-8");
  if (hasManagedBlock(content, "managed-agent-policy")) {
    diags.push({ severity: "pass", check: "agents-md", message: "AGENTS.md has managed-agent-policy block." });
  } else {
    diags.push({ severity: "fail", check: "agents-md", message: "AGENTS.md missing managed-agent-policy block." });
  }

  return diags;
}

function planOpenCodeFiles(ctx: AgentFrameworkInitContext): GeneratedFilePlan {
  const files: GeneratedFilePlan["files"] = [];
  const root = ctx.projectRoot;
  const openCodePath = path.join(root, "opencode.json");

  if (fs.existsSync(openCodePath)) {
    files.push({ path: "opencode.json", action: "update", description: "Merge TaskForge permissions into existing opencode.json" });
  } else {
    files.push({ path: "opencode.json", action: "create", description: "Create opencode.json with TaskForge-managed permissions" });
  }

  const agentsPath = path.join(root, ".opencode", "agents");
  const agentRoles = ["implementer", "reviewer", "qa", "doctor"];
  for (const role of agentRoles) {
    const rolePath = path.join(agentsPath, `${role}.md`);
    if (fs.existsSync(rolePath)) {
      files.push({ path: `.opencode/agents/${role}.md`, action: "update", description: `Update ${role} agent config` });
    } else {
      files.push({ path: `.opencode/agents/${role}.md`, action: "create", description: `Create ${role} agent config` });
    }
  }

  if (ctx.audit) {
    const auditPath = path.join(root, ".opencode", "plugins", "taskforge-audit.ts");
    files.push({
      path: ".opencode/plugins/taskforge-audit.ts",
      action: fs.existsSync(auditPath) ? "update" : "create",
      description: "Audit plugin for session/transcript logging",
    });
  }

  if (ctx.guard) {
    const guardPath = path.join(root, ".opencode", "plugins", "taskforge-guard.ts");
    files.push({
      path: ".opencode/plugins/taskforge-guard.ts",
      action: fs.existsSync(guardPath) ? "update" : "create",
      description: "Guard plugin for runtime policy enforcement",
    });
  }

  return { files };
}

export const opencodeAdapter: AgentFrameworkAdapter = {
  id: "opencode",
  displayName: "OpenCode",

  async detect(projectRoot: string): Promise<AgentFrameworkDetection> {
    return detectConfig(projectRoot);
  },

  async plan(ctx: AgentFrameworkInitContext): Promise<GeneratedFilePlan> {
    return planOpenCodeFiles(ctx);
  },

  async apply(ctx: AgentFrameworkInitContext): Promise<void> {
    if (ctx.dryRun) return;

    const { installAgentsMd } = await import("../core/agents-md.js");
    installAgentsMd(ctx.projectRoot, ctx.dryRun);

    const { installOpenCodeConfig } = await import("../core/opencode-config.js");
    installOpenCodeConfig(ctx.projectRoot, ctx.policy, ctx.audit, ctx.guard, ctx.dryRun);

    const { installGitHooks } = await import("../core/hooks.js");
    installGitHooks({
      projectRoot: ctx.projectRoot,
      dryRun: ctx.dryRun,
      installHooks: ctx.installHooks,
    });

    const { installAgentFiles } = await import("../core/agent-files.js");
    installAgentFiles(ctx.projectRoot, ctx.dryRun);

    if (ctx.audit) {
      const { installAuditPlugin } = await import("../core/audit-plugin.js");
      installAuditPlugin(ctx.projectRoot, ctx.dryRun);
    }

    if (ctx.guard) {
      const { installGuardPlugin } = await import("../core/guard-plugin.js");
      installGuardPlugin(ctx.projectRoot, ctx.policy, ctx.dryRun);
    }
  },

  async doctor(ctx: AgentFrameworkDoctorContext): Promise<Diagnostic[]> {
    return [...checkOpenCodeJson(ctx.projectRoot), ...checkAgentsMd(ctx.projectRoot)];
  },
};
