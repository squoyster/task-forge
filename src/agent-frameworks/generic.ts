import type {
  AgentFrameworkAdapter,
  AgentFrameworkDetection,
  AgentFrameworkInitContext,
  AgentFrameworkDoctorContext,
  GeneratedFilePlan,
  Diagnostic,
} from "./types.js";

export const genericAdapter: AgentFrameworkAdapter = {
  id: "generic",
  displayName: "Generic (CLI-Only)",

  async detect(_projectRoot: string): Promise<AgentFrameworkDetection> {
    return { detected: true, frameworkId: "generic", configPaths: [] };
  },

  async plan(ctx: AgentFrameworkInitContext): Promise<GeneratedFilePlan> {
    const { getSkillFilePlanEntries } = await import("../core/skill-files.js");
    return { files: getSkillFilePlanEntries(ctx.projectRoot) };
  },

  async apply(ctx: AgentFrameworkInitContext): Promise<void> {
    if (ctx.dryRun) return;
    const { installSkillFiles } = await import("../core/skill-files.js");
    installSkillFiles(ctx.projectRoot, ctx.dryRun);
  },

  async doctor(_ctx: AgentFrameworkDoctorContext): Promise<Diagnostic[]> {
    return [{ severity: "pass", check: "generic-adapter", message: "Generic adapter is always available." }];
  },
};
