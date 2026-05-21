import { execa } from "execa";

export async function run(
  cmd: string,
  args: string[] = [],
  cwd?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const result = await execa(cmd, args, { cwd, reject: false });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode ?? 1,
  };
}

export async function runOrThrow(
  cmd: string,
  args: string[] = [],
  cwd?: string,
): Promise<{ stdout: string; stderr: string }> {
  const result = await execa(cmd, args, { cwd });
  return { stdout: result.stdout, stderr: result.stderr };
}
