import type { AgentId } from "../registry";
import { getOrCreateRuntime, type AgentRuntime } from "../runtime";
import { checkoutAgent } from "./checkout";
import { disputesAgent } from "./disputes";
import { shippingAgent } from "./shipping";

const DEFINITIONS = {
  checkout: checkoutAgent,
  shipping: shippingAgent,
  disputes: disputesAgent,
} as const;

export function runtimeFor(id: AgentId): AgentRuntime {
  return getOrCreateRuntime(DEFINITIONS[id]);
}

export { checkoutCard } from "./checkout";
export { disputesCard } from "./disputes";
export { shippingCard } from "./shipping";
