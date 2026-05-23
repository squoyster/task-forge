import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  normalizeLineEndings,
  wrapManagedBlock,
  replaceManagedBlock,
  hasManagedBlock,
  managedBlockMarker,
  makeExecutable,
  isExecutable,
  writeGeneratedFile,
  readTemplateFile,
} from "../src/core/templates.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("renderTemplate", () => {
  it("replaces placeholders with context values", () => {
    const tpl = "Hello {{name}}, you are {{role}}.";
    const result = renderTemplate(tpl, { name: "Alice", role: "implementer" });
    expect(result).toBe("Hello Alice, you are implementer.");
  });

  it("handles undefined values as empty string", () => {
    const tpl = "{{prefix}}{{value}}";
    const result = renderTemplate(tpl, { prefix: undefined, value: "test" });
    expect(result).toBe("test");
  });

  it("handles number and boolean values", () => {
    const tpl = "{{enabled}} {{count}}";
    const result = renderTemplate(tpl, { enabled: true, count: 42 });
    expect(result).toBe("true 42");
  });

  it("handles empty context", () => {
    const tpl = "No placeholders here.";
    expect(renderTemplate(tpl, {})).toBe("No placeholders here.");
  });
});

describe("normalizeLineEndings", () => {
  it("converts CRLF to LF", () => {
    const input = "line1\r\nline2\r\nline3";
    expect(normalizeLineEndings(input)).toBe("line1\nline2\nline3");
  });

  it("leaves LF unchanged", () => {
    const input = "line1\nline2";
    expect(normalizeLineEndings(input)).toBe("line1\nline2");
  });
});

describe("managedBlockMarker", () => {
  it("generates begin and end markers", () => {
    const markers = managedBlockMarker("test-block");
    expect(markers.begin).toBe("<!-- TASKFORGE:BEGIN test-block -->");
    expect(markers.end).toBe("<!-- TASKFORGE:END test-block -->");
  });
});

describe("wrapManagedBlock", () => {
  it("wraps content in managed block markers", () => {
    const result = wrapManagedBlock("policy", "Managed content here.");
    expect(result).toContain("<!-- TASKFORGE:BEGIN policy -->");
    expect(result).toContain("Managed content here.");
    expect(result).toContain("<!-- TASKFORGE:END policy -->");
  });
});

describe("replaceManagedBlock", () => {
  const blockName = "agent-policy";

  it("replaces existing managed block", () => {
    const existing = [
      "# Title",
      "",
      "<!-- TASKFORGE:BEGIN agent-policy -->",
      "old content",
      "<!-- TASKFORGE:END agent-policy -->",
      "",
      "More content.",
    ].join("\n");
    const result = replaceManagedBlock(existing, blockName, "new content");
    expect(result).toContain("<!-- TASKFORGE:BEGIN agent-policy -->");
    expect(result).toContain("new content");
    expect(result).toContain("<!-- TASKFORGE:END agent-policy -->");
    expect(result).not.toContain("old content");
    expect(result).toContain("# Title");
    expect(result).toContain("More content.");
  });

  it("inserts managed block when not present", () => {
    const existing = "# Title\n\nSome user content.\n";
    const result = replaceManagedBlock(existing, blockName, "managed\n");
    expect(result).toContain("<!-- TASKFORGE:BEGIN agent-policy -->");
    expect(result).toContain("managed");
    expect(result).toContain("<!-- TASKFORGE:END agent-policy -->");
    expect(result).toContain("Some user content.");
  });

  it("is idempotent — running twice produces same result", () => {
    const original = "# Title\n\nUser content.\n";
    const first = replaceManagedBlock(original, blockName, "policy v1");
    const second = replaceManagedBlock(first, blockName, "policy v1");
    expect(second).toBe(first);
  });

  it("does not duplicate when block already exists", () => {
    const existing = [
      "<!-- TASKFORGE:BEGIN agent-policy -->",
      "existing",
      "<!-- TASKFORGE:END agent-policy -->",
    ].join("\n");
    const result = replaceManagedBlock(existing, blockName, "updated");
    const markers = result.split("<!-- TASKFORGE:BEGIN agent-policy -->");
    expect(markers).toHaveLength(2);
  });
});

describe("hasManagedBlock", () => {
  it("returns true when block exists", () => {
    const content = "<!-- TASKFORGE:BEGIN test -->\nstuff\n<!-- TASKFORGE:END test -->";
    expect(hasManagedBlock(content, "test")).toBe(true);
  });

  it("returns false when block missing", () => {
    expect(hasManagedBlock("No blocks here.", "test")).toBe(false);
  });
});

describe("makeExecutable / isExecutable", () => {
  it("makes a file executable and detects it", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-exec-"));
    const filePath = path.join(tmpDir, "hook.sh");
    fs.writeFileSync(filePath, "#!/bin/bash\necho hi", "utf-8");
    expect(isExecutable(filePath)).toBe(false);

    await makeExecutable(filePath);
    expect(isExecutable(filePath)).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns false for non-existent file", () => {
    expect(isExecutable("/nonexistent/path")).toBe(false);
  });
});

describe("writeGeneratedFile", () => {
  it("creates file with normalized line endings and parent directories", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-gen-"));
    const filePath = path.join(tmpDir, "deep/nested/file.md");
    writeGeneratedFile(filePath, "Hello\r\nWorld");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toBe("Hello\nWorld");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("readTemplateFile", () => {
  it("reads and normalizes a template file", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-read-"));
    const tplPath = path.join(tmpDir, "tpl.md");
    fs.writeFileSync(tplPath, "Hello\r\n{{name}}", "utf-8");

    const content = readTemplateFile(tplPath);
    expect(content).toBe("Hello\n{{name}}");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
