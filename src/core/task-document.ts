import crypto from "node:crypto";
import matter from "gray-matter";

export type TaskSectionKey =
  | "goal"
  | "background"
  | "scope"
  | "acceptanceCriteria"
  | "testCommand"
  | "expectedOutput"
  | "dependencies"
  | "risks"
  | "continuationPolicy"
  | "agentNotes"
  | "result"
  | "links";

export interface TaskDocument {
  title: string;
  sections: Partial<Record<TaskSectionKey, string>>;
  extras: Array<{ heading: string; content: string }>;
}

export interface EditableTaskFields {
  title?: string;
  type?: string;
  priority?: string;
  agentRole?: string;
  riskLevel?: string;
  humanInterventionRequired?: boolean;
  dependsOn?: string[];
  sections?: Partial<Record<TaskSectionKey, string>>;
}

export interface ImportedTaskDocument {
  document: TaskDocument;
  fields: EditableTaskFields;
  readonlyFields: string[];
}

const SECTION_ORDER: Array<{ key: TaskSectionKey; heading: string; defaultContent: string }> = [
  { key: "goal", heading: "Goal", defaultContent: "Describe the desired outcome." },
  { key: "background", heading: "Background", defaultContent: "Relevant context, constraints, prior decisions, and links." },
  { key: "scope", heading: "Scope", defaultContent: "Allowed files/directories:\n-\n\nDisallowed files/directories:\n-" },
  { key: "acceptanceCriteria", heading: "Acceptance Criteria", defaultContent: "- [ ]" },
  { key: "testCommand", heading: "Test / Verification Command", defaultContent: "```bash\n# command here\n```" },
  { key: "expectedOutput", heading: "Expected Output / Behavior", defaultContent: "Describe expected result." },
  { key: "dependencies", heading: "Dependencies", defaultContent: "None" },
  { key: "risks", heading: "Risks", defaultContent: "Known risks." },
  { key: "continuationPolicy", heading: "Continuation Policy", defaultContent: "Auto-continue unless a stopping condition occurs." },
  { key: "agentNotes", heading: "Agent Notes", defaultContent: "" },
  { key: "result", heading: "Result", defaultContent: "" },
  { key: "links", heading: "Links", defaultContent: "- Issue:\n- Project Item:\n- PR:\n- Branch:\n- Worktree:\n- CI:\n- Test Log:" },
];

const SECTION_ALIAS_TO_KEY = new Map<string, TaskSectionKey>([
  ...SECTION_ORDER.map((section): [string, TaskSectionKey] => [section.heading.toLowerCase(), section.key]),
  ["expected output", "expectedOutput"],
  ["expected behavior", "expectedOutput"],
  ["expected output / behavior", "expectedOutput"],
  ["test / verification command", "testCommand"],
  ["acceptance criteria", "acceptanceCriteria"],
]);

const EDITABLE_FRONTMATTER_FIELDS = new Set([
  "type",
  "priority",
  "agentRole",
  "agent_role",
  "riskLevel",
  "risk_level",
  "humanInterventionRequired",
  "human_intervention_required",
  "dependsOn",
]);

const READONLY_FRONTMATTER_FIELDS = new Set([
  "id",
  "status",
  "assignee",
  "claimed_at",
  "branch",
  "worktree",
  "context_hash",
  "spec_hash",
  "blocked_reason",
  "blocked_by",
  "blocked_since",
  "block_category",
  "override_reason",
  "override_actor",
  "override_timestamp",
  "override_failed_gates",
  "issue",
  "pr",
  "submitted_sha",
  "submitted_at",
  "pr_merged",
  "pr_head_sha",
  "pr_base_branch",
  "code_task",
]);

export function createTaskDocument(title: string, sections: Partial<Record<TaskSectionKey, string>> = {}): TaskDocument {
  return {
    title: title.trim(),
    sections,
    extras: [],
  };
}

export function parseTaskDocument(markdown: string): TaskDocument {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  const lines = normalized.split("\n");
  let title = "Untitled Task";
  let startIndex = 0;

  if (lines[0]?.startsWith("# ")) {
    title = lines[0].replace(/^#\s+/, "").replace(/^[A-Z]+-\d+:\s*/, "").trim();
    startIndex = 1;
  }

  const body = lines.slice(startIndex).join("\n").trim();
  if (!body) {
    return createTaskDocument(title);
  }

  const matches = [...body.matchAll(/^##\s+(.+)$/gm)];
  if (matches.length === 0) {
    return createTaskDocument(title);
  }

  const sections: Partial<Record<TaskSectionKey, string>> = {};
  const extras: Array<{ heading: string; content: string }> = [];

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const heading = current[1].trim();
    const contentStart = (current.index ?? 0) + current[0].length;
    const contentEnd = next?.index ?? body.length;
    const content = body.slice(contentStart, contentEnd).trim();
    const key = SECTION_ALIAS_TO_KEY.get(heading.toLowerCase());

    if (key) sections[key] = content;
    else extras.push({ heading, content });
  }

  return { title, sections, extras };
}

export function renderTaskDocument(id: string, document: TaskDocument): string {
  const parts: string[] = [`# ${id}: ${document.title.trim()}`];

  for (const section of SECTION_ORDER) {
    const content = (document.sections[section.key] ?? section.defaultContent).trim();
    parts.push(`## ${section.heading}`);
    if (content) parts.push(content);
    parts.push("");
  }

  for (const extra of document.extras) {
    parts.push(`## ${extra.heading}`);
    if (extra.content.trim()) parts.push(extra.content.trim());
    parts.push("");
  }

  return `${parts.join("\n").trim()}\n`;
}

export function computeTaskSpecHash(document: TaskDocument, fields: EditableTaskFields = {}): string {
  const payload = {
    title: document.title.trim(),
    type: fields.type ?? "",
    priority: fields.priority ?? "",
    agentRole: fields.agentRole ?? "",
    riskLevel: fields.riskLevel ?? "",
    humanInterventionRequired: fields.humanInterventionRequired ?? false,
    dependsOn: fields.dependsOn ?? [],
    sections: {
      goal: normalizeHashText(document.sections.goal),
      background: normalizeHashText(document.sections.background),
      scope: normalizeHashText(document.sections.scope),
      acceptanceCriteria: normalizeHashText(document.sections.acceptanceCriteria),
      testCommand: normalizeHashText(document.sections.testCommand),
      expectedOutput: normalizeHashText(document.sections.expectedOutput),
      dependencies: normalizeHashText(document.sections.dependencies),
      risks: normalizeHashText(document.sections.risks),
      continuationPolicy: normalizeHashText(document.sections.continuationPolicy),
    },
  };

  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex").substring(0, 16);
}

export function importTaskDocument(
  markdown: string,
  options: { strictReadonly?: boolean } = {},
): ImportedTaskDocument {
  const parsed = matter(markdown, { date: false } as Record<string, unknown>);
  const frontmatter = parsed.data as Record<string, unknown>;
  const readonlyFields = Object.keys(frontmatter).filter((key) => READONLY_FRONTMATTER_FIELDS.has(key));

  if (options.strictReadonly && readonlyFields.length > 0) {
    throw new Error(`Input attempted to modify read-only fields: ${readonlyFields.join(", ")}`);
  }

  const fields: EditableTaskFields = {};
  if (typeof frontmatter.type === "string") fields.type = frontmatter.type;
  if (typeof frontmatter.priority === "string") fields.priority = frontmatter.priority;
  if (typeof (frontmatter.agentRole ?? frontmatter.agent_role) === "string") {
    fields.agentRole = String(frontmatter.agentRole ?? frontmatter.agent_role);
  }
  if (typeof (frontmatter.riskLevel ?? frontmatter.risk_level) === "string") {
    fields.riskLevel = String(frontmatter.riskLevel ?? frontmatter.risk_level);
  }
  if (typeof (frontmatter.humanInterventionRequired ?? frontmatter.human_intervention_required) === "boolean") {
    fields.humanInterventionRequired = Boolean(frontmatter.humanInterventionRequired ?? frontmatter.human_intervention_required);
  }
  if (Array.isArray(frontmatter.dependsOn)) {
    fields.dependsOn = frontmatter.dependsOn.map(String);
  }

  const unknownWritableFields = Object.keys(frontmatter).filter(
    (key) => !READONLY_FRONTMATTER_FIELDS.has(key) && !EDITABLE_FRONTMATTER_FIELDS.has(key) && key !== "id",
  );
  if (options.strictReadonly && unknownWritableFields.length > 0) {
    throw new Error(`Input included unsupported task fields: ${unknownWritableFields.join(", ")}`);
  }

  const document = parseTaskDocument(parsed.content);
  fields.title = document.title;
  fields.sections = document.sections;

  return { document, fields, readonlyFields };
}

export function applyTaskDocumentPatch(
  document: TaskDocument,
  patch: EditableTaskFields,
): TaskDocument {
  return {
    title: patch.title?.trim() || document.title,
    sections: {
      ...document.sections,
      ...(patch.sections ?? {}),
    },
    extras: document.extras,
  };
}

function normalizeHashText(text: string | undefined): string {
  return (text ?? "").replace(/\r\n/g, "\n").trim();
}
