import fs from "node:fs";
import { loadTaskById } from "../core/task-store.js";
import {
  applyTaskDocumentPatch,
  importTaskDocument,
  parseTaskDocument,
  renderTaskDocument,
  type EditableTaskFields,
  type TaskSectionKey,
} from "../core/task-document.js";
import { getRepoRoot } from "../util/paths.js";
import { withTaskStateTransaction } from "../core/task-state-transaction.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { writeResult } from "../util/write-command-result.js";
import { logInfo, logSuccess } from "../util/logging.js";

export interface UpdateOptions {
  fromFile?: string;
  title?: string;
  type?: string;
  priority?: string;
  agentRole?: string;
  riskLevel?: string;
  humanInterventionRequired?: boolean;
  dependsOn?: string[];
  goal?: string;
  background?: string;
  scope?: string;
  acceptanceCriteria?: string;
  testCommand?: string;
  expectedOutput?: string;
  dependencies?: string;
  risks?: string;
  continuationPolicy?: string;
  json?: boolean;
}

export async function cmdUpdate(taskId: string, options: UpdateOptions = {}): Promise<void> {
  const repoRoot = getRepoRoot();
  const existing = loadTaskById(taskId, repoRoot);
  if (!existing) {
    writeResult(failedResult({ command: "update", taskId, error: `Task ${taskId} not found`, code: "TASK_NOT_FOUND" }), options.json ?? false);
    return;
  }

  const patch = buildPatch(options);
  const diagnostics: string[] = [];

  if (options.fromFile) {
    try {
      const content = fs.readFileSync(options.fromFile, "utf-8");
      const imported = importTaskDocument(content, { strictReadonly: true });
      mergePatch(patch, imported.fields);
      if (imported.readonlyFields.length > 0) {
        diagnostics.push(`Ignored read-only fields from input: ${imported.readonlyFields.join(", ")}`);
      }
    } catch (error) {
      writeResult(failedResult({
        command: "update",
        taskId,
        error: error instanceof Error ? error.message : String(error),
        code: "INVALID_INPUT",
      }), options.json ?? false);
      return;
    }
  }

  if (isEmptyPatch(patch)) {
    writeResult(failedResult({
      command: "update",
      taskId,
      error: "No editable task fields were provided.",
      code: "NO_FIELDS",
    }), options.json ?? false);
    return;
  }

  await withTaskStateTransaction(
    { command: `update ${taskId}` },
    (tx) => {
      const task = tx.loadTask(taskId);
      if (!task) throw new Error(`Task ${taskId} not found during update`);

      if (patch.type) task.type = patch.type as typeof task.type;
      if (patch.priority) task.priority = patch.priority as typeof task.priority;
      if (patch.agentRole !== undefined) task.agentRole = patch.agentRole;
      if (patch.riskLevel) task.riskLevel = patch.riskLevel as typeof task.riskLevel;
      if (patch.humanInterventionRequired !== undefined) task.humanInterventionRequired = patch.humanInterventionRequired;
      if (patch.dependsOn !== undefined) task.dependsOn = patch.dependsOn;

      const currentDoc = parseTaskDocument(task.body);
      const nextDoc = applyTaskDocumentPatch(currentDoc, patch);
      task.body = renderTaskDocument(task.id, nextDoc);
      tx.updateTask(task);
      tx.appendNote(taskId, "System", [
        "Task updated via taskforge update",
        ...describePatch(patch),
      ]);
    },
  );

  const result = successResult({
    command: "update",
    taskId,
    guidance: `Task ${taskId} updated.`,
  });
  if (diagnostics.length > 0) {
    result.diagnostics = diagnostics.map((message) => ({ level: "info" as const, message }));
  }
  writeResult(result, options.json ?? false);
  if (!options.json) {
    logSuccess(`Task ${taskId} updated.`);
    for (const line of diagnostics) logInfo(line);
  }
}

function buildPatch(options: UpdateOptions): EditableTaskFields {
  const sections = buildSectionPatch(options);
  return {
    title: options.title,
    type: options.type,
    priority: options.priority,
    agentRole: options.agentRole,
    riskLevel: options.riskLevel,
    humanInterventionRequired: options.humanInterventionRequired,
    dependsOn: options.dependsOn,
    sections: Object.keys(sections).length > 0 ? sections : undefined,
  };
}

function buildSectionPatch(options: UpdateOptions): Partial<Record<TaskSectionKey, string>> {
  const sections: Partial<Record<TaskSectionKey, string>> = {};
  if (options.goal !== undefined) sections.goal = options.goal;
  if (options.background !== undefined) sections.background = options.background;
  if (options.scope !== undefined) sections.scope = options.scope;
  if (options.acceptanceCriteria !== undefined) sections.acceptanceCriteria = options.acceptanceCriteria;
  if (options.testCommand !== undefined) sections.testCommand = options.testCommand;
  if (options.expectedOutput !== undefined) sections.expectedOutput = options.expectedOutput;
  if (options.dependencies !== undefined) sections.dependencies = options.dependencies;
  if (options.risks !== undefined) sections.risks = options.risks;
  if (options.continuationPolicy !== undefined) sections.continuationPolicy = options.continuationPolicy;
  return sections;
}

function mergePatch(target: EditableTaskFields, source: EditableTaskFields): void {
  for (const [key, value] of Object.entries(source) as Array<[keyof EditableTaskFields, EditableTaskFields[keyof EditableTaskFields]]>) {
    if (value === undefined) continue;
    if (key === "sections") {
      target.sections = { ...(target.sections ?? {}), ...(value as EditableTaskFields["sections"]) };
    } else {
      target[key] = value as never;
    }
  }
}

function isEmptyPatch(patch: EditableTaskFields): boolean {
  return Object.entries(patch).every(([key, value]) => {
    if (key === "sections") return !value || Object.keys(value as object).length === 0;
    return value === undefined;
  });
}

function describePatch(patch: EditableTaskFields): string[] {
  const notes: string[] = [];
  if (patch.title) notes.push(`title set to "${patch.title}"`);
  if (patch.type) notes.push(`type set to "${patch.type}"`);
  if (patch.priority) notes.push(`priority set to "${patch.priority}"`);
  if (patch.agentRole) notes.push(`agentRole set to "${patch.agentRole}"`);
  if (patch.riskLevel) notes.push(`riskLevel set to "${patch.riskLevel}"`);
  if (patch.humanInterventionRequired !== undefined) notes.push(`humanInterventionRequired set to "${patch.humanInterventionRequired}"`);
  if (patch.dependsOn) notes.push(`dependsOn set to [${patch.dependsOn.join(", ")}]`);
  for (const [section, value] of Object.entries(patch.sections ?? {})) {
    notes.push(`section ${section} updated (${value.length} chars)`);
  }
  return notes;
}
