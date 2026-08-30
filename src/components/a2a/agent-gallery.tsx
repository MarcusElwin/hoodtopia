import type { AgentCard } from "@a2a-js/sdk";
import { Badge } from "@/components/ui/badge";
import { AGENT_ACCENT, type AgentKey } from "./accents";

interface GalleryAgent {
  id: AgentKey;
  cardUrl: string;
  card: AgentCard;
}

/**
 * The discovery panel: everything a stranger learns about these agents before
 * sending them anything. Rendered straight from the served cards so the page
 * cannot drift from what the endpoints actually advertise.
 */
export function AgentGallery({ agents }: { agents: GalleryAgent[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {agents.map(({ id, card, cardUrl }) => {
        const accent = AGENT_ACCENT[id];
        return (
          <div
            key={id}
            className="flex flex-col rounded-lg border bg-card p-5"
          >
            <div className="mb-3 flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${accent.dot}`}
                aria-hidden
              />
              <h3 className="font-semibold leading-tight">{card.name}</h3>
            </div>

            <p className="mb-4 text-sm text-muted-foreground">
              {card.description}
            </p>

            <div className="mb-4 flex flex-wrap gap-1.5">
              <Badge variant="outline" className="font-mono text-[10px]">
                v{card.version}
              </Badge>
              {card.capabilities?.streaming && (
                <Badge variant="secondary" className="text-[10px]">
                  streaming
                </Badge>
              )}
              {card.capabilities?.pushNotifications && (
                <Badge variant="secondary" className="text-[10px]">
                  push notifications
                </Badge>
              )}
            </div>

            <div className="mt-auto space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Skills
              </p>
              <ul className="space-y-1.5">
                {card.skills.map((s) => (
                  <li key={s.id} className="text-sm">
                    <code className="font-mono text-xs text-primary">
                      {s.id}
                    </code>
                    <span className="text-muted-foreground"> — {s.name}</span>
                  </li>
                ))}
              </ul>

              <a
                href={cardUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block truncate font-mono text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                title={cardUrl}
              >
                {cardUrl.replace(/^https?:\/\/[^/]+/, "")}
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
