import { execa } from "execa";

export interface DeprecatedResult {
  packages: DeprecatedPackage[];
  raw: string;
}

export interface DeprecatedPackage {
  package: string;
  version: string;
  deprecationMessage: string;
  direct: boolean;
}

export async function checkDeprecated(
  repoRoot: string,
): Promise<DeprecatedResult> {
  const packages: DeprecatedPackage[] = [];

  try {
    // Check install output for deprecation warnings
    const result = await execa("npm", ["install", "--dry-run", "--json"], {
      cwd: repoRoot,
      reject: false,
      timeout: 30000,
    });

    const raw = result.stdout + result.stderr;

    // Parse deprecation warnings from npm output
    const depRegex = /npm warn deprecated\s+(\S+)(?:@(\S+))?:\s+(.+)/gi;
    let match;
    while ((match = depRegex.exec(raw)) !== null) {
      packages.push({
        package: match[1],
        version: match[2] ?? "unknown",
        deprecationMessage: match[3],
        direct: false, // assume transitive unless proven otherwise
      });
    }

    return { packages, raw };
  } catch {
    return { packages: [], raw: "Deprecated check failed or not available." };
  }
}

export async function checkPackageDeprecated(
  packageName: string,
): Promise<{ deprecated: boolean; message?: string }> {
  try {
    const result = await execa("npm", ["view", packageName, "deprecated", "--json"], {
      reject: false,
    });

    const output = result.stdout.trim();
    if (output && output !== "null" && output !== '""') {
      return { deprecated: true, message: output.replace(/^"|"$/g, "") };
    }
    return { deprecated: false };
  } catch {
    return { deprecated: false };
  }
}
