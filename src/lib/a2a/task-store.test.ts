import { describe, expect, it } from "vitest";
import { TaskState, type Task } from "@a2a-js/sdk";
import { ServerCallContext, UnauthenticatedUser } from "@a2a-js/sdk/server";
import { BoundedTaskStore } from "./task-store";

const ctx = () =>
  new ServerCallContext({ user: new UnauthenticatedUser(), requestedVersion: "1.0" });

function task(id: string, contextId = "ctx"): Task {
  return {
    id,
    contextId,
    status: {
      state: TaskState.TASK_STATE_COMPLETED,
      message: undefined,
      timestamp: new Date().toISOString(),
    },
    artifacts: [],
    history: [],
    metadata: undefined,
  };
}

describe("BoundedTaskStore", () => {
  it("round-trips a task", async () => {
    const store = new BoundedTaskStore();
    await store.save(task("t1"), ctx());
    expect((await store.load("t1", ctx()))?.id).toBe("t1");
  });

  it("evicts the oldest once over capacity", async () => {
    const store = new BoundedTaskStore(3);
    for (const id of ["a", "b", "c", "d"]) await store.save(task(id), ctx());

    expect(store.size).toBe(3);
    expect(await store.load("a", ctx())).toBeUndefined();
    expect(await store.load("d", ctx())).toBeDefined();
  });

  it("does not evict a task that is still being written to", async () => {
    const store = new BoundedTaskStore(3);
    for (const id of ["a", "b", "c"]) await store.save(task(id), ctx());
    // `a` is still in flight — touching it should spare it from eviction.
    await store.save(task("a"), ctx());
    await store.save(task("d"), ctx());

    expect(await store.load("a", ctx())).toBeDefined();
    expect(await store.load("b", ctx())).toBeUndefined();
  });

  it("isolates stored tasks from later caller mutation", async () => {
    const store = new BoundedTaskStore();
    const original = task("t1");
    await store.save(original, ctx());
    original.contextId = "mutated";
    expect((await store.load("t1", ctx()))?.contextId).toBe("ctx");
  });

  it("filters a listing by context id", async () => {
    const store = new BoundedTaskStore();
    await store.save(task("t1", "one"), ctx());
    await store.save(task("t2", "two"), ctx());

    const listed = await store.list(
      {
        tenant: "",
        contextId: "two",
        status: TaskState.TASK_STATE_UNSPECIFIED,
        pageToken: "",
        statusTimestampAfter: undefined,
      },
      ctx()
    );
    expect(listed.tasks.map((t) => t.id)).toEqual(["t2"]);
    expect(listed.totalSize).toBe(1);
  });

  it("pages through a listing", async () => {
    const store = new BoundedTaskStore();
    for (const id of ["a", "b", "c"]) await store.save(task(id), ctx());

    const base = {
      tenant: "",
      contextId: "",
      status: TaskState.TASK_STATE_UNSPECIFIED,
      statusTimestampAfter: undefined,
    };
    const first = await store.list({ ...base, pageSize: 2, pageToken: "" }, ctx());
    expect(first.tasks).toHaveLength(2);
    expect(first.nextPageToken).toBe("2");

    const second = await store.list(
      { ...base, pageSize: 2, pageToken: first.nextPageToken },
      ctx()
    );
    expect(second.tasks).toHaveLength(1);
    expect(second.nextPageToken).toBe("");
  });
});
