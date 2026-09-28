import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.js";

const ruleName = "alchemy/workflow-io-outside-task";
const header = [
  'import * as Cloudflare from "alchemy/Cloudflare";',
  'import * as Effect from "effect/Effect";',
  "declare const KV: unknown;",
  "declare const Uploads: unknown;",
  "",
].join("\n");

it("reports a KV write made directly in the Workflow body", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${header}export default class Sync extends Cloudflare.Workflow<Sync>()(
  "Sync",
  Effect.gen(function* () {
    const kv = yield* Cloudflare.KV.ReadWriteNamespace(KV);
    return Effect.fn(function* (input: { id: string }) {
      yield* kv.put(input.id, "started");
      return yield* Cloudflare.Workflows.task("load", kv.get(input.id));
    });
  }),
) {}
`,
      { message: /`kv` is a binding, and this call sits outside a Workflow task/ },
    ),
  ).resolves.toBeUndefined();
});

it("reports binding calls in Effect.fn(name), arrow bodies and the props form", async () => {
  const messages = await reportedMessages(
    ruleName,
    `${header}import { Workflow, R2, task } from "alchemy/Cloudflare";

export class Named extends Workflow<Named>()("Named", { limits: { steps: 10 } }, Effect.gen(function* () {
  const bucket = yield* R2.ReadWriteBucket(Uploads);
  return Effect.fn("Named.run")(function* () {
    const head = yield* bucket.head("a");
    return yield* task("copy", Effect.succeed(head));
  });
})) {}

export const Arrow = Cloudflare.Workflow("Arrow", Effect.gen(function* () {
  const kv = yield* Cloudflare.KV.ReadWriteNamespace(KV);
  return (input: { id: string }) =>
    Effect.gen(function* () {
      if (input.id === "") yield* kv.delete(input.id);
    });
}));
`,
  );
  expect(messages.map((text) => /`(\w+)`/.exec(text)?.[1])).toEqual(["bucket", "kv"]);
});

it("accepts binding calls inside task, including piped and rollback forms", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${header}export default class Sync extends Cloudflare.Workflow<Sync>()(
  "Sync",
  Effect.gen(function* () {
    const kv = yield* Cloudflare.KV.ReadWriteNamespace(KV);
    return Effect.fn(function* (input: { id: string }) {
      yield* Cloudflare.Workflows.task(
        "store",
        Effect.gen(function* () {
          yield* kv.put(input.id, "v");
        }),
      );
      const value = yield* Cloudflare.Workflows.task("read", kv.get(input.id), {
        rollback: () => kv.delete(input.id),
      });
      yield* Cloudflare.task("read-again", kv.get(input.id).pipe(Effect.orDie));
      return value;
    });
  }),
) {}
`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores non-Alchemy services, Worker handlers and helper functions", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${header}declare const Notifier: Effect.Effect<{ format(id: string): string }>;

export class Flow extends Cloudflare.Workflow<Flow>()("Flow", Effect.gen(function* () {
  const notifier = yield* Notifier;
  const kv = yield* Cloudflare.KV.ReadWriteNamespace(KV);
  return Effect.fn(function* (input: { id: string }) {
    const text = notifier.format(input.id);
    const save = () => kv.put(input.id, text);
    return yield* Cloudflare.Workflows.task("save", save());
  });
})) {}

export default Cloudflare.Worker("Api", { main: import.meta.url }, Effect.gen(function* () {
  const kv = yield* Cloudflare.KV.ReadWriteNamespace(KV);
  return { fetch: Effect.fn(function* () { return yield* kv.get("k"); })() };
}));
`,
    ),
  ).resolves.toBeUndefined();
});
