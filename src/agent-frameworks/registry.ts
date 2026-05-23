import type { AgentFrameworkAdapter } from "./types.js";
import { genericAdapter } from "./generic.js";
import { opencodeAdapter } from "./opencode.js";

const builtinAdapters: AgentFrameworkAdapter[] = [genericAdapter, opencodeAdapter];
const customAdapters: AgentFrameworkAdapter[] = [];

export function registerAdapter(adapter: AgentFrameworkAdapter): void {
  const existing = getAdapter(adapter.id);
  if (existing) {
    throw new Error(`Adapter already registered: ${adapter.id}`);
  }
  customAdapters.push(adapter);
}

export function getAdapter(id: string): AgentFrameworkAdapter | undefined {
  return [...builtinAdapters, ...customAdapters].find((a) => a.id === id);
}

export function getAdapters(): AgentFrameworkAdapter[] {
  return [...builtinAdapters, ...customAdapters];
}
