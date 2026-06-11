import { describe, it, expect } from "vitest";
import {
  createTaskDocument,
  parseTaskDocument,
  renderTaskDocument,
  computeTaskSpecHash,
  importTaskDocument,
} from "../src/core/task-document.js";

describe("task-document", () => {
  it("parses canonical task sections", () => {
    const markdown = `# TASK-001: Example

## Goal
Ship the change.

## Acceptance Criteria
- [ ] Works

## Agent Notes
`;

    const document = parseTaskDocument(markdown);
    expect(document.title).toBe("Example");
    expect(document.sections.goal).toBe("Ship the change.");
    expect(document.sections.acceptanceCriteria).toContain("Works");
  });

  it("renders canonical task layout", () => {
    const document = createTaskDocument("Example", {
      goal: "Ship the change.",
      acceptanceCriteria: "- [ ] Works",
    });

    const rendered = renderTaskDocument("TASK-001", document);
    expect(rendered).toContain("# TASK-001: Example");
    expect(rendered).toContain("## Goal");
    expect(rendered).toContain("## Acceptance Criteria");
    expect(rendered).toContain("## Agent Notes");
  });

  it("computes stable hashes from editable content", () => {
    const document = createTaskDocument("Example", { goal: "Ship the change." });
    const hashA = computeTaskSpecHash(document, { type: "Task", priority: "P1" });
    const hashB = computeTaskSpecHash(document, { type: "Task", priority: "P1" });
    expect(hashA).toBe(hashB);
  });

  it("rejects readonly fields on strict import", () => {
    const markdown = `---
id: TASK-001
status: Done
priority: P1
---

# TASK-001: Example

## Goal
Ship the change.
`;

    expect(() => importTaskDocument(markdown, { strictReadonly: true })).toThrow(/read-only fields/);
  });

  it("tracks readonly fields on non-strict import", () => {
    const markdown = `---
id: TASK-001
status: Done
priority: P1
---

# TASK-001: Example

## Goal
Ship the change.
`;

    const imported = importTaskDocument(markdown, { strictReadonly: false });
    expect(imported.readonlyFields).toContain("status");
    expect(imported.fields.priority).toBe("P1");
    expect(imported.document.title).toBe("Example");
  });
});
