import type { Message, Task, TaskStatusUpdateEvent } from "@a2a-js/sdk";
import { TaskState } from "@a2a-js/sdk";

/**
 * Task lifecycle helpers.
 *
 * A2A's task states are what separate it from a plain tool call: an order that
 * needs a human to confirm the total parks in `input-required`; a parcel in
 * transit sits in `working` for days. The executors below express their whole
 * flow as transitions through these states.
 */

const STATE_SLUGS: Record<number, string> = {
  [TaskState.TASK_STATE_UNSPECIFIED]: "unspecified",
  [TaskState.TASK_STATE_SUBMITTED]: "submitted",
  [TaskState.TASK_STATE_WORKING]: "working",
  [TaskState.TASK_STATE_COMPLETED]: "completed",
  [TaskState.TASK_STATE_FAILED]: "failed",
  [TaskState.TASK_STATE_CANCELED]: "canceled",
  [TaskState.TASK_STATE_INPUT_REQUIRED]: "input-required",
  [TaskState.TASK_STATE_REJECTED]: "rejected",
  [TaskState.TASK_STATE_AUTH_REQUIRED]: "auth-required",
};

/** Human/UI-facing name for a task state, e.g. `input-required`. */
export function stateSlug(state: TaskState | undefined): string {
  if (state === undefined) return "unspecified";
  return STATE_SLUGS[state] ?? "unspecified";
}

/** States after which no further work happens on a task. */
export function isTerminal(state: TaskState | undefined): boolean {
  return (
    state === TaskState.TASK_STATE_COMPLETED ||
    state === TaskState.TASK_STATE_FAILED ||
    state === TaskState.TASK_STATE_CANCELED ||
    state === TaskState.TASK_STATE_REJECTED
  );
}

/** States where the agent has stopped and is waiting on someone else. */
export function isInterrupted(state: TaskState | undefined): boolean {
  return (
    state === TaskState.TASK_STATE_INPUT_REQUIRED ||
    state === TaskState.TASK_STATE_AUTH_REQUIRED
  );
}

export function newTask(params: {
  id: string;
  contextId: string;
  history?: Message[];
  metadata?: Record<string, unknown>;
}): Task {
  return {
    id: params.id,
    contextId: params.contextId,
    status: {
      state: TaskState.TASK_STATE_SUBMITTED,
      message: undefined,
      timestamp: new Date().toISOString(),
    },
    artifacts: [],
    history: params.history ?? [],
    metadata: params.metadata,
  };
}

export function statusUpdate(params: {
  taskId: string;
  contextId: string;
  state: TaskState;
  message?: Message;
  metadata?: Record<string, unknown>;
}): TaskStatusUpdateEvent {
  return {
    taskId: params.taskId,
    contextId: params.contextId,
    status: {
      state: params.state,
      message: params.message,
      timestamp: new Date().toISOString(),
    },
    metadata: params.metadata,
  };
}

/**
 * Task id to context id, for `cancelTask`.
 *
 * The SDK hands `cancelTask` only a task id, but a `TaskStatusUpdateEvent`
 * carries a context id too — emitting an empty one produces an event no
 * consumer can correlate. Executors record the pairing when they open a task.
 */
export class ContextIndex {
  private readonly byTask = new Map<string, string>();

  remember(taskId: string, contextId: string): void {
    this.byTask.set(taskId, contextId);
    // Bound the map: a long-lived process would otherwise keep every task id
    // it has ever seen.
    if (this.byTask.size > 1_000) {
      const oldest = this.byTask.keys().next().value;
      if (oldest !== undefined) this.byTask.delete(oldest);
    }
  }

  contextFor(taskId: string): string {
    return this.byTask.get(taskId) ?? "";
  }

  forget(taskId: string): void {
    this.byTask.delete(taskId);
  }
}
