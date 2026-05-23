import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface InitAuditEntry {
  timestamp: string;
  step: string;
  outcome: "success" | "warning" | "error" | "info";
  detail?: string;
  durationMs?: number;
}

const SECRET_PATTERNS = [
  /ghp_[a-zA-Z0-9]{36,}/g,
  /gho_[a-zA-Z0-9]{36,}/g,
  /github_pat_[a-zA-Z0-9_]{40,}/g,
  /(?:api[_-]?key|token|secret|password|passwd|auth)\s*[:=]\s*\S+/gi,
  /\b[a-f0-9]{40}\b/g,
];

function elide(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

function getAuditDir(repoRoot: string): string {
  return path.join(repoRoot, "logs", "taskforge", "audit");
}

function getAuditPath(repoRoot: string): string {
  const dir = getAuditDir(repoRoot);
  const date = new Date().toISOString().split("T")[0];
  return path.join(dir, `init-${date}.jsonl`);
}

export class InitAuditLog {
  private repoRoot: string;
  private entries: InitAuditEntry[] = [];
  private sessionStart: number;

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
    this.sessionStart = Date.now();
  }

  record(step: string, outcome: InitAuditEntry["outcome"], detail?: string): void {
    const entry: InitAuditEntry = {
      timestamp: new Date().toISOString(),
      step,
      outcome,
      detail: detail ? elide(detail) : undefined,
      durationMs: Date.now() - this.sessionStart,
    };
    this.entries.push(entry);
  }

  private flush(): void {
    const auditPath = getAuditPath(this.repoRoot);
    const dir = path.dirname(auditPath);
    fs.mkdirSync(dir, { recursive: true });

    const hostname = os.hostname();
    const line = JSON.stringify({
      hostname,
      sessionStart: new Date(this.sessionStart).toISOString(),
      entries: this.entries,
    }) + "\n";

    fs.appendFileSync(auditPath, line, "utf-8");
  }

  complete(): void {
    this.record("init.complete", "success");
    this.flush();
  }

  getSummary(): string {
    const successCount = this.entries.filter((e) => e.outcome === "success").length;
    const warnCount = this.entries.filter((e) => e.outcome === "warning").length;
    const errorCount = this.entries.filter((e) => e.outcome === "error").length;
    return `${this.entries.length} steps: ${successCount} success, ${warnCount} warnings, ${errorCount} errors`;
  }
}
