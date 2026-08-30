import type { Task } from "@a2a-js/sdk";
import { TaskState } from "@a2a-js/sdk";
import type { ListTasksRequest, ListTasksResponse } from "@a2a-js/sdk";
import {
  resolveUserScope,
  type OwnerResolver,
  type ServerCallContext,
  type TaskStore,
} from "@a2a-js/sdk/server";

/**
 * A task store that forgets.
 *
 * The SDK's `InMemoryTaskStore` never evicts, which is correct for a library
 * default and wrong for a public demo: a process that stays warm accumulates
 * every task anyone ever opened. This is the same store with a cap — oldest
 * first, insertion-ordered — so a long-running deployment has a bounded
 * ceiling instead of a slow leak.
 *
 * Scoping matches the SDK's: tenant, then owner, then task id.
 */
export class BoundedTaskStore implements TaskStore {
  private readonly tasks = new Map<string, { task: Task; scope: string }>();

  constructor(
    private readonly capacity = 500,
    private readonly ownerResolver: OwnerResolver = resolveUserScope
  ) {}

  private scopeOf(context: ServerCallContext): string {
    return `${context?.tenant ?? ""}::${
      context ? this.ownerResolver(context) : "unknown"
    }`;
  }

  async save(task: Task, context: ServerCallContext): Promise<void> {
    const scope = this.scopeOf(context);
    // Re-inserting moves the task to the end, so eviction is least-recently
    // written rather than least-recently created — a task still being worked
    // on will not be dropped out from under its own executor.
    this.tasks.delete(task.id);
    this.tasks.set(task.id, { task: structuredClone(task), scope });

    while (this.tasks.size > this.capacity) {
      const oldest = this.tasks.keys().next().value;
      if (oldest === undefined) break;
      this.tasks.delete(oldest);
    }
  }

  async load(
    taskId: string,
    context: ServerCallContext
  ): Promise<Task | undefined> {
    const entry = this.tasks.get(taskId);
    if (!entry || entry.scope !== this.scopeOf(context)) return undefined;
    return structuredClone(entry.task);
  }

  async list(
    params: ListTasksRequest,
    context: ServerCallContext
  ): Promise<ListTasksResponse> {
    const scope = this.scopeOf(context);

    const matching = [...this.tasks.values()]
      .filter((e) => e.scope === scope)
      .map((e) => e.task)
      .filter((t) => !params.contextId || t.contextId === params.contextId)
      // UNSPECIFIED is the proto default, i.e. "no status filter".
      .filter(
        (t) =>
          params.status === TaskState.TASK_STATE_UNSPECIFIED ||
          t.status?.state === params.status
      )
      .filter((t) => {
        if (!params.statusTimestampAfter) return true;
        const at = t.status?.timestamp;
        return Boolean(at && at >= params.statusTimestampAfter);
      })
      // Newest first, matching what a caller paging through history expects.
      .reverse();

    const pageSize = Math.min(Math.max(params.pageSize ?? 50, 1), 100);
    const offset = params.pageToken ? Number(params.pageToken) || 0 : 0;
    const page = matching.slice(offset, offset + pageSize);
    const nextOffset = offset + page.length;

    return {
      tasks: page.map((t) =>
        params.includeArtifacts ? t : { ...t, artifacts: [] }
      ),
      nextPageToken: nextOffset < matching.length ? String(nextOffset) : "",
      pageSize,
      totalSize: matching.length,
    };
  }

  /** Current task count. Exposed for tests. */
  get size(): number {
    return this.tasks.size;
  }
}
