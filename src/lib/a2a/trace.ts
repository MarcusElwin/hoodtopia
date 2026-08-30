/**
 * In-memory trace bus for the demo UI.
 *
 * A2A gives you no cross-agent view for free: each agent sees its own tasks and
 * nothing else, which is correct for a protocol between mutually-distrusting
 * parties but useless for a demo whose whole point is showing the mesh. So the
 * mesh records every hop it makes — client to agent and agent to agent — into
 * this bus, and the `/agents` page renders it as one timeline.
 *
 * This is demo scaffolding, not part of the protocol. A real deployment would
 * use distributed tracing and correlate on `contextId`.
 */

export type TraceKind =
  | "request"
  | "response"
  | "status"
  | "artifact"
  | "error";

export interface TraceEvent {
  seq: number;
  ts: string;
  contextId: string;
  taskId?: string;
  kind: TraceKind;
  /** `shopper` for the buyer-side client, otherwise an AgentId. */
  from: string;
  to: string;
  /** A2A method name, e.g. `message/send`. */
  method?: string;
  skill?: string;
  /** Task state as a readable string, e.g. `input-required`. */
  state?: string;
  summary: string;
  /** Raw JSON-RPC envelope or event payload, for the "show the wire" toggle. */
  detail?: unknown;
  latencyMs?: number;
}

/** Per-context event cap; a runaway loop cannot exhaust memory. */
const MAX_EVENTS_PER_CONTEXT = 500;
/** Least-recently-touched contexts are evicted beyond this many. */
const MAX_CONTEXTS = 50;

type Listener = (event: TraceEvent) => void;

interface ContextLog {
  events: TraceEvent[];
  touchedAt: number;
}

class TraceBus {
  private readonly logs = new Map<string, ContextLog>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private seq = 0;

  record(event: Omit<TraceEvent, "seq" | "ts">): TraceEvent {
    const full: TraceEvent = {
      ...event,
      seq: ++this.seq,
      ts: new Date().toISOString(),
    };

    let log = this.logs.get(event.contextId);
    if (!log) {
      log = { events: [], touchedAt: Date.now() };
      this.logs.set(event.contextId, log);
      this.evictOldContexts();
    }
    log.touchedAt = Date.now();
    log.events.push(full);
    if (log.events.length > MAX_EVENTS_PER_CONTEXT) log.events.shift();

    for (const listener of this.listeners.get(event.contextId) ?? []) {
      try {
        listener(full);
      } catch {
        // A failing UI subscriber must not break the agent doing the work.
      }
    }
    return full;
  }

  history(contextId: string): TraceEvent[] {
    return [...(this.logs.get(contextId)?.events ?? [])];
  }

  subscribe(contextId: string, listener: Listener): () => void {
    let set = this.listeners.get(contextId);
    if (!set) {
      set = new Set();
      this.listeners.set(contextId, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(contextId);
    };
  }

  private evictOldContexts(): void {
    if (this.logs.size <= MAX_CONTEXTS) return;
    const ordered = [...this.logs.entries()].sort(
      (a, b) => a[1].touchedAt - b[1].touchedAt
    );
    for (const [id] of ordered.slice(0, this.logs.size - MAX_CONTEXTS)) {
      // Keep contexts a UI is actively watching, even if they are idle.
      if (!this.listeners.has(id)) this.logs.delete(id);
    }
  }
}

/**
 * Next.js re-evaluates modules across dev-server recompiles, so the bus is
 * pinned to `globalThis` to survive a hot reload mid-scenario.
 */
const globalForTrace = globalThis as typeof globalThis & {
  __hoodtopiaA2ATrace?: TraceBus;
};

export const traceBus: TraceBus =
  globalForTrace.__hoodtopiaA2ATrace ?? new TraceBus();

if (!globalForTrace.__hoodtopiaA2ATrace) {
  globalForTrace.__hoodtopiaA2ATrace = traceBus;
}
