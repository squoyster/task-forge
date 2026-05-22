import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "./config.js";
import { getRepoRoot } from "../util/paths.js";

const DEFAULT_CONTROL_FILES = [
  "AGENTS.md",
  "TASKFORGE.md",
  "README.md",
  "CHANGELOG.md",
  "package.json",
  "tsconfig.json",
  "tsup.config.ts",
  ".taskforge/config.json",
];

export function getControlFiles(repoRoot?: string): string[] {
  const root = repoRoot ?? getRepoRoot();
  const config = loadConfig(root);
  const configured = config?.controlFiles ?? [];
  return [...new Set([...DEFAULT_CONTROL_FILES, ...configured])];
}

export function hashControlFiles(repoRoot?: string): string {
  const root = repoRoot ?? getRepoRoot();
  const files = getControlFiles(root);
  const hash = crypto.createHash("sha256");

  for (const file of files.sort()) {
    const filePath = path.join(root, file);
    if (fs.existsSync(filePath)) {
      hash.update(file);
      hash.update(fs.readFileSync(filePath, "utf-8"));
    }
  }

  return hash.digest("hex").substring(0, 16);
}

export function detectControlFileCandidates(repoRoot?: string): string[] {
  const root = repoRoot ?? getRepoRoot();
  const candidates: string[] = [];
  const patterns = [
    /AGENTS\.md$/,
    /TASKFORGE\.md$/,
    /config.*\.(json|yaml|ts)$/,
    /schema.*\.ts$/,
    /errors\.ts$/,
    /constants\.ts$/,
    /templates\.ts$/,
    /\.opencode\/.*\.md$/,
  ];

  function scan(dir: string, depth: number) {
    if (depth > 4) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full, depth + 1);
        } else if (patterns.some((p) => p.test(full))) {
          candidates.push(path.relative(root, full));
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  scan(root, 0);
  return candidates.filter((c) => !getControlFiles(root).includes(c));
}
