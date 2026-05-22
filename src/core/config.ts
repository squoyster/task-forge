import { z } from "zod";

export const ConfigSchema = z.object({
  project: z
    .object({
      name: z.string().optional(),
      defaultBranch: z.string().default("main"),
    })
    .optional()
    .default({}),
  tasks: z
    .object({
      directory: z.string().default("tasks"),
      idPrefix: z.string().default("TASK"),
      template: z.string().default("tasks/TEMPLATE.md"),
    })
    .optional()
    .default({}),
  worktrees: z
    .object({
      root: z.string().default("../worktrees"),
      branchPrefix: z.string().default("agent"),
    })
    .optional()
    .default({}),
  github: z
    .object({
      enabled: z.boolean().default(false),
      owner: z.string().optional(),
      repo: z.string().optional(),
      projectNumber: z.number().optional(),
      labels: z
        .object({
          task: z.string().default("taskforge"),
          blocked: z.string().default("blocked"),
          agentReady: z.string().default("agent-ready"),
        })
        .optional()
        .default({}),
    })
    .optional()
    .default({}),
  opencode: z
    .object({
      enabled: z.boolean().default(true),
      command: z.string().default("opencode"),
    })
    .optional()
    .default({}),
  continuation: z
    .object({
      autoContinue: z.boolean().default(true),
      maxTaskFixIterations: z.number().default(3),
      allowDraftPr: z.boolean().default(true),
      allowCommit: z.boolean().default(true),
      allowPush: z.boolean().default(false),
    })
    .optional()
    .default({}),
  dependencies: z
    .object({
      enabled: z.boolean().default(true),
      packageManager: z.enum(["pnpm", "npm", "yarn"]).default("pnpm"),
      scan: z
        .object({
          osv: z.boolean().default(true),
          packageAudit: z.boolean().default(true),
          deprecated: z.boolean().default(true),
          outdated: z.boolean().default(true),
          snyk: z.boolean().default(false),
          trivy: z.boolean().default(false),
          syft: z.boolean().default(false),
        })
        .optional()
        .default({}),
      policy: z
        .object({
          autoPrPatchUpdates: z.boolean().default(true),
          autoPrMinorDevUpdates: z.boolean().default(true),
          autoPrMinorRuntimeUpdates: z.boolean().default(false),
          requireHumanForMajor: z.boolean().default(true),
          requireHumanForLicenseChange: z.boolean().default(true),
          requireHumanForAuthSecurityPackages: z.boolean().default(true),
          maxLockfileChangedPackagesWithoutReview: z.number().default(20),
        })
        .optional()
        .default({}),
    })
    .optional()
    .default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

export const DEFAULT_CONFIG: Config = ConfigSchema.parse({});

import fs from "node:fs";
import { getConfigJsonPath } from "../util/paths.js";

export function loadConfig(repoRoot: string): Config {
  const configPath = getConfigJsonPath(repoRoot);
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      return ConfigSchema.parse(parsed);
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}
