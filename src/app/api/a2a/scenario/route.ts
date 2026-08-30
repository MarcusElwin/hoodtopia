import { randomUUID } from "node:crypto";
import { runScenario, SCENARIOS, type ScenarioId } from "@/lib/a2a/scenario";
import { resetDemoState } from "@/lib/a2a/fixtures/store";

export const dynamic = "force-dynamic";

const IDS = new Set(SCENARIOS.map((s) => s.id));

/**
 * Starts a scenario and returns its contextId immediately.
 *
 * The run is not awaited: a lifecycle that follows a parcel to the door takes
 * longer than a request should, and the UI watches the trace stream instead.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { scenario?: string; reset?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const scenario = body.scenario ?? "";
  if (!IDS.has(scenario as ScenarioId)) {
    return Response.json(
      { error: `Unknown scenario: ${scenario || "(none)"}` },
      { status: 400 }
    );
  }

  if (body.reset) resetDemoState();

  const contextId = randomUUID();
  void runScenario(scenario as ScenarioId, contextId).catch(() => {
    // Failures are already on the trace bus as `error` events, which is where
    // the UI reads them from; nothing useful to add here.
  });

  return Response.json({ contextId, scenario });
}
