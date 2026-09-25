import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.js";

const ruleName = "alchemy/config-in-init";
const header = [
  'import * as Cloudflare from "alchemy/Cloudflare";',
  'import * as Config from "effect/Config";',
  'import * as Effect from "effect/Effect";',
  "",
].join("\n");

it("reports a Config read only inside a Worker fetch handler", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${header}export default Cloudflare.Worker(
  "Worker",
  { main: import.meta.url },
  Effect.gen(function* () {
    return {
      fetch: Effect.gen(function* () {
        const apiKey = yield* Config.Redacted("API_KEY");
        return new Response(String(apiKey));
      }),
    };
  }),
);
`,
      { message: /Config \\"API_KEY\\" is read only in the runtime half/ },
    ),
  ).resolves.toBeUndefined();
});

it("reports runtime reads in class, Tag.make, Lambda, Durable Object and Workflow forms", async () => {
  const messages = await reportedMessages(
    ruleName,
    `import * as AWS from "alchemy/AWS";
import { Worker, DurableObject, Workflows } from "alchemy/Cloudflare";
import { Config, Effect } from "effect";

export class Api extends Worker<Api>()(
  "Api",
  { main: import.meta.url },
  Effect.gen(function* () {
    return { greet: (name: string) => Config.String("GREETING").pipe(Effect.map((g) => g + name)) };
  }).pipe(Effect.provide(Layer)),
) {}

export class Jobs extends Worker<Jobs, {}>()("Jobs") {}
export const JobsLive = Jobs.make({ main: import.meta.url }, Effect.gen(function* () {
  return { fetch: Effect.flatMap(Config.Port("PORT"), () => Effect.void) };
}));

export class Fn extends AWS.Lambda.Function<Fn>()("Fn", { main: import.meta.url }, Effect.gen(function* () {
  return { fetch: Effect.gen(function* () { return yield* Config.Literal("prod", "STAGE"); }) };
})) {}

export class Counter extends DurableObject<Counter>()("Counter", Effect.gen(function* () {
  return Effect.gen(function* () {
    const limit = yield* Config.Number("LIMIT");
    return { get: () => Effect.succeed(limit) };
  });
})) {}

export class Flow extends Cloudflare.Workflow<Flow>()("Flow", Effect.gen(function* () {
  return Effect.fn(function* (input: { id: string }) {
    const url = yield* Config.URL("WEBHOOK_URL");
    return yield* Workflows.task("notify", Effect.succeed(\`\${url}\${input.id}\`));
  });
})) {}
import * as Cloudflare from "alchemy/Cloudflare";
declare const Layer: never;
`,
  );
  expect(messages.map((text) => /Config "(\w+)"/.exec(text)?.[1])).toEqual([
    "GREETING",
    "PORT",
    "STAGE",
    "LIMIT",
    "WEBHOOK_URL",
  ]);
});

it("accepts keys read in the init body, even when the handler reads them again", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${header}export default Cloudflare.Worker(
  "Worker",
  { main: import.meta.url, env: { HOST: Config.String("HOST") } },
  Effect.gen(function* () {
    const apiKey = yield* Config.Redacted("API_KEY");
    const port = yield* Config.Number("PORT").pipe(Config.withDefault(3000));
    return {
      fetch: Effect.gen(function* () {
        const again = yield* Config.Redacted("API_KEY");
        const host = yield* Config.String("HOST");
        return new Response(String([apiKey, again, port, host]));
      }),
      eager: yield* Config.String("EAGER"),
    };
  }),
);
`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores dynamic keys, Stacks, async Workers and look-alike calls outside Alchemy", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${header}import * as Alchemy from "alchemy";
declare const name: string;
declare function Worker(id: string, props: object, init: unknown): unknown;

export const Stack = Alchemy.Stack("App", {}, Effect.gen(function* () {
  return { url: Effect.map(Config.String("STACK_URL"), (value) => value) };
}));

export const Async = Cloudflare.Worker("Async", { main: "./src/worker.ts" });

export const Dynamic = Cloudflare.Worker("Dynamic", { main: import.meta.url }, Effect.gen(function* () {
  return { fetch: Effect.gen(function* () { return yield* Config.String(name); }) };
}));

export const LookAlike = Worker("Local", {}, Effect.gen(function* () {
  return { fetch: Config.String("LOCAL_ONLY") };
}));
`,
    ),
  ).resolves.toBeUndefined();
});

it("reports reads in handlers bound to a const in the init and returned by reference", async () => {
  const messages = await reportedMessages(
    ruleName,
    `${header}export default Cloudflare.Worker("Worker", { main: import.meta.url }, Effect.gen(function* () {
  const fetch = Effect.gen(function* () {
    const apiKey = yield* Config.redacted("API_KEY");
    return new Response(String(apiKey));
  });
  const greet = Effect.fn("greet")(function* (name: string) {
    return (yield* Config.String("GREETING")) + name;
  });
  return { fetch, greet: greet };
}));

export class Room extends Cloudflare.DurableObject<Room>()("Room", Effect.gen(function* () {
  const instance = Effect.gen(function* () {
    const limit = yield* Config.Number("LIMIT");
    return { get: () => Effect.succeed(limit) };
  });
  return instance;
})) {}
`,
  );
  expect(messages.map((text) => /Config "(\w+)"/.exec(text)?.[1])).toEqual(["API_KEY", "GREETING", "LIMIT"]);
});

it("accepts a const-bound handler whose key is also read in the init proper, or that the init runs itself", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${header}export default Cloudflare.Worker("Worker", { main: import.meta.url }, Effect.gen(function* () {
  const apiKey = yield* Config.Redacted("API_KEY");
  const warmup = Effect.gen(function* () {
    return yield* Config.String("WARMUP");
  });
  yield* warmup;
  const fetch = Effect.gen(function* () {
    const again = yield* Config.Redacted("API_KEY");
    return new Response(String([apiKey, again]));
  });
  return { fetch, warmup };
}));
`,
    ),
  ).resolves.toBeUndefined();
});
