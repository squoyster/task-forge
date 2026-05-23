import fs from "node:fs";
import path from "node:path";

export interface RenderContext {
  [key: string]: string | number | boolean | undefined | null;
}

export function renderTemplate(template: string, context: RenderContext): string {
  let result = template;
  for (const [key, value] of Object.entries(context)) {
    const placeholder = `{{${key}}}`;
    const replacement = value === undefined || value === null ? "" : String(value);
    result = result.replaceAll(placeholder, replacement);
  }
  return result;
}

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

export function managedBlockMarker(name: string): { begin: string; end: string } {
  return {
    begin: `<!-- TASKFORGE:BEGIN ${name} -->`,
    end: `<!-- TASKFORGE:END ${name} -->`,
  };
}

export function wrapManagedBlock(blockName: string, content: string): string {
  const { begin, end } = managedBlockMarker(blockName);
  return `\n${begin}\n${content}\n${end}\n`;
}

export function replaceManagedBlock(
  existing: string,
  blockName: string,
  newContent: string,
): string {
  const { begin, end } = managedBlockMarker(blockName);
  const blockRegex = new RegExp(
    `${escapeRegex(begin)}[\\s\\S]*?${escapeRegex(end)}`,
    "m",
  );
  const replacement = `${begin}\n${newContent}\n${end}`;

  if (blockRegex.test(existing)) {
    return existing.replace(blockRegex, replacement);
  }

  return existing.trimEnd() + `\n\n${begin}\n${newContent}\n${end}\n`;
}

export function hasManagedBlock(existing: string, blockName: string): boolean {
  const { begin } = managedBlockMarker(blockName);
  return existing.includes(begin);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function makeExecutable(filePath: string): Promise<void> {
  const resolved = path.resolve(filePath);
  await fs.promises.chmod(resolved, 0o755);
}

export function isExecutable(filePath: string): boolean {
  try {
    const stats = fs.statSync(filePath);
    return (stats.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

export function readTemplateFile(templatePath: string): string {
  const raw = fs.readFileSync(templatePath, "utf-8");
  return normalizeLineEndings(raw);
}

export function writeGeneratedFile(
  filePath: string,
  content: string,
): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, normalizeLineEndings(content), "utf-8");
}
