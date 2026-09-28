import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.js";

const ruleName = "alchemy/no-disposable-in-instance-scope";
const header = [
  'import * as Cloudflare from "alchemy/Cloudflare";',
  'import * as Effect from "effect/Effect";',
  "declare const openPool: Effect.Effect<{ end(): Promise<void> }>;",
  "",
].join("\n");

it("reports acquireRelease in a Worker init", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${header}export default Cloudflare.Worker(
  "Api",
  { main: import.meta.url },
  Effect.gen(function* () {
    const pool = yield* Effect.acquireRelease(openPool, (p) => Effect.promise(() => p.end()));
    return { fetch: Effect.succeed(pool) };
  }),
);
`,
      { message: /Effect.acquireRelease here attaches its finalizer to the Runtime's instance scope/ },
    ),
  ).resolves.toBeUndefined();
});

it("reports addFinalizer and acquireDisposable in Lambda, Tag.make and Durable Object constructors", async () => {
  const messages = await reportedMessages(
    ruleName,
    `import * as AWS from "alchemy/AWS";
import { DurableObject, Worker } from "alchemy/Cloudflare";
import { Effect } from "effect";
declare const flush: Effect.Effect<void>;
declare const socket: Effect.Effect<Disposable>;

export class Fn extends AWS.Lambda.Function<Fn>()("Fn", { main: import.meta.url }, Effect.gen(function* () {
  yield* Effect.addFinalizer(() => flush);
  return {};
})) {}

export class Api extends Worker<Api, {}>()("Api") {}
export const ApiLive = Api.make({ main: import.meta.url }, Effect.gen(function* () {
  const s = yield* socket.pipe(Effect.acquireDisposable);
  return { fetch: Effect.succeed(s) };
}).pipe(Effect.orDie));

export class Room extends DurableObject<Room>()("Room", Effect.gen(function* () {
  return Effect.gen(function* () {
    yield* Effect.addFinalizer(() => flush);
    return { get: () => Effect.void };
  });
})) {}
`,
  );
  expect(messages.map((text) => /Effect\.(\w+) here/.exec(text)?.[1])).toEqual([
    "addFinalizer",
    "acquireDisposable",
    "addFinalizer",
  ]);
});

it("accepts finalizers inside handlers, Durable Object methods and Workflow bodies", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${header}export default Cloudflare.Worker("Api", { main: import.meta.url }, Effect.gen(function* () {
  return {
    fetch: Effect.gen(function* () {
      const pool = yield* Effect.acquireRelease(openPool, (p) => Effect.promise(() => p.end()));
      yield* Effect.addFinalizer(() => Effect.void);
      return pool;
    }),
    cleanup: Effect.addFinalizer(() => Effect.void),
  };
}));

export class Room extends Cloudflare.DurableObject<Room>()("Room", Effect.gen(function* () {
  return Effect.gen(function* () {
    return { record: () => Effect.gen(function* () { yield* Effect.addFinalizer(() => Effect.void); }) };
  });
})) {}

export class Flow extends Cloudflare.Workflow<Flow>()("Flow", Effect.gen(function* () {
  return Effect.fn(function* () { yield* Effect.addFinalizer(() => Effect.void); });
})) {}
`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts Effect.scoped, acquireUseRelease, helpers and non-Runtime generators", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${header}export const makePool = Effect.acquireRelease(openPool, (p) => Effect.promise(() => p.end()));

export default Cloudflare.Worker("Api", { main: import.meta.url }, Effect.gen(function* () {
  const schema = yield* Effect.scoped(
    Effect.gen(function* () {
      const pool = yield* Effect.acquireRelease(openPool, (p) => Effect.promise(() => p.end()));
      return String(pool);
    }),
  );
  const version = yield* Effect.acquireUseRelease(openPool, () => Effect.succeed(1), (p) => Effect.promise(() => p.end()));
  const lazy = () => Effect.addFinalizer(() => Effect.void);
  return { fetch: Effect.succeed([schema, version, lazy]) };
}));

export const program = Effect.gen(function* () {
  yield* Effect.addFinalizer(() => Effect.void);
});
`,
    ),
  ).resolves.toBeUndefined();
});
