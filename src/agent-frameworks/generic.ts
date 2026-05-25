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

  async plan(_ctx: AgentFrameworkInitContext): Promise<GeneratedFilePlan> {
    return { files: [] };
  },

  async apply(_ctx: AgentFrameworkInitContext): Promise<void> {},

  async doctor(_ctx: AgentFrameworkDoctorContext): Promise<Diagnostic[]> {
    return [{ severity: "pass", check: "generic-adapter", message: "Generic adapter is always available." }];
  },
};
