export interface AgentFrameworkDetection {
  detected: boolean;
  frameworkId?: string;
  configPaths: string[];
}

export interface AgentFrameworkInitContext {
  projectRoot: string;
  configPaths: string[];
  policy: "permissive" | "managed" | "locked-down";
  installHooks: boolean;
  audit: boolean;
  guard: boolean;
  dryRun: boolean;
}

export interface AgentFrameworkDoctorContext {
  projectRoot: string;
  configPaths: string[];
}

export interface Diagnostic {
  severity: "pass" | "warn" | "fail";
  check: string;
  message: string;
}

export interface GeneratedFilePlan {
  files: Array<{
    path: string;
    action: "create" | "update" | "skip";
    description: string;
  }>;
}

export interface AgentFrameworkAdapter {
  id: string;
  displayName: string;
  detect(projectRoot: string): Promise<AgentFrameworkDetection>;
  plan(ctx: AgentFrameworkInitContext): Promise<GeneratedFilePlan>;
  apply(ctx: AgentFrameworkInitContext): Promise<void>;
  doctor(ctx: AgentFrameworkDoctorContext): Promise<Diagnostic[]>;
}
