import {
  getConfigJsonPath
} from "./chunk-46G2ACH2.js";
import {
  replaceManagedBlock,
  writeGeneratedFile
} from "./chunk-5JWCMI7A.js";
import {
  logInfo,
  logSuccess
} from "./chunk-OPCWHN3N.js";

// src/core/agents-md.ts
import fs2 from "fs";
import path from "path";

// src/core/config.ts
import { z } from "zod";
import fs from "fs";
var ConfigSchema = z.object({
  project: z.object({
    name: z.string().optional(),
    defaultBranch: z.string().default("main")
  }).optional().default({}),
  tasks: z.object({
    directory: z.string().default("tasks"),
    idPrefix: z.string().default("TASK"),
    template: z.string().default("tasks/TEMPLATE.md")
  }).optional().default({}),
  worktrees: z.object({
    root: z.string().default("../worktrees"),
    branchPrefix: z.string().default("agent")
  }).optional().default({}),
  github: z.object({
    enabled: z.boolean().default(false),
    owner: z.string().optional(),
    repo: z.string().optional(),
    projectNumber: z.number().optional(),
    projects: z.object({
      statusField: z.string().default("Status"),
      columnMapping: z.record(z.string()).optional()
    }).optional().default({}),
    labels: z.object({
      task: z.string().default("taskforge"),
      blocked: z.string().default("blocked"),
      agentReady: z.string().default("agent-ready")
    }).optional().default({})
  }).optional().default({}),
  opencode: z.object({
    enabled: z.boolean().default(true),
    command: z.string().default("opencode"),
    policy: z.enum(["permissive", "managed", "locked-down"]).default("managed"),
    audit: z.boolean().default(true),
    guard: z.boolean().default(true),
    policyVersion: z.number().default(1)
  }).optional().default({}),
  continuation: z.object({
    autoContinue: z.boolean().default(true),
    maxTaskFixIterations: z.number().default(3),
    allowDraftPr: z.boolean().default(true),
    allowCommit: z.boolean().default(true),
    allowPush: z.boolean().default(false)
  }).optional().default({}),
  dependencies: z.object({
    enabled: z.boolean().default(true),
    packageManager: z.enum(["pnpm", "npm", "yarn"]).default("pnpm"),
    scan: z.object({
      osv: z.boolean().default(true),
      packageAudit: z.boolean().default(true),
      deprecated: z.boolean().default(true),
      outdated: z.boolean().default(true),
      snyk: z.boolean().default(false),
      trivy: z.boolean().default(false),
      syft: z.boolean().default(false)
    }).optional().default({}),
    policy: z.object({
      autoPrPatchUpdates: z.boolean().default(true),
      autoPrMinorDevUpdates: z.boolean().default(true),
      autoPrMinorRuntimeUpdates: z.boolean().default(false),
      requireHumanForMajor: z.boolean().default(true),
      requireHumanForLicenseChange: z.boolean().default(true),
      requireHumanForAuthSecurityPackages: z.boolean().default(true),
      maxLockfileChangedPackagesWithoutReview: z.number().default(20)
    }).optional().default({})
  }).optional().default({}),
  gates: z.object({
    typecheck: z.string().default("npm run typecheck"),
    lint: z.string().default("npm run lint"),
    build: z.string().default("npm run build"),
    test: z.string().default("npm test -- --run")
  }).optional().default({}),
  controlFiles: z.array(z.string()).optional().default([]),
  agentFramework: z.object({
    id: z.union([z.literal("generic"), z.literal("opencode"), z.string()]).optional(),
    installHooks: z.boolean().default(true)
  }).optional().default({})
});
var DEFAULT_CONFIG = ConfigSchema.parse({});
function loadConfig(repoRoot) {
  const configPath = getConfigJsonPath(repoRoot);
  if (!fs.existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }
  const raw = fs.readFileSync(configPath, "utf-8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in config file ${configPath}: ${message}`);
  }
  try {
    return ConfigSchema.parse(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid config schema in ${configPath}: ${message}`);
  }
}

// src/core/agents-md.ts
function installAgentsMd(projectRoot, dryRun) {
  const agentsPath = path.join(projectRoot, "AGENTS.md");
  const config = loadConfig(projectRoot);
  const policy = config.opencode.policy ?? "managed";
  const managedBlockContent = generateAgentsPolicyBlock(policy);
  if (fs2.existsSync(agentsPath)) {
    const existing = fs2.readFileSync(agentsPath, "utf-8");
    if (existing.includes("<!-- TASKFORGE:BEGIN managed-agent-policy -->") && existing.includes(managedBlockContent)) {
      logInfo("AGENTS.md already has current managed policy block.");
      return;
    }
    if (dryRun) {
      logInfo(`AGENTS.md would be updated with managed policy block.`);
      return;
    }
    const updated = replaceManagedBlock(existing, "managed-agent-policy", managedBlockContent);
    fs2.writeFileSync(agentsPath, updated, "utf-8");
    logSuccess("AGENTS.md updated with managed policy block.");
  } else {
    if (dryRun) {
      logInfo(`AGENTS.md would be created with managed policy block.`);
      return;
    }
    const content = generateFullAgentsMd(projectRoot, managedBlockContent);
    writeGeneratedFile(agentsPath, content);
    logSuccess("AGENTS.md created with managed policy block.");
  }
}
function generateAgentsPolicyBlock(policy) {
  const policyLevel = policy === "permissive" ? "\u{1F539} Permissive" : policy === "locked-down" ? "\u{1F512} Locked-Down" : "\u{1F539} Managed";
  return `## TaskForge Managed Policy (${policyLevel})

This repository is managed by TaskForge. All agents operating in this repository must follow these policies.

### Normal Agent Rules

- Use TaskForge lifecycle commands: \`taskforge start\`, \`taskforge done\`, \`taskforge checkpoint\`, \`taskforge submit\`
- Never run \`git\` directly (use \`taskforge diff\`, \`taskforge checkpoint\`, \`taskforge submit\` instead)
- Never edit files under \`../task-state/*.md\` directly
- Never edit legacy \`tasks/*.md\` files
- All task-state changes must flow through TaskForge CLI commands
- Do not edit \`.opencode/**\` or \`.taskforge/**\` unless role is doctor
- Stop all normal operations when \`.doctor-lock\` exists

### Doctor Mode Protocol

Doctor agents operate under elevated but constrained permissions:

- Run \`taskforge doctor --check\` first for diagnostics
- Acquire doctor lock: \`TASKFORGE_ACTOR=doctor taskforge doctor --lock --reason "..."\`
- Minimize direct task-state edits \u2014 prefer TaskForge commands
- Release doctor lock after repair: \`taskforge done\` on recovery task
- Never force push to main or task-state branches

### Allowed Normal Agent Commands

\`\`\`bash
taskforge next
taskforge start TASK-ID
taskforge heartbeat TASK-ID
taskforge inspect TASK-ID
taskforge diff TASK-ID
taskforge checkpoint TASK-ID --message "..."
taskforge submit TASK-ID
taskforge done TASK-ID
taskforge block TASK-ID "reason"
taskforge release TASK-ID
taskforge doctor --check
\`\`\``;
}
function generateFullAgentsMd(projectRoot, managedBlock) {
  const projectName = path.basename(projectRoot);
  return `# AGENTS.md \u2014 ${projectName}

## TaskForge Agent Instructions

This file provides operational instructions for coding agents working on the ${projectName} project.

<!-- TASKFORGE:BEGIN managed-agent-policy -->
${managedBlock}
<!-- TASKFORGE:END managed-agent-policy -->
`;
}

export {
  loadConfig,
  installAgentsMd
};
//# sourceMappingURL=chunk-QBLAIQUG.js.map