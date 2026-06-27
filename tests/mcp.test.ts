import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { setRepoRoot } from "../src/util/paths.js";
import { emitResult } from "../src/core/command-result.js";
import { successResult, failedResult, doctorRequiredResult } from "../src/core/result-builder.js";

// Mock each command module: tests drive behaviour by setting the mock to emit
// a controlled result via the real emitResult (captured by runCommandForResult).
vi.mock("../src/commands/next.js", () => ({ cmdNext: vi.fn() }));
vi.mock("../src/commands/claim.js", () => ({ cmdClaim: vi.fn() }));
vi.mock("../src/commands/block.js", () => ({ cmdBlock: vi.fn() }));
vi.mock("../src/commands/done.js", () => ({ cmdDone: vi.fn() }));
vi.mock("../src/commands/gates.js", () => ({ cmdGates: vi.fn() }));
vi.mock("../src/commands/validate-state.js", () => ({ cmdValidateState: vi.fn() }));

const { createTaskForgeServer } = await import("../src/commands/mcp.js");
const { cmdNext } = await import("../src/commands/next.js");
const { cmdClaim } = await import("../src/commands/claim.js");
const { cmdGates } = await import("../src/commands/gates.js");

let uniqueDir: string;
let repoDir: string;
let stateDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-mcp-proto-"));
  repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

function writeTask(id: string, status = "Ready"): void {
  fs.writeFileSync(
    path.join(stateDir, `${id}.md`),
    [
      "---",
      `id: ${id}`,
      "type: Task",
      `status: "${status}"`,
      "priority: P2",
      "---",
      "",
      `# ${id}: A task`,
      "",
      "## Goal",
      "Body content for resource.",
      "",
    ].join("\n"),
    "utf-8",
  );
}

async function connect(): Promise<Client> {
  const server = createTaskForgeServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
}

async function callTool(client: Client, name: string, args: Record<string, unknown> = {}) {
  const res = await client.callTool({ name, arguments: args });
  return res;
}

const SEVEN_TOOLS = [
  "taskforge_next",
  "taskforge_get_task",
  "taskforge_claim",
  "taskforge_block",
  "taskforge_complete",
  "taskforge_gates",
  "taskforge_validate_state",
];

describe("MCP server — tool & resource surface", () => {
  it("exposes exactly the 7 contract tools and no proxy/shell/git tools", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([...SEVEN_TOOLS].sort());

    // R-E02-003: no repo-mutation / shell / transition proxies.
    const forbidden = names.filter((n) =>
      /shell|git|push|commit|worktree|branch|pr_|force|unlock|transition|start|resume|cleanup/.test(n),
    );
    expect(forbidden).toEqual([]);
  });

  it("every tool declares an outputSchema (typed structuredContent)", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    for (const t of tools) {
      expect(t.outputSchema, `${t.name} must declare outputSchema`).toBeDefined();
    }
  });

  it("exposes the workflow resource and the task template", async () => {
    const client = await connect();
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toContain("taskforge://workflow");

    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates.map((r) => r.uriTemplate)).toContain("taskforge://task/{taskId}");
  });

  it("instructions lead with task/state scope + safety invariants (AC-5)", async () => {
    const client = await connect();
    const info = client.getInstructions() ?? "";
    const head = info.slice(0, 512);
    expect(head).toMatch(/task/i);
    expect(head).toMatch(/state/i);
    // Safety invariants surface early.
    expect(head.toLowerCase()).toMatch(/never|safety|invariant|doctor/i);
  });
});

describe("MCP server — get_task (real load, no command mock)", () => {
  it("success: returns typed task metadata for an existing task", async () => {
    writeTask("TASK-324");
    const client = await connect();
    const res = await callTool(client, "taskforge_get_task", { taskId: "TASK-324" });
    const sc = res.structuredContent as Record<string, unknown>;
    expect(sc.ok).toBe(true);
    expect((sc.data as { task: { id: string } }).task.id).toBe("TASK-324");
  });

  it("task-not-found: returns TASK_NOT_FOUND typed failed result", async () => {
    const client = await connect();
    const res = await callTool(client, "taskforge_get_task", { taskId: "TASK-999" });
    const sc = res.structuredContent as Record<string, unknown>;
    expect(sc.ok).toBe(false);
    expect(sc.code).toBe("TASK_NOT_FOUND");
  });

  it("invalid input: rejects path-traversal taskId with INVALID_TASK_ID", async () => {
    const client = await connect();
    const res = await callTool(client, "taskforge_get_task", { taskId: "../../etc/passwd" });
    const sc = res.structuredContent as Record<string, unknown>;
    expect(sc.ok).toBe(false);
    expect(sc.code).toBe("INVALID_TASK_ID");
  });
});

describe("MCP server — mutation/verify tools surface CLI invariants as typed results", () => {
  it("next success: surfaces the CLI success result as structuredContent", async () => {
    vi.mocked(cmdNext).mockImplementation(async () => {
      emitResult(successResult({ command: "next", taskId: "TASK-1" }), true);
    });
    const client = await connect();
    const res = await callTool(client, "taskforge_next");
    const sc = res.structuredContent as Record<string, unknown>;
    expect(sc.ok).toBe(true);
    expect(sc.status).toBe("success");
  });

  it("doctor lock: surfaces doctor_required typed result", async () => {
    vi.mocked(cmdNext).mockImplementation(async () => {
      emitResult(doctorRequiredResult({ command: "next", reason: "system in recovery" }), true);
    });
    const client = await connect();
    const res = await callTool(client, "taskforge_next");
    const sc = res.structuredContent as Record<string, unknown>;
    expect(sc.ok).toBe(false);
    expect(sc.status).toBe("doctor_required");
  });

  it("ownership conflict: surfaces NEEDS_FORCE typed result from the claim core", async () => {
    vi.mocked(cmdClaim).mockImplementation(async () => {
      emitResult(
        failedResult({ command: "claim", taskId: "TASK-1", error: "owned by another session", code: "NEEDS_FORCE" }),
        true,
      );
    });
    const client = await connect();
    const res = await callTool(client, "taskforge_claim", { taskId: "TASK-1" });
    const sc = res.structuredContent as Record<string, unknown>;
    expect(sc.ok).toBe(false);
    expect(sc.code).toBe("NEEDS_FORCE");
  });

  it("gate failure: surfaces a failed typed result from the gates core", async () => {
    vi.mocked(cmdGates).mockImplementation(async () => {
      emitResult(failedResult({ command: "gates", error: "typecheck failed", code: "GATE_FAILED" }), true);
    });
    const client = await connect();
    const res = await callTool(client, "taskforge_gates");
    const sc = res.structuredContent as Record<string, unknown>;
    expect(sc.ok).toBe(false);
    expect(sc.code).toBe("GATE_FAILED");
  });
});

describe("MCP server — resources", () => {
  it("workflow resource returns read-only compact markdown", async () => {
    const client = await connect();
    const res = await client.readResource({ uri: "taskforge://workflow" });
    expect(res.contents[0].mimeType).toBe("text/markdown");
    expect(res.contents[0].text).toMatch(/Workflow/i);
  });

  it("task resource returns the task body, never a filesystem path", async () => {
    writeTask("TASK-324");
    const client = await connect();
    const res = await client.readResource({ uri: "taskforge://task/TASK-324" });
    const text = res.contents[0].text;
    expect(text).toContain("# TASK-324: A task");
    expect(text).not.toContain(repoDir);
    expect(text).not.toContain("task-state");
  });

  it("task resource guards against traversal in the URI variable", async () => {
    const client = await connect();
    const res = await client.readResource({ uri: "taskforge://task/..%2Fetc%2Fpasswd" });
    expect(res.contents[0].text).toMatch(/invalid/i);
  });
});
