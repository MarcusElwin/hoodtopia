import type { AgentCard, AgentSkill } from "@a2a-js/sdk";
import { A2A_PROTOCOL_VERSION } from "@a2a-js/sdk";
import { agentEndpoint, type AgentId } from "./registry";

/**
 * Agent card construction.
 *
 * The card is the only thing a stranger needs in order to work with an agent:
 * what it is, what it can do, how to reach it, and how to authenticate. Getting
 * the skill descriptions right matters more than it looks — they are what a
 * calling agent reads to decide whether this is the right counterparty.
 */

export interface SkillInit {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples: string[];
  inputModes?: string[];
  outputModes?: string[];
}

export function skill(init: SkillInit): AgentSkill {
  return {
    id: init.id,
    name: init.name,
    description: init.description,
    tags: init.tags,
    examples: init.examples,
    inputModes: init.inputModes ?? [],
    outputModes: init.outputModes ?? [],
    securityRequirements: [],
  };
}

export interface AgentCardInit {
  id: AgentId;
  name: string;
  description: string;
  version: string;
  skills: AgentSkill[];
  documentationUrl?: string;
  /** Long-running work that a client may want a webhook for. */
  pushNotifications?: boolean;
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
}

export function buildAgentCard(init: AgentCardInit): AgentCard {
  return {
    name: init.name,
    description: init.description,
    version: init.version,
    documentationUrl: init.documentationUrl,
    supportedInterfaces: [
      {
        url: agentEndpoint(init.id),
        protocolBinding: "JSONRPC",
        tenant: "",
        protocolVersion: A2A_PROTOCOL_VERSION,
      },
    ],
    provider: {
      organization: "Hoodtopia",
      url: "https://github.com/MarcusElwin/hoodtopia",
    },
    capabilities: {
      streaming: true,
      pushNotifications: init.pushNotifications ?? false,
      extensions: [],
      extendedAgentCard: false,
    },
    // The demo mesh runs unauthenticated so the whole flow is inspectable.
    // A production merchant would declare (and enforce) a scheme here, and the
    // blog post is explicit that this is the gap between demo and deployment.
    securitySchemes: {},
    securityRequirements: [],
    defaultInputModes: init.defaultInputModes ?? ["text/plain", "application/json"],
    defaultOutputModes: init.defaultOutputModes ?? [
      "text/plain",
      "application/json",
    ],
    skills: init.skills,
    signatures: [],
  };
}
