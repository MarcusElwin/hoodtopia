# A2A Commerce Mesh

Three merchant-side agents — **checkout**, **shipping** and **claims** — that
coordinate a purchase lifecycle over the [Agent2Agent
protocol](https://a2a-protocol.org/latest/specification/) (v1.0). Built on the
official [`@a2a-js/sdk`](https://github.com/a2aproject/a2a-js).

Try it at **`/agents`**.

## Why three agents and not one

A single agent with three tools would be less code and a worse demo, because it
would dodge the only hard question: what happens when the parties are not the
same party.

Here they are not. Each agent owns its own data and can read nobody else's:

- the **checkout** agent knows what was ordered and paid, and nothing about carriers;
- the **shipping** agent knows what the carrier did, and nothing about money;
- the **claims** agent knows neither, and has to decide anyway.

So the checkout agent cannot quote a total without calling shipping, and the
claims agent cannot decide a claim without calling both. Those calls are
ordinary A2A `SendMessage` requests over HTTP — the same request an outside
buyer's agent would make. There is no privileged back door, which is what makes
this a mesh rather than a monolith with extra JSON.

```
Shopper agent (buyer side)
      │
      ├─► Checkout ──► Shipping           quote_shipping, book_shipment
      │
      └─► Claims  ──► Checkout            order_status
                  ──► Shipping            shipment_evidence
                  ──► Checkout            issue_replacement
```

## Endpoints

| URL | What |
| --- | --- |
| `GET /a2a/<agent>/.well-known/agent-card.json` | Agent card (JWS-signed) |
| `GET /.well-known/jwks.json` | Public keys for verifying those cards |
| `POST /a2a/<agent>` | JSON-RPC (`SendMessage`, `SendStreamingMessage`, `GetTask`, …) |
| `GET /api/a2a/cards` | All three cards, for the demo page |
| `POST /api/a2a/scenario` | Starts a scripted lifecycle, returns its `contextId` |
| `GET /api/a2a/trace?contextId=…` | SSE stream of every hop in that run |

`<agent>` is `checkout`, `shipping` or `disputes`.

The well-known path is served through a rewrite in `next.config.ts`: Next's App
Router will not route a path segment beginning with a dot, so it maps onto
`/a2a/<agent>/card`.

## Skills

**Checkout** — `quote_cart`, `place_order`, `order_status`, `issue_replacement`
**Shipping** — `quote_shipping`, `book_shipment`, `track_shipment`, `shipment_evidence`
**Claims** — `open_claim`, `claim_status`

## What the demo actually exercises

| A2A feature | Where |
| --- | --- |
| Agent cards, skills, capabilities | three cards, rendered live on `/agents` |
| Signed cards (JWS, v1.0) | every card is signed; the client verifies before it transacts |
| `input-required` | checkout will not place an order without confirmation; claims asks for a photo |
| Long-running tasks | `track_shipment` stays `working` across every carrier scan |
| Streaming (`SendStreamingMessage`) | the tracking stream, and the demo timeline |
| Push notifications | declared and wired on the shipping agent |
| Artifacts | `order-confirmation`, `shipping-label`, `proof-of-delivery`, `claim-resolution` |
| Multi-part messages | the damage photo arrives as a `raw` file part |
| `contextId` threading | one purchase = one context across all three agents |
| **Agent as client** | checkout → shipping; claims → checkout and shipping |

## Running it

```bash
npm install
npm run dev            # storefront on :3005
open http://localhost:3005/agents
```

No database, no Medusa backend and no API keys are needed: the mesh defaults to
`A2A_DEMO_MODE=fixtures`.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `A2A_DEMO_MODE` | `fixtures` | `live` prices against Medusa and classifies claims with a model |
| `A2A_PUBLIC_ORIGIN` | `NEXT_PUBLIC_SITE_URL`, else `http://localhost:$PORT` | Absolute origin the cards advertise |
| `A2A_PARCEL_TICK_MS` | `1500` | How fast the scripted parcel moves |
| `A2A_SIGNING` | on | Set to `off` to serve unsigned cards |
| `A2A_SIGNING_JWK` | unset | Private JWK (JSON) to sign with. Unset generates an ephemeral ES256 key per process |

The advertised origin matters: A2A cards must carry absolute URLs, and the
agents reach each other through them. If it is wrong, agent-to-agent calls go
to the wrong host.

## Card signing and verification

Every card is signed with JWS over a JCS-canonicalised body, per A2A v1.0 §8.4,
and the public half is published at `/.well-known/jwks.json`.

The client verifies **before** it transacts (`discover()` in
`src/lib/a2a/client.ts`). That ordering is the point: a card is a claim about
who an agent is, and checking it after you have already sent an order is
theatre. A card that fails verification is refused outright; an *unsigned* card
is allowed through with the outcome recorded, because refusing those globally
would leave the mesh unable to talk to any agent that has not adopted v1.0
signing yet. A real deployment decides that per counterparty.

Keys are resolved from **the origin the card was fetched from**, never from the
signature's own `jku` header. A card that names its own key location proves
nothing — anyone who can serve you a card can serve you a matching key. The
only thing worth trusting is the origin you already chose to talk to.

By default the key is an ephemeral ES256 keypair generated at boot, so the demo
signs with zero configuration. Set `A2A_SIGNING_JWK` to a private JWK to pin a
long-lived key; only its public parameters are ever published.

`src/lib/a2a/signing.test.ts` covers the round trip plus the cases that matter:
a tampered endpoint URL, a replaced signature, an unsigned card, and a client
refusing to transact when the origin publishes no matching key.

## Hardening

The A2A surface is public and unauthenticated by design, so:

- **Rate limits.** `/a2a/*` and the scenario runner are limited per IP via the
  same `src/lib/rate-limit.ts` the tRPC layer uses. The client address is taken
  from `x-real-ip`, else the *rightmost* `x-forwarded-for` entry — the leftmost
  is client-supplied and trivially spoofed.
- **Bounded task storage.** `BoundedTaskStore` (`src/lib/a2a/task-store.ts`)
  replaces the SDK's `InMemoryTaskStore`, which never evicts. Eviction is
  least-recently-written, so a task still being worked on is never dropped out
  from under its own executor.
- **Bounded demo records.** Orders, shipments and claims are capped. Nothing
  resets shared state between visitors any more — a global reset let one
  visitor delete another's order mid-run.
- **Guarded model input.** A claim narrative is attacker-controlled text from
  outside the trust boundary, so it goes through `runInputGuardrails` (length
  cap, injection detection, moderation, safety logging) before it can reach a
  prompt. Flagged text falls back to keyword classification rather than failing
  the claim. The policy table already stops a claim from *talking* its way to a
  refund; the guardrails stop it reaching the model at all.

## Design notes, and where the demo is not production

**Three namespaces, one deploy.** In production these would be three
deployments owned by three teams. Here they are three route namespaces in one
Next app — separate cards, separate endpoints and real HTTP hops between them,
but a single process. The per-origin well-known path also has to be namespaced,
which is a genuine wrinkle when several agents share a host.

**Skill selection is a local convention.** A2A standardises *describing* skills
on the card but not *selecting* one on a request: the wire carries a
natural-language message. Machine callers here set a `hoodtopia.dev/skill`
metadata key so an internal hop never depends on an LLM guessing right;
free-text falls back to keyword classification (`src/lib/a2a/dispatch.ts`).
This is a gap every A2A mesh currently fills for itself.

**The model does not decide refunds.** In `live` mode a model classifies the
buyer's narrative into a claim type. The outcome is then a deterministic policy
table (`src/lib/a2a/claims-policy.ts`) over facts gathered from the other two
agents. Language understanding and money movement are deliberately separated.

**No authentication.** The cards declare no security scheme so the whole flow
stays inspectable. A real merchant would declare and enforce one, and A2A v1.0's
JWS-signed agent cards would let a buyer verify the card came from the domain it
claims.

**A2A is not a payments protocol.** The confirmation gate is where a payment
mandate would attach; A2A models the pause, not the authorisation. That is what
AP2, ACP and friends are for.

**The trace bus is not part of A2A.** No participant in a real mesh can see the
whole graph — each agent sees only its own tasks. The timeline on `/agents` is
served by an in-process trace bus (`src/lib/a2a/trace.ts`) purely so the demo
can show what would otherwise be invisible. Production would use distributed
tracing correlated on `contextId`.

## Layout

```
src/lib/a2a/
  agents/            checkout.ts, shipping.ts, disputes.ts — the executors
  fixtures/          catalogue and demo state (orders, shipments, claims)
  cards.ts           agent card construction
  signing.ts         JWS card signing, JWKS, and verification
  claims-policy.ts   the decision table, pure and unit-tested
  client.ts          A2A client used by the shopper AND by agent-to-agent calls
  dispatch.ts        skill selection
  http.ts            Next.js App Router adapter for the SDK's transport handler
  parts.ts           constructors for the proto-shaped wire types
  pricing.ts         Medusa or fixture pricing
  runtime.ts         per-agent DefaultRequestHandler + JsonRpcTransportHandler
  scenario.ts        the scripted shopper agent
  status.ts          task lifecycle helpers
  task-store.ts      bounded TaskStore
  trace.ts           demo-only trace bus
```

## Tests

```bash
npx vitest run src/lib/a2a
```

`src/lib/a2a/mesh.test.ts` runs the agents end to end through the real JSON-RPC
handlers. Agent-to-agent calls still go through `fetch`; the test harness
(`test-harness.ts`) only redirects that `fetch` in-process, so the agent code
under test is unmodified and unaware.

## Gotcha worth knowing

Task state lives in memory and is pinned to `globalThis` so it survives Next's
hot reload — otherwise a task parked in `input-required` vanishes when you edit
a file mid-demo. Only the **stores** are pinned, though. Caching the whole
runtime there also pins the executor, and an edited agent goes on serving its
previous implementation until a full restart. See `runtime.ts`.
