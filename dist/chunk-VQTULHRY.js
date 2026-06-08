import {
  hasManagedBlock
} from "./chunk-5JWCMI7A.js";

// src/agent-frameworks/opencode.ts
import fs from "fs";
import path from "path";
function detectConfig(projectRoot) {
  const configPaths = [];
  const hasOpenCodeJson = fs.existsSync(path.join(projectRoot, "opencode.json"));
  const hasOpenCodeDir = fs.existsSync(path.join(projectRoot, ".opencode"));
  const hasAgentsDir = fs.existsSync(path.join(projectRoot, ".opencode", "agents"));
  if (hasOpenCodeJson) configPaths.push("opencode.json");
  if (hasOpenCodeDir) configPaths.push(".opencode/");
  if (hasAgentsDir) configPaths.push(".opencode/agents/");
  const detected = hasOpenCodeJson || hasOpenCodeDir;
  return {
    detected,
    frameworkId: detected ? "opencode" : void 0,
    configPaths
  };
}
function checkOpenCodeJson(projectRoot) {
  const diags = [];
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
    if (bash["git *"] === "deny" && edit["../task-state/**"] === "deny") {
      diags.push({ severity: "pass", check: "opencode-policy", message: "Normal agent permissions deny git and task-state edits." });
    } else {
      diags.push({ severity: "fail", check: "opencode-policy", message: "Normal agent permissions do not fully deny git or task-state edits." });
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
function checkAgentsMd(projectRoot) {
  const diags = [];
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
function planOpenCodeFiles(ctx) {
  const files = [];
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
      description: "Audit plugin for session/transcript logging"
    });
  }
  if (ctx.guard) {
    const guardPath = path.join(root, ".opencode", "plugins", "taskforge-guard.ts");
    files.push({
      path: ".opencode/plugins/taskforge-guard.ts",
      action: fs.existsSync(guardPath) ? "update" : "create",
      description: "Guard plugin for runtime policy enforcement"
    });
  }
  return { files };
}
var opencodeAdapter = {
  id: "opencode",
  displayName: "OpenCode",
  async detect(projectRoot) {
    return detectConfig(projectRoot);
  },
  async plan(ctx) {
    return planOpenCodeFiles(ctx);
  },
  async apply(ctx) {
    if (ctx.dryRun) return;
    const { installAgentsMd } = await import("./agents-md-YZLPMM4N.js");
    installAgentsMd(ctx.projectRoot, ctx.dryRun);
    const { installOpenCodeConfig } = await import("./opencode-config-XC77TTXM.js");
    installOpenCodeConfig(ctx.projectRoot, ctx.policy, ctx.audit, ctx.guard, ctx.dryRun);
    const { installGitHooks } = await import("./hooks-OXD7KHEY.js");
    installGitHooks({
      projectRoot: ctx.projectRoot,
      dryRun: ctx.dryRun,
      installHooks: ctx.installHooks
    });
    const { installAgentFiles } = await import("./agent-files-XPIYCK4G.js");
    installAgentFiles(ctx.projectRoot, ctx.dryRun);
    if (ctx.audit) {
      const { installAuditPlugin } = await import("./audit-plugin-TS6NRRLX.js");
      installAuditPlugin(ctx.projectRoot, ctx.dryRun);
    }
    if (ctx.guard) {
      const { installGuardPlugin } = await import("./guard-plugin-ZBHNJXZY.js");
      installGuardPlugin(ctx.projectRoot, ctx.policy, ctx.dryRun);
    }
  },
  async doctor(ctx) {
    return [...checkOpenCodeJson(ctx.projectRoot), ...checkAgentsMd(ctx.projectRoot)];
  }
};

export {
  opencodeAdapter
};
//# sourceMappingURL=chunk-VQTULHRY.js.map