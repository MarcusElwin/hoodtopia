import type { AgentCard } from "@a2a-js/sdk";
import {
  DefaultPushNotificationSender,
  DefaultRequestHandler,
  InMemoryPushNotificationStore,
  InMemoryTaskStore,
  JsonRpcTransportHandler,
  type AgentExecutor,
} from "@a2a-js/sdk/server";
import type { AgentId } from "./registry";

/**
 * Per-agent A2A server runtime.
 *
 * The SDK ships an Express integration; this app is Next.js, so instead of the
 * Express app we hold the transport-agnostic pieces — a `DefaultRequestHandler`
 * wrapping the executor, and a `JsonRpcTransportHandler` in front of it — and
 * drive them from a route handler (see `./http.ts`). Nothing about this is
 * Next-specific beyond the adapter: the handler takes a parsed JSON-RPC body
 * and returns either a response object or an async generator of them.
 */

export interface AgentDefinition {
  id: AgentId;
  card: AgentCard;
  executor: AgentExecutor;
  /** Long-running agents accept webhook registration for task updates. */
  pushNotifications?: boolean;
}

export interface AgentRuntime {
  id: AgentId;
  card: AgentCard;
  requestHandler: DefaultRequestHandler;
  jsonRpc: JsonRpcTransportHandler;
}

interface AgentStores {
  tasks: InMemoryTaskStore;
  push?: InMemoryPushNotificationStore;
}

/**
 * Task state is in memory, so it has to survive Next re-evaluating modules on
 * hot reload — otherwise a task parked in `input-required` vanishes the moment
 * you edit a file mid-demo. Only the *stores* are pinned, though. Caching the
 * whole runtime here would also pin the executor, and an edited agent would go
 * on serving its previous implementation until a full restart.
 */
const globalForStores = globalThis as typeof globalThis & {
  __hoodtopiaA2AStores?: Map<AgentId, AgentStores>;
};

const stores: Map<AgentId, AgentStores> =
  globalForStores.__hoodtopiaA2AStores ?? new Map();

if (!globalForStores.__hoodtopiaA2AStores) {
  globalForStores.__hoodtopiaA2AStores = stores;
}

function storesFor(def: AgentDefinition): AgentStores {
  const existing = stores.get(def.id);
  if (existing) return existing;
  const created: AgentStores = {
    tasks: new InMemoryTaskStore(),
    push: def.pushNotifications ? new InMemoryPushNotificationStore() : undefined,
  };
  stores.set(def.id, created);
  return created;
}

/** Module-scoped, so it is rebuilt whenever this module is re-evaluated. */
const runtimes = new Map<AgentId, AgentRuntime>();

export function getOrCreateRuntime(def: AgentDefinition): AgentRuntime {
  const existing = runtimes.get(def.id);
  if (existing) return existing;

  const { tasks, push } = storesFor(def);
  const pushSender = push ? new DefaultPushNotificationSender(push) : undefined;

  const requestHandler = new DefaultRequestHandler(
    def.card,
    tasks,
    def.executor,
    undefined,
    push,
    pushSender
  );

  const runtime: AgentRuntime = {
    id: def.id,
    card: def.card,
    requestHandler,
    jsonRpc: new JsonRpcTransportHandler(requestHandler),
  };
  runtimes.set(def.id, runtime);
  return runtime;
}
