// src/core/templates.ts
import fs from "fs";
import path from "path";
function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, "\n");
}
function managedBlockMarker(name) {
  return {
    begin: `<!-- TASKFORGE:BEGIN ${name} -->`,
    end: `<!-- TASKFORGE:END ${name} -->`
  };
}
function replaceManagedBlock(existing, blockName, newContent) {
  const { begin, end } = managedBlockMarker(blockName);
  const blockRegex = new RegExp(
    `${escapeRegex(begin)}[\\s\\S]*?${escapeRegex(end)}`,
    "m"
  );
  const replacement = `${begin}
${newContent}
${end}`;
  if (blockRegex.test(existing)) {
    return existing.replace(blockRegex, replacement);
  }
  return existing.trimEnd() + `

${begin}
${newContent}
${end}
`;
}
function hasManagedBlock(existing, blockName) {
  const { begin } = managedBlockMarker(blockName);
  return existing.includes(begin);
}
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function isExecutable(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return (stats.mode & 73) !== 0;
  } catch {
    return false;
  }
}
function writeGeneratedFile(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, normalizeLineEndings(content), "utf-8");
}

export {
  replaceManagedBlock,
  hasManagedBlock,
  isExecutable,
  writeGeneratedFile
};
//# sourceMappingURL=chunk-5JWCMI7A.js.map