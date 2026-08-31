import type { Metadata } from "next";
import Link from "next/link";
import { runtimeFor } from "@/lib/a2a/agents";
import { AGENT_IDS, agentCardUrl } from "@/lib/a2a/registry";
import { SCENARIOS } from "@/lib/a2a/scenario";
import { headers } from "next/headers";
import { demoMode, rememberOrigin } from "@/lib/a2a/config";
import { AgentGallery } from "@/components/a2a/agent-gallery";
import { MeshConsole } from "@/components/a2a/mesh-console";
import { Badge } from "@/components/ui/badge";
import type { AgentKey } from "@/components/a2a/accents";

export const metadata: Metadata = {
  title: "A2A Commerce Mesh | Hoodtopia",
  description:
    "Three merchant agents — checkout, shipping and claims — coordinating a purchase lifecycle over the Agent2Agent protocol.",
};

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  // The cards rendered below embed an absolute endpoint URL, so the page has to
  // know which host it is being served on before it builds them.
  rememberOrigin(await headers());

  const agents = await Promise.all(
    AGENT_IDS.map(async (id) => {
      const runtime = await runtimeFor(id);
      return {
        id: id as AgentKey,
        cardUrl: agentCardUrl(id),
        // The signed card, so the page shows what a client would verify.
        card: await runtime.requestHandler.getAgentCard(),
      };
    })
  );

  return (
    <div className="min-h-screen">
      <div className="border-b bg-secondary/30">
        <div className="container mx-auto px-4 py-14 md:py-20">
          <Badge variant="outline" className="mb-4 font-mono text-[10px]">
            A2A protocol v1.0 · {demoMode()} mode
          </Badge>
          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
            The commerce mesh
          </h1>
          <p className="max-w-3xl text-lg text-muted-foreground">
            Three agents own three parts of a purchase, and none of them can see
            the others&apos; data. The checkout agent cannot price a delivery, so
            it calls the shipping agent. The claims agent cannot see what was
            paid or what the carrier did, so it asks both. Every one of those
            hops is an{" "}
            <Link
              href="https://a2a-protocol.org/latest/specification/"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              Agent2Agent
            </Link>{" "}
            call over HTTP — the same call an outside buyer agent would make.
          </p>
        </div>
      </div>

      <div className="container mx-auto space-y-12 px-4 py-12 md:py-16">
        <section>
          <h2 className="mb-1 text-2xl font-semibold">Discovery</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Served live from each agent&apos;s card. This is everything a
            stranger needs to start working with them.
          </p>
          <AgentGallery agents={agents} />
        </section>

        <section>
          <h2 className="mb-1 text-2xl font-semibold">The purchase lifecycle</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Talk to an agent in plain language, or run a scripted lifecycle.
            Either way every hop lands on the timeline below — expand any row to
            see the exact A2A payload on the wire.
          </p>
          <MeshConsole scenarios={SCENARIOS} />
        </section>
      </div>
    </div>
  );
}
