import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { TaskState } from "@a2a-js/sdk";
import type { Task } from "@a2a-js/sdk";
import { ServerCallContext, UnauthenticatedUser } from "@a2a-js/sdk/server";
import { fileBytesPart, userMessage } from "./parts";

/**
 * The persistent store, against a real libSQL database held in memory.
 *
 * Worth the setup rather than a mocked `db`: the things that can go wrong here
 * are serialisation and scoping, and a mock would agree with whatever the code
 * happens to do.
 */

type Store = import("./db-task-store").DbTaskStore;

let DbTaskStore: typeof import("./db-task-store").DbTaskStore;
let store_module: typeof import("./db-task-store");
let saved: string | undefined;

beforeAll(async () => {
  saved = process.env.TURSO_DATABASE_URL;
  process.env.TURSO_DATABASE_URL = ":memory:";
  vi.resetModules();

  const { db } = await import("@/db");
  await db.run(`
    CREATE TABLE a2a_tasks (
      id text PRIMARY KEY NOT NULL,
      agent text NOT NULL,
      scope text NOT NULL,
      context_id text NOT NULL,
      state text NOT NULL,
      payload text NOT NULL,
      status_at text,
      updated_at integer NOT NULL
    )
  `);

  store_module = await import("./db-task-store");
  ({ DbTaskStore } = store_module);
});

afterAll(() => {
  if (saved === undefined) delete process.env.TURSO_DATABASE_URL;
  else process.env.TURSO_DATABASE_URL = saved;
  vi.resetModules();
});

function context(user = "shopper"): ServerCallContext {
  return new ServerCallContext({
    user: new UnauthenticatedUser(),
    tenant: user,
    requestedVersion: "1.0",
  });
}

function task(id: string, contextId = "ctx-1"): Task {
  return {
    id,
    contextId,
    status: {
      state: TaskState.TASK_STATE_INPUT_REQUIRED,
      message: undefined,
      timestamp: "2026-08-31T12:00:00.000Z",
    },
    artifacts: [],
    history: [],
    metadata: undefined,
  };
}

describe("tasks that outlive the process that made them", () => {
  let store: Store;
  beforeAll(() => {
    store = new DbTaskStore("checkout");
  });

  it("round-trips a task through the database", async () => {
    await store.save(task("t-1"), context());
    const loaded = await store.load("t-1", context());

    expect(loaded?.id).toBe("t-1");
    expect(loaded?.status?.state).toBe(TaskState.TASK_STATE_INPUT_REQUIRED);
  });

  it("keeps binary parts intact", async () => {
    // A photo attached to a claim. `JSON.stringify` turns a Uint8Array into an
    // object of numbered keys that never comes back, which is why the row is
    // written through the SDK codec instead.
    const photo = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const withPhoto: Task = {
      ...task("t-photo"),
      history: [
        userMessage({
          parts: [fileBytesPart(photo, "image/png", "damage.png")],
          contextId: "ctx-1",
          taskId: "t-photo",
        }),
      ],
    };

    await store.save(withPhoto, context());
    const loaded = await store.load("t-photo", context());

    const part = loaded?.history?.[0]?.parts?.[0];
    expect(part?.content?.$case).toBe("raw");
    expect(Buffer.from(part?.content?.value as Uint8Array)).toEqual(photo);
  });

  it("does not hand one caller's task to another", async () => {
    await store.save(task("t-mine"), context("marcus"));

    expect(await store.load("t-mine", context("marcus"))).toBeDefined();
    expect(await store.load("t-mine", context("someone-else"))).toBeUndefined();
  });

  it("does not hand one agent's task to another", async () => {
    await store.save(task("t-checkout"), context());

    const shipping = new DbTaskStore("shipping");
    expect(await shipping.load("t-checkout", context())).toBeUndefined();
  });

  it("overwrites rather than duplicating on re-save", async () => {
    await store.save(task("t-twice"), context());
    const completed: Task = {
      ...task("t-twice"),
      status: {
        state: TaskState.TASK_STATE_COMPLETED,
        message: undefined,
        timestamp: "2026-08-31T12:05:00.000Z",
      },
    };
    await store.save(completed, context());

    const loaded = await store.load("t-twice", context());
    expect(loaded?.status?.state).toBe(TaskState.TASK_STATE_COMPLETED);
  });

  it("lists a conversation's tasks and filters by state", async () => {
    const scope = context("lister");
    await store.save(task("t-a", "ctx-list"), scope);
    await store.save(task("t-b", "ctx-list"), scope);
    await store.save(task("t-elsewhere", "ctx-other"), scope);

    const all = await store.list(
      { contextId: "ctx-list" } as never,
      scope
    );
    expect(all.tasks.map((t) => t.id).sort()).toEqual(["t-a", "t-b"]);
    expect(all.totalSize).toBe(2);

    const completedOnly = await store.list(
      { contextId: "ctx-list", status: TaskState.TASK_STATE_COMPLETED } as never,
      scope
    );
    expect(completedOnly.tasks).toHaveLength(0);
  });
});

describe("deciding whether to use the database at all", () => {
  it("is available once the table is there", async () => {
    store_module.resetTaskPersistenceProbe();
    expect(await store_module.taskPersistenceAvailable()).toBe(true);
  });

  it("falls back rather than failing every request when the table is missing", async () => {
    const { db } = await import("@/db");
    await db.run("ALTER TABLE a2a_tasks RENAME TO a2a_tasks_hidden");
    store_module.resetTaskPersistenceProbe();

    // Shipping this code before syncing the schema is the ordinary case, and
    // it must cost the demo its memory between instances, not its ability to
    // answer anything at all.
    expect(await store_module.taskPersistenceAvailable()).toBe(false);

    await db.run("ALTER TABLE a2a_tasks_hidden RENAME TO a2a_tasks");
    store_module.resetTaskPersistenceProbe();
  });
});
