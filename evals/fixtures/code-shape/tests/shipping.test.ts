import test from "node:test";
import assert from "node:assert/strict";
import { Effect } from "effect";
import { api } from "../src/api.ts";
import { memoryStore } from "../src/memory-store.ts";
test("shipping returns tracking and persists shipped state", async () => {
  const store = memoryStore([{ id: "o1", customerId: "c1", status: "open", lines: [] }]);
  const service = api(store, { createLabel: () => Effect.succeed({ tracking: "t1" }) });
  assert.deepEqual(await Effect.runPromise(service.ship("o1")), { tracking: "t1" });
  assert.equal((await Effect.runPromise(store.get("o1")))?.status, "shipped");
});
