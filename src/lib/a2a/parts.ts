import { randomUUID } from "node:crypto";
import type { Artifact, Message, Part } from "@a2a-js/sdk";
import { Role } from "@a2a-js/sdk";

/**
 * Constructors for the A2A wire types.
 *
 * The v1.0 SDK types are generated from the protobuf schema, so every field is
 * present-but-nullable rather than optional. Building them inline at each call
 * site is noisy and easy to get subtly wrong, so the mesh funnels all message
 * construction through these helpers.
 */

export function textPart(text: string): Part {
  return {
    content: { $case: "text", value: text },
    metadata: undefined,
    filename: "",
    mediaType: "text/plain",
  };
}

/** A structured payload — the part type that carries machine-readable results. */
export function dataPart(value: unknown, mediaType = "application/json"): Part {
  return {
    content: { $case: "data", value },
    metadata: undefined,
    filename: "",
    mediaType,
  };
}

/** A file passed by reference (a URL the receiving agent can fetch). */
export function fileUrlPart(
  url: string,
  mediaType: string,
  filename = ""
): Part {
  return {
    content: { $case: "url", value: url },
    metadata: undefined,
    filename,
    mediaType,
  };
}

/** A file passed by value — how the damage photo reaches the claims agent. */
export function fileBytesPart(
  bytes: Buffer,
  mediaType: string,
  filename = ""
): Part {
  return {
    content: { $case: "raw", value: bytes },
    metadata: undefined,
    filename,
    mediaType,
  };
}

/** Concatenates every text part, ignoring data and file parts. */
export function partsToText(parts: Part[] | undefined): string {
  if (!parts) return "";
  return parts
    .map((p) => (p.content?.$case === "text" ? p.content.value : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

/** The first structured payload in a part list, if there is one. */
export function firstData<T>(parts: Part[] | undefined): T | undefined {
  if (!parts) return undefined;
  for (const part of parts) {
    if (part.content?.$case === "data") return part.content.value as T;
  }
  return undefined;
}

/** Every file part, normalised to a description the UI can render. */
export function filePartSummaries(
  parts: Part[] | undefined
): Array<{ filename: string; mediaType: string; bytes?: number; url?: string }> {
  if (!parts) return [];
  const out: Array<{
    filename: string;
    mediaType: string;
    bytes?: number;
    url?: string;
  }> = [];
  for (const part of parts) {
    if (part.content?.$case === "raw") {
      out.push({
        filename: part.filename,
        mediaType: part.mediaType,
        bytes: part.content.value.byteLength,
      });
    } else if (part.content?.$case === "url") {
      out.push({
        filename: part.filename,
        mediaType: part.mediaType,
        url: part.content.value,
      });
    }
  }
  return out;
}

export interface MessageInit {
  parts: Part[];
  contextId?: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
  referenceTaskIds?: string[];
}

function message(role: Role, init: MessageInit): Message {
  return {
    messageId: randomUUID(),
    contextId: init.contextId ?? "",
    taskId: init.taskId ?? "",
    role,
    parts: init.parts,
    metadata: init.metadata,
    extensions: [],
    referenceTaskIds: init.referenceTaskIds ?? [],
  };
}

/** A message from an agent back to its caller. */
export function agentMessage(init: MessageInit): Message {
  return message(Role.ROLE_AGENT, init);
}

/** A message from a client into an agent. */
export function userMessage(init: MessageInit): Message {
  return message(Role.ROLE_USER, init);
}

export interface ArtifactInit {
  name: string;
  description: string;
  parts: Part[];
  artifactId?: string;
  metadata?: Record<string, unknown>;
}

export function artifact(init: ArtifactInit): Artifact {
  return {
    artifactId: init.artifactId ?? randomUUID(),
    name: init.name,
    description: init.description,
    parts: init.parts,
    metadata: init.metadata,
    extensions: [],
  };
}
