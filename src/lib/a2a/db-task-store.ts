import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { Task, TaskState, taskStateToJSON } from "@a2a-js/sdk";
import type { ListTasksRequest, ListTasksResponse } from "@a2a-js/sdk";
import {
  resolveUserScope,
  type OwnerResolver,
  type ServerCallContext,
  type TaskStore,
} from "@a2a-js/sdk/server";
import { db, a2aTasks } from "@/db";
import type { AgentId } from "./registry";

/**
 * A2A task state, kept somewhere every instance can see it.
 *
 * A2A assumes an agent remembers its own tasks between requests, which is a
 * completely reasonable thing for a protocol to assume and completely false of
 * an in-memory store on a platform that answers each request from whichever
 * process happens to be free. The symptom is a shopper answering the question
 * an agent just asked and being told `Task not found`.
 *
 * Rows carry the task as proto-JSON rather than a structured clone. The
 * in-memory shape holds tagged `oneof`s and raw bytes — a photo attached to a
 * claim, for instance — and `JSON.stringify` turns a `Uint8Array` into an
 * object of numbered keys that never comes back. The SDK's own codec already
 * knows how to write those as base64, so the stored row is exactly the wire
 * format, which is also the format worth being able to read by hand.
 */
export class DbTaskStore implements TaskStore {
  constructor(
    private readonly agent: AgentId,
    /** Rows older than this are pruned opportunistically. */
    private readonly ttlMs = 24 * 60 * 60 * 1000,
    private readonly ownerResolver: OwnerResolver = resolveUserScope
  ) {}

  private scopeOf(context: ServerCallContext): string {
    return `${context?.tenant ?? ""}::${
      context ? this.ownerResolver(context) : "unknown"
    }`;
  }

  async save(task: Task, context: ServerCallContext): Promise<void> {
    const row = {
      id: task.id,
      agent: this.agent,
      scope: this.scopeOf(context),
      contextId: task.contextId,
      state: taskStateToJSON(task.status?.state ?? TaskState.TASK_STATE_UNSPECIFIED),
      payload: JSON.stringify(Task.toJSON(task)),
      statusAt: task.status?.timestamp ?? null,
      updatedAt: new Date(),
    };

    await db
      .insert(a2aTasks)
      .values(row)
      .onConflictDoUpdate({ target: a2aTasks.id, set: row });

    await this.prune();
  }

  async load(
    taskId: string,
    context: ServerCallContext
  ): Promise<Task | undefined> {
    const [row] = await db
      .select()
      .from(a2aTasks)
      .where(
        and(
          eq(a2aTasks.id, taskId),
          eq(a2aTasks.agent, this.agent),
          // Scope is part of the lookup, not a check after it: a task belongs
          // to the caller who opened it, and a miss must be indistinguishable
          // from a task that never existed.
          eq(a2aTasks.scope, this.scopeOf(context))
        )
      )
      .limit(1);

    return row ? this.decode(row.payload) : undefined;
  }

  async list(
    params: ListTasksRequest,
    context: ServerCallContext
  ): Promise<ListTasksResponse> {
    const filters = [
      eq(a2aTasks.agent, this.agent),
      eq(a2aTasks.scope, this.scopeOf(context)),
    ];
    if (params.contextId) {
      filters.push(eq(a2aTasks.contextId, params.contextId));
    }
    // UNSPECIFIED is the proto default and is zero, so a truthy status is
    // exactly "the caller asked for a specific one".
    if (params.status) {
      filters.push(eq(a2aTasks.state, taskStateToJSON(params.status)));
    }
    if (params.statusTimestampAfter) {
      filters.push(gte(a2aTasks.statusAt, params.statusTimestampAfter));
    }

    const where = and(...filters);
    const pageSize = Math.min(Math.max(params.pageSize ?? 50, 1), 100);
    const offset = params.pageToken ? Number(params.pageToken) || 0 : 0;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(a2aTasks)
      .where(where);

    const rows = await db
      .select()
      .from(a2aTasks)
      // Newest first, matching what a caller paging through history expects.
      .orderBy(desc(a2aTasks.updatedAt))
      .limit(pageSize)
      .offset(offset)
      .where(where);

    const tasks = rows
      .map((row) => this.decode(row.payload))
      .filter((task): task is Task => task !== undefined)
      .map((task) => (params.includeArtifacts ? task : { ...task, artifacts: [] }));

    const nextOffset = offset + rows.length;

    return {
      tasks,
      nextPageToken: nextOffset < count ? String(nextOffset) : "",
      pageSize,
      totalSize: count,
    };
  }

  /**
   * A row written before some earlier deploy may not decode against today's
   * codec. That is a reason to treat the task as absent — which the protocol
   * already has an answer for — and not a reason to fail the request that
   * happened to read it.
   */
  private decode(payload: string): Task | undefined {
    try {
      return Task.fromJSON(JSON.parse(payload));
    } catch {
      return undefined;
    }
  }

  /**
   * Drops rows nobody will ask for again. Demo tasks are worthless within a
   * day and the table would otherwise grow for the life of the database.
   */
  private async prune(): Promise<void> {
    try {
      await db
        .delete(a2aTasks)
        .where(lt(a2aTasks.updatedAt, new Date(Date.now() - this.ttlMs)));
    } catch {
      // Housekeeping must never fail the task that triggered it.
    }
  }
}

/**
 * Whether task state has somewhere durable to live.
 *
 * A configured database is necessary but not sufficient: the table also has to
 * exist. Those come apart in exactly one common case — a deploy that ships this
 * code before anyone has synced the schema — and the failure mode is severe.
 * Every `save` throws `no such table`, which is every agent request, not a
 * quiet loss of memory between them.
 *
 * So the table is probed once, and a deployment missing it falls back to the
 * in-memory store and says so. That is the behaviour the demo had before this
 * store existed, which is a much better thing to degrade to than a mesh that
 * answers nothing at all.
 */
export async function taskPersistenceAvailable(): Promise<boolean> {
  if (!process.env.TURSO_DATABASE_URL) return false;

  probed ??= probe();
  return probed;
}

let probed: Promise<boolean> | undefined;

async function probe(): Promise<boolean> {
  try {
    await db.select({ id: a2aTasks.id }).from(a2aTasks).limit(1);
    return true;
  } catch (error) {
    console.warn(
      "[a2a] A database is configured but the a2a_tasks table is missing, so " +
        "task state stays in memory and will not survive a change of " +
        "instance. Run `npm run db:sync` (or `npm run db:push`) against it. " +
        `Cause: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

/** Forgets the probe result. Used by tests. */
export function resetTaskPersistenceProbe(): void {
  probed = undefined;
}
