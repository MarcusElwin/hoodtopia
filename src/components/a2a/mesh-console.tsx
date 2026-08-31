"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Loader2, Play, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SCENARIO_COMPLETE } from "@/lib/a2a/markers";
import { accentFor, STATE_STYLE } from "./accents";
import { ChatPanel } from "./chat-panel";

interface TraceEvent {
  seq: number;
  ts: string;
  contextId: string;
  taskId?: string;
  kind: "request" | "response" | "status" | "artifact" | "error";
  from: string;
  to: string;
  method?: string;
  skill?: string;
  state?: string;
  summary: string;
  detail?: unknown;
  latencyMs?: number;
}

interface Scenario {
  id: string;
  title: string;
  description: string;
}

const KIND_LABEL: Record<TraceEvent["kind"], string> = {
  request: "→",
  response: "←",
  status: "•",
  artifact: "◆",
  error: "✕",
};

function TraceRow({ event }: { event: TraceEvent }) {
  const [open, setOpen] = useState(false);
  const from = accentFor(event.from);
  const to = accentFor(event.to);
  const isNote = event.from === event.to;

  return (
    <li className="border-b border-border/50 last:border-0">
      <div className="flex items-start gap-3 px-3 py-2.5">
        <span className="mt-0.5 w-4 shrink-0 text-center font-mono text-xs text-muted-foreground">
          {KIND_LABEL[event.kind]}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {isNote ? (
              <span className={`text-xs font-medium ${from.text}`}>
                {from.label}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <span className={from.text}>{from.label}</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <span className={to.text}>{to.label}</span>
              </span>
            )}

            {event.skill && (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {event.skill}
              </code>
            )}

            {event.state && (
              <Badge
                variant="outline"
                className={`text-[10px] ${STATE_STYLE[event.state] ?? ""}`}
              >
                {event.state}
              </Badge>
            )}

            {event.kind === "artifact" && (
              <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-300">
                artifact
              </Badge>
            )}

            {event.latencyMs !== undefined && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {event.latencyMs}ms
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-foreground/90">{event.summary}</p>

          {event.detail !== undefined && (
            <>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="mt-1.5 font-mono text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {open ? "hide" : "show"} {event.method ?? "payload"}
              </button>
              {open && (
                <pre className="mt-2 max-h-72 overflow-auto rounded border bg-background/60 p-3 font-mono text-[11px] leading-relaxed">
                  {JSON.stringify(event.detail, null, 2)}
                </pre>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Drives a scenario and renders every hop the mesh makes.
 *
 * The timeline is fed by an SSE stream of the server's trace bus, so what you
 * see is the actual sequence of A2A calls — including the ones the agents make
 * to each other, which no single participant could show you.
 */
export function MeshConsole({ scenarios }: { scenarios: Scenario[] }) {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [running, setRunning] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const sourceRef = useRef<EventSource | undefined>(undefined);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => sourceRef.current?.close();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [events.length]);

  /** Points the timeline at a context, whoever created it. */
  const watch = useCallback((contextId: string) => {
    sourceRef.current?.close();
    const source = new EventSource(
      `/api/a2a/trace?contextId=${encodeURIComponent(contextId)}`
    );
    sourceRef.current = source;

    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as TraceEvent;
      if (event.summary === SCENARIO_COMPLETE) {
        setRunning(undefined);
        source.close();
        return;
      }
      setEvents((prev) =>
        prev.some((e) => e.seq === event.seq) ? prev : [...prev, event]
      );
    };
    source.onerror = () => {
      source.close();
      setRunning(undefined);
    };
  }, []);

  const startChat = useCallback(
    (contextId: string) => {
      setEvents([]);
      setError(undefined);
      watch(contextId);
    },
    [watch]
  );

  const start = useCallback(async (scenario: string) => {
    sourceRef.current?.close();
    setEvents([]);
    setError(undefined);
    setRunning(scenario);

    try {
      const response = await fetch("/api/a2a/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, reset: true }),
      });
      if (!response.ok) throw new Error(await response.text());
      const { contextId } = (await response.json()) as { contextId: string };
      watch(contextId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to start");
      setRunning(undefined);
    }
  }, [watch]);

  const reset = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = undefined;
    setEvents([]);
    setRunning(undefined);
    setError(undefined);
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {scenarios.map((scenario) => (
          <div key={scenario.id} className="rounded-lg border bg-card p-4">
            <h3 className="mb-1 font-semibold">{scenario.title}</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              {scenario.description}
            </p>
            <Button
              size="sm"
              onClick={() => start(scenario.id)}
              disabled={Boolean(running)}
            >
              {running === scenario.id ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" /> Run
                </>
              )}
            </Button>
          </div>
        ))}
      </div>

      <ChatPanel onContext={startChat} />

      {error && (
        <p className="rounded border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Message flow</h3>
            <span className="font-mono text-xs text-muted-foreground">
              {events.length} events
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={reset}
            disabled={events.length === 0}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>

        {events.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Run a scenario to watch the agents talk to each other.
          </p>
        ) : (
          <ul className="max-h-[32rem] overflow-y-auto">
            {events.map((event) => (
              <TraceRow key={event.seq} event={event} />
            ))}
            <div ref={endRef} />
          </ul>
        )}
      </div>
    </div>
  );
}
