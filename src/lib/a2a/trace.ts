import { randomUUID } from "node:crypto";

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
  /**
   * Globally unique across instances: an instance-scoped prefix plus a local
   * sequence. Serverless runs the mesh on more than one process, so events
   * forwarded from a peer arrive with their own numbering — deduplicating on a
   * bare counter would silently drop a real hop whose number happened to
   * collide with one already on the timeline.
   */
  id: string;
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
  /** Distinguishes this process's events from a peer instance's. */
  private readonly instance = randomUUID().slice(0, 8);

  record(event: Omit<TraceEvent, "id" | "seq" | "ts">): TraceEvent {
    const seq = ++this.seq;
    return this.append({
      ...event,
      seq,
      id: `${this.instance}-${seq}`,
      ts: new Date().toISOString(),
    });
  }

  /**
   * Adopts events another instance recorded, keeping their identity and
   * timestamps. When the checkout agent calls the shipping agent, that hop is
   * traced by whichever process ran the checkout agent — which on a serverless
   * platform is not the process the browser is streaming from. The callee
   * hands its slice back with the response and it is merged here, so the
   * timeline shows the whole mesh however the platform spread it out.
   *
   * Returns the events that were new; already-seen ones are dropped, which is
   * what makes this safe when everything happens to run in one process.
   */
  merge(events: TraceEvent[]): TraceEvent[] {
    const added: TraceEvent[] = [];
    for (const event of events) {
      const known = this.logs.get(event.contextId)?.events;
      if (known?.some((e) => e.id === event.id)) continue;
      added.push(this.append(event));
    }
    return added;
  }

  private append(event: TraceEvent): TraceEvent {
    let log = this.logs.get(event.contextId);
    if (!log) {
      log = { events: [], touchedAt: Date.now() };
      this.logs.set(event.contextId, log);
      this.evictOldContexts();
    }
    log.touchedAt = Date.now();
    log.events.push(event);
    // Merged peer events carry the timestamp of when they really happened, so
    // the log is sorted rather than assumed to be append-ordered.
    log.events.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
    if (log.events.length > MAX_EVENTS_PER_CONTEXT) log.events.shift();

    for (const listener of this.listeners.get(event.contextId) ?? []) {
      try {
        listener(event);
      } catch {
        // A failing UI subscriber must not break the agent doing the work.
      }
    }
    return event;
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
