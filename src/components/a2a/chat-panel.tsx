"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { accentFor, STATE_STYLE, type AgentKey } from "./accents";

interface Turn {
  role: "you" | "agent";
  text: string;
  agent: AgentKey;
  state?: string;
}

const AGENTS: Array<{ id: AgentKey; label: string; hint: string }> = [
  { id: "checkout", label: "Checkout", hint: "Buy one Umai Kanji hoodie, ship to London" },
  { id: "shipping", label: "Shipping", hint: "What are the delivery options to Sweden?" },
  { id: "disputes", label: "Claims", hint: "My hoodie from HT-10001 arrived damaged" },
];

/**
 * A plain conversation with one agent.
 *
 * There is no router here on purpose. A2A gives a buyer a set of counterparties
 * and no front door, so you pick who to talk to — the same choice a buyer's
 * agent makes after reading the cards. Every message still lands on the shared
 * timeline, so you can watch a sentence turn into agent-to-agent calls.
 */
export function ChatPanel({
  onContext,
}: {
  onContext: (contextId: string) => void;
}) {
  const [agent, setAgent] = useState<AgentKey>("checkout");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const contextRef = useRef<string | undefined>(undefined);
  const taskRef = useRef<string | undefined>(undefined);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return;
      setDraft("");
      setTurns((prev) => [...prev, { role: "you", text, agent }]);
      setBusy(true);

      try {
        const response = await fetch("/api/a2a/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent,
            text,
            contextId: contextRef.current,
            taskId: taskRef.current,
          }),
        });
        const data = (await response.json()) as {
          contextId: string;
          taskId?: string;
          state: string;
          reply: string;
        };

        if (!contextRef.current) {
          contextRef.current = data.contextId;
          onContext(data.contextId);
        }
        taskRef.current = data.taskId;
        setContinuing(Boolean(data.taskId));

        setTurns((prev) => [
          ...prev,
          { role: "agent", text: data.reply, agent, state: data.state },
        ]);
      } catch {
        setTurns((prev) => [
          ...prev,
          { role: "agent", text: "The request failed.", agent, state: "failed" },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [agent, busy, onContext]
  );

  const active = AGENTS.find((a) => a.id === agent)!;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <span className="text-sm font-semibold">Talk to</span>
        {AGENTS.map((option) => {
          const accent = accentFor(option.id);
          const selected = option.id === agent;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setAgent(option.id);
                // A task belongs to the agent that opened it.
                taskRef.current = undefined;
                setContinuing(false);
              }}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                selected
                  ? `${accent.border} ${accent.text} bg-muted`
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${accent.dot}`} aria-hidden />
              {option.label}
            </button>
          );
        })}
        {continuing && (
          <Badge variant="outline" className="ml-auto text-[10px]">
            continuing a task
          </Badge>
        )}
      </div>

      <div className="max-h-80 space-y-3 overflow-y-auto px-4 py-4">
        {turns.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <p>No router, no front door — you pick who to talk to.</p>
            <button
              type="button"
              onClick={() => send(active.hint)}
              className="mt-2 font-mono text-xs text-primary underline-offset-4 hover:underline"
            >
              “{active.hint}”
            </button>
          </div>
        ) : (
          turns.map((turn, i) => {
            const accent = accentFor(turn.agent);
            return (
              <div key={i} className={turn.role === "you" ? "text-right" : ""}>
                <div
                  className={`inline-block max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                    turn.role === "you"
                      ? "bg-primary text-primary-foreground"
                      : "border bg-background"
                  }`}
                >
                  {turn.role === "agent" && (
                    <span className={`mb-1 block text-[11px] font-medium ${accent.text}`}>
                      {accent.label}
                    </span>
                  )}
                  <span className="whitespace-pre-wrap">{turn.text}</span>
                </div>
                {turn.state && turn.state !== "message" && (
                  <div className="mt-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${STATE_STYLE[turn.state] ?? ""}`}
                    >
                      {turn.state}
                    </Badge>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-center gap-2 border-t px-4 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={`Message the ${active.label.toLowerCase()} agent…`}
          maxLength={2000}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label={`Message the ${active.label} agent`}
        />
        <Button type="submit" size="sm" disabled={busy || !draft.trim()}>
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </Button>
      </form>
    </div>
  );
}
