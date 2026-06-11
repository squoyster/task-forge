import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execa } from "execa";

describe("scripts/taskforge launcher", () => {
  it("resolves the real checkout root when invoked through a symlink", async () => {
    const repoRoot = path.resolve(__dirname, "..");
    const realScript = path.join(repoRoot, "scripts", "taskforge");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-launcher-"));
    const linkPath = path.join(tmpDir, "taskforge");

    fs.symlinkSync(realScript, linkPath);

    try {
      const result = await execa(linkPath, ["--help"], {
        cwd: tmpDir,
        env: {
          ...process.env,
          TASKFORGE_RUNTIME: "source",
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Usage:");
      expect(result.stdout).toContain("taskforge");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
