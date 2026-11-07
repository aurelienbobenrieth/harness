import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { defineRule } from "@aurelienbbn/agentlint";
import { testRuleFixtures, testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { transactionCallsOf, type OpenerNames } from "./openers.js";
import { diskRepo, memoryRepo, parseTree, programOf } from "./program.js";
import { digestOf, reachNetwork } from "./reach.js";
import { defineTransactionNoNetwork, transactionNoNetwork, type TransactionNoNetworkOptions } from "./rule.js";

type Files = Readonly<Record<string, string>>;

/** Whether the rule reports on the last file of `files`, the other files being the checkout it reads. */
async function fires(files: Files, options?: TransactionNoNetworkOptions): Promise<boolean> {
  const rule = defineTransactionNoNetwork(options);
  const probe = defineRule({
    ...rule,
    detector: { ...rule.detector, fixtures: { mustReport: [{ files }] } },
  });
  return (await testRuleFixtures(probe)).failures.length === 0;
}

const service = (name: string): string =>
  `import * as Context from "effect/Context";\nexport class ${name} extends Context.Service<${name}, { run: () => unknown }>()("${name}") {}\n`;

const none: OpenerNames = { curried: [], direct: [] };

const reach = (
  files: Files,
  file: string,
  names: OpenerNames = none,
  sinks = { modules: [] as string[], services: [] as string[] },
) => {
  const program = programOf(memoryRepo(files));
  const tree = parseTree(file, files[file] ?? "");
  return transactionCallsOf(tree, names).map((call) => reachNetwork({ file, program, sinks, start: call.inside }));
};

it("reports a global fetch inside sql.withTransaction", async () => {
  const [finding] = await testRuleOnSource({
    rule: transactionNoNetwork,
    source: 'export const place = (sql) => sql.withTransaction(fetch("https://example.com"));\n',
    file: "src/place.ts",
  });
  expect(finding?.message).toBe(
    "This transaction (withTransaction(…)) waits on the network: global fetch. Make the call before the transaction opens or after it commits.",
  );
});

it("reports Drizzle, Knex and Prisma callbacks that call the network", async () => {
  const openers = ["db.transaction", "knex.transaction", "prisma.$transaction"];
  const results = await Promise.all(
    openers.map((opener) =>
      fires({
        "src/z.ts": `export const a = () => ${opener}(async (tx) => { await tx.insert(); await fetch(url); });\n`,
      }),
    ),
  );
  expect(results).toEqual([true, true, true]);
  expect(
    await fires({
      "src/z.ts": "export const a = (db) => db.transaction().execute(async (trx) => { await fetch(url); });\n",
    }),
  ).toBe(true);
});

it("stays silent when the network call comes after the transaction", async () => {
  expect(
    await fires({
      "src/z.ts": "export const a = (sql) => sql.withTransaction(save()).pipe(() => fetch(url));\n",
    }),
  ).toBe(false);
  expect(
    await fires({
      "src/z.ts":
        "export const a = async (db) => { await db.transaction(async (tx) => { await tx.insert(); }); await fetch(url); };\n",
    }),
  ).toBe(false);
});

it("reports the steps piped into the opener, not only its subject", async () => {
  expect(
    await fires({
      "src/z.ts": "export const a = (sql) => save().pipe(Effect.tap(() => fetch(url)), sql.withTransaction);\n",
    }),
  ).toBe(true);
  expect(
    await fires({
      "src/z.ts": "export const a = (sql) => save().pipe(sql.withTransaction, Effect.tap(() => fetch(url)));\n",
    }),
  ).toBe(false);
});

it("does not treat a transaction method without a function as an opener", async () => {
  expect(await fires({ "src/z.ts": "export const a = (db) => db.transaction(fetch(url));\n" })).toBe(false);
  expect(await fires({ "src/z.ts": "export const a = () => transaction.begin(fetch(url));\n" })).toBe(false);
});

it("follows a helper in another file to fetch", async () => {
  expect(
    await fires({
      "src/http.ts": "export const post = (url) => fetch(url);\n",
      "src/warehouse.ts": 'import { post } from "./http.ts";\nexport const notify = () => post("u");\n',
      "src/z.ts":
        'import { notify } from "./warehouse.ts";\nexport const a = (sql) => sql.withTransaction(notify());\n',
    }),
  ).toBe(true);
});

it("follows js-suffixed imports, index files and re-exports", async () => {
  const files = {
    "src/client/impl.ts": "export const post = () => fetch(url);\n",
    "src/client/index.ts": 'export * from "./impl.js";\n',
    "src/z.ts": 'import { post } from "./client/index.js";\nexport const a = (sql) => sql.withTransaction(post());\n',
  };
  expect(await fires(files)).toBe(true);
  expect(
    await fires({
      "src/client/impl.ts": "export const post = () => 1;\n",
      "src/client/index.ts": 'export * from "./impl.js";\n',
      "src/z.ts": files["src/z.ts"],
    }),
  ).toBe(false);
});

it("follows a namespace import to the member it uses", async () => {
  const send = "export const send = () => fetch(url);\nexport const log = () => 1;\n";
  expect(
    await fires({
      "src/mail.ts": send,
      "src/z.ts": 'import * as Mail from "./mail.ts";\nexport const a = (sql) => sql.withTransaction(Mail.send());\n',
    }),
  ).toBe(true);
  expect(
    await fires({
      "src/mail.ts": send,
      "src/z.ts": 'import * as Mail from "./mail.ts";\nexport const a = (sql) => sql.withTransaction(Mail.log());\n',
    }),
  ).toBe(false);
});

it("ignores network calls that are only types or only mentioned in strings and comments", async () => {
  expect(
    await fires({
      "src/z.ts": [
        'import type { HttpClient } from "effect/unstable/http/HttpClient";',
        "// fetch(url) happens later",
        "export const a = (sql, client: HttpClient) => sql.withTransaction(save('fetch(url)') as Effect<HttpClient>);",
        "",
      ].join("\n"),
    }),
  ).toBe(false);
});

it("treats a locally declared or imported fetch as not the global", async () => {
  expect(
    await fires({
      "src/z.ts": "const fetch = () => 1;\nexport const a = (sql) => sql.withTransaction(fetch());\n",
    }),
  ).toBe(false);
});

it("reports an Effect HttpClient and the usual HTTP libraries, not their types", async () => {
  expect(
    await fires({
      "src/z.ts":
        'import { HttpClient } from "effect/unstable/http";\nexport const a = (sql) => sql.withTransaction(HttpClient.get(url));\n',
    }),
  ).toBe(true);
  expect(
    await fires({
      "src/z.ts": 'import axios from "axios";\nexport const a = (sql) => sql.withTransaction(axios.get(url));\n',
    }),
  ).toBe(true);
  expect(
    await fires({
      "src/z.ts":
        'import { Schema } from "effect/unstable/http";\nexport const a = (sql) => sql.withTransaction(Schema.decode(x));\n',
    }),
  ).toBe(false);
});

it("infers a network service from a layer that calls the network", async () => {
  const calls = {
    "src/mail/service.ts": service("Mailer"),
    "src/orders/z.ts":
      'import { Mailer } from "../mail/service.ts";\nexport const a = (sql) => sql.withTransaction(Mailer.use((m) => m.run()));\n',
  };
  expect(
    await fires({
      "src/mail/live.ts":
        'import * as Layer from "effect/Layer";\nimport { Mailer } from "./service.ts";\nexport const Live = Layer.succeed(Mailer, { run: () => fetch(url) });\n',
      ...calls,
    }),
  ).toBe(true);
  expect(
    await fires({
      "src/mail/memory.ts":
        'import * as Layer from "effect/Layer";\nimport { Mailer } from "./service.ts";\nexport const Memory = Layer.succeed(Mailer, { run: () => undefined });\n',
      ...calls,
    }),
  ).toBe(false);
});

it("infers a network service from a layer that uses an HttpClient and is built through helpers", async () => {
  expect(
    await fires({
      "src/mail/service.ts": service("Mailer"),
      "src/mail/make.ts":
        'import { HttpClient } from "effect/unstable/http";\nexport const make = () => HttpClient.HttpClient;\n',
      "src/mail/live.ts":
        'import * as Layer from "effect/Layer";\nimport * as Effect from "effect/Effect";\nimport { Mailer } from "./service.ts";\nimport { make } from "./make.ts";\nexport const Live = Layer.effect(Mailer, Effect.sync(() => make()));\n',
      "src/orders/z.ts":
        'import { Mailer } from "../mail/service.ts";\nexport const a = (sql) => sql.withTransaction(Mailer.use((m) => m.run()));\n',
    }),
  ).toBe(true);
});

it("does not take a layer of a different service of the same name as a provider", async () => {
  expect(
    await fires({
      "src/mail/service.ts": service("Mailer"),
      "src/other/service.ts": service("Mailer"),
      "src/other/live.ts":
        'import * as Layer from "effect/Layer";\nimport { Mailer } from "./service.ts";\nexport const Live = Layer.succeed(Mailer, { run: () => fetch(url) });\n',
      "src/orders/z.ts":
        'import { Mailer } from "../mail/service.ts";\nexport const a = (sql) => sql.withTransaction(Mailer.use((m) => m.run()));\n',
    }),
  ).toBe(false);
});

it("stays inside the workspace member and ignores test code", async () => {
  expect(
    await fires({
      "packages/a/package.json": "{}",
      "packages/b/package.json": "{}",
      "packages/b/src/post.ts": "export const post = () => fetch(url);\n",
      "packages/a/src/a.ts":
        'import { post } from "../../b/src/post.ts";\nexport const a = (sql) => sql.withTransaction(post());\n',
    }),
  ).toBe(false);
  expect(
    await fires({
      "src/testing.ts": "export const post = () => fetch(url);\n",
      "src/z.ts": 'import { post } from "./testing.ts";\nexport const a = (sql) => sql.withTransaction(post());\n',
    }),
  ).toBe(false);
});

it("is configured with project openers and network names", async () => {
  const files = {
    "src/z.ts": "export const a = (ledger) => ledger.inTenant(id)(Slack.use((s) => s.post()));\n",
  };
  expect(await fires(files)).toBe(false);
  expect(await fires(files, { curriedOpeners: ["inTenant"] })).toBe(false);
  expect(await fires(files, { curriedOpeners: ["inTenant"], networkServices: ["Slack"] })).toBe(true);
  expect(
    await fires(
      { "src/z.ts": "export const a = (t) => t.atomically(Mailer.send());\n" },
      { networkServices: ["Mailer"], openers: ["atomically"] },
    ),
  ).toBe(true);
  expect(
    await fires(
      { "src/z.ts": 'import { send } from "@acme/mail";\nexport const a = (sql) => sql.withTransaction(send());\n' },
      { networkModules: ["@acme/mail"] },
    ),
  ).toBe(true);
  expect(
    await fires(
      {
        "src/clients/post.ts": "export const post = () => 1;\n",
        "src/z.ts":
          'import { post } from "./clients/post.ts";\nexport const a = (sql) => sql.withTransaction(post());\n',
      },
      { networkModules: ["src/clients"] },
    ),
  ).toBe(true);
});

it("reads curried openers piped into an effect", async () => {
  expect(
    await fires(
      { "src/z.ts": "export const a = (ledger) => work().pipe(Effect.tap(() => fetch(u)), ledger.inTenant(id));\n" },
      { curriedOpeners: ["inTenant"] },
    ),
  ).toBe(true);
});

it("reads files from disk and reopens when a reached declaration changes", () => {
  const root = mkdtempSync(join(tmpdir(), "tx-no-network-"));
  const write = (file: string, text: string) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  };
  try {
    write("package.json", "{}");
    write("src/post.ts", "export const post = () => fetch(url);\n");
    write("src/z.ts", 'import { post } from "./post.ts";\nexport const a = (sql) => sql.withTransaction(post());\n');
    const run = () => {
      const program = programOf(diskRepo(root));
      const tree = parseTree("src/z.ts", program.repo.read("src/z.ts") ?? "");
      const [call] = transactionCallsOf(tree, none);
      const sinks = reachNetwork({
        file: "src/z.ts",
        program,
        sinks: { modules: [], services: [] },
        start: call?.inside ?? [],
      });
      return { digest: sinks[0]?.path.map((step) => digestOf(program, step)).join(), sinks };
    };
    const before = run();
    expect(before.sinks.map((sink) => sink.kind)).toEqual(["fetch"]);
    write("src/post.ts", "export const post = () => fetch(url, { method: 'POST' });\n");
    const after = run();
    expect(after.sinks).toHaveLength(1);
    expect(after.digest).not.toEqual(before.digest);
    write("src/post.ts", "export const post = () => 1;\n");
    expect(run().sinks).toEqual([]);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

it("names the declarations a transaction reaches the network through", () => {
  const [sinks] = reach(
    {
      "src/warehouse.ts": "export const notify = () => fetch(url);\n",
      "src/z.ts":
        'import { notify } from "./warehouse.ts";\nexport const a = (sql) => sql.withTransaction(notify());\n',
    },
    "src/z.ts",
  );
  expect(sinks?.map((sink) => sink.path.map((step) => step.name))).toEqual([["notify"]]);
});

it("is bounded on cyclic and self-referencing modules", () => {
  const [sinks] = reach(
    {
      "src/b.ts": 'import { a } from "./a.ts";\nexport const b = () => a();\n',
      "src/z.ts":
        'import { b } from "./b.ts";\nexport const a = (sql) => sql.withTransaction(b());\nexport const loop = () => loop();\n',
    },
    "src/z.ts",
  );
  expect(sinks).toEqual([]);
});
