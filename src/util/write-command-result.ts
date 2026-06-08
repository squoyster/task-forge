/**
 * write-command-result — Output a TaskForgeCommandResult to stdout.
 *
 * Every CLI command must return a structured TaskForgeCommandResult.
 * This helper writes it in the appropriate format (markdown or JSON)
 * and replaces ad-hoc printJson / console.log / logSuccess patterns.
 */
import type { TaskForgeCommandResult } from "../core/command-result.js";
import { renderResultMarkdown, renderResultJson } from "../core/result-renderer.js";

/**
 * Write a TaskForgeCommandResult to stdout in the requested format.
 *
 * @param result  The structured result to output.
 * @param json    When true, render as JSON; otherwise render as Markdown.
 */
export function writeResult(result: TaskForgeCommandResult, json: boolean): void {
  const output = json ? renderResultJson(result) : renderResultMarkdown(result);
  console.log(output);
}
