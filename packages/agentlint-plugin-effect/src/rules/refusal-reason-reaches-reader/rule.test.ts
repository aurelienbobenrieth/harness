import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { testRuleOnSources } from "@aurelienbbn/agentlint/testing";
import { describe, expect, it } from "vitest";
import { diskRepo, memoryRepo } from "../transaction-no-network/program.js";
import { refusalReasonReachesReader } from "./rule.js";
import { wireOf } from "./wire.js";

const refused = (name: string, fields = 'reason: Schema.Literals(["inactive"])', body = ""): string =>
  `export class ${name} extends Schema.TaggedError<${name}>()("${name}", { ${fields} }) {${body}}\n`;

const rpc = (...errors: readonly string[]): string =>
  `export const go = Rpc.make("go", { error: Schema.Union([${errors.join(", ")}]) });\n`;

/** A client that reads `Other`, so the checkout does hold a client. */
const client = "export const a = (e) => Schema.is(Other)(e);\n";
const other = refused("Other");

const reported = async (files: Readonly<Record<string, string>>): Promise<readonly string[]> => {
  const sources = Object.entries(files);
  const findings = await testRuleOnSources({ rule: refusalReasonReachesReader, sources });
  return findings.map((finding) => finding.message.split(" ")[0] ?? "");
};

describe("reports", () => {
  it("an RPC error whose reason nothing reads", async () => {
    expect(
      await reported({ "app/page.tsx": client, "api/rpcs.ts": other + refused("Lost") + rpc("Other", "Lost") }),
    ).toEqual(["Lost"]);
  });

  it("an HTTP API error", async () => {
    const api = `${other}${refused("Lost")}${rpc("Other")}export const e = HttpApiEndpoint.get("x", "/x").addError(Lost);\n`;
    expect(await reported({ "app/page.tsx": client, "api/rpcs.ts": api })).toEqual(["Lost"]);
  });

  it("a Data.TaggedError", async () => {
    const lost = 'export class Lost extends Data.TaggedError("Lost")<{ reason: string }> {}\n';
    expect(await reported({ "app/page.tsx": client, "api/rpcs.ts": other + lost + rpc("Other", "Lost") })).toEqual([
      "Lost",
    ]);
  });

  it("an error only a test reads", async () => {
    const test = "expect(Schema.is(Lost)(error)).toBe(true);\n";
    const files = {
      "app/page.tsx": client,
      "app/page.test.tsx": test,
      "api/rpcs.ts": other + refused("Lost") + rpc("Other", "Lost"),
    };
    expect(await reported(files)).toEqual(["Lost"]);
  });

  it("names the error and the way out", async () => {
    const sources = Object.entries({
      "app/page.tsx": client,
      "api/rpcs.ts": other + refused("Lost") + rpc("Other", "Lost"),
    });
    const [finding] = await testRuleOnSources({ rule: refusalReasonReachesReader, sources });
    expect(finding?.message).toContain("Give each reason they can act on its own text, or stop sending it.");
  });
});

describe("stays silent", () => {
  it.each([
    ["Schema.is", "export const r = (e) => Schema.is(Lost)(e);\n"],
    ["a reason map", 'const r: Record<Lost["reason"], string> = {};\n'],
    ["instanceof", "export const r = (e) => e instanceof Lost;\n"],
    ["a written tag", 'export const r = (e) => e._tag === "Lost";\n'],
    ["a handler key", "export const r = Effect.catchTags({ Lost: (e) => show(e.reason) });\n"],
  ])("for a client reading it through %s", async (_label, reader) => {
    const files = { "app/page.tsx": client + reader, "api/rpcs.ts": other + refused("Lost") + rpc("Other", "Lost") };
    expect(await reported(files)).toEqual([]);
  });

  it("for an error that never leaves the program", async () => {
    expect(await reported({ "app/page.tsx": client, "api/rpcs.ts": other + refused("Local") + rpc("Other") })).toEqual(
      [],
    );
  });

  it("for an error without a reason", async () => {
    const quiet = refused("Quiet", "id: Schema.String");
    expect(await reported({ "app/page.tsx": client, "api/rpcs.ts": other + quiet + rpc("Other", "Quiet") })).toEqual(
      [],
    );
  });

  it("for an error that sends its own message", async () => {
    const speaks = refused("Speaks", "reason: Schema.String, message: Schema.String");
    expect(await reported({ "app/page.tsx": client, "api/rpcs.ts": other + speaks + rpc("Other", "Speaks") })).toEqual(
      [],
    );
  });

  it("for an error whose class writes the message from its reason", async () => {
    const speaks = refused("Speaks", "reason: Schema.String", ' get message() { return "no"; } ');
    expect(await reported({ "app/page.tsx": client, "api/rpcs.ts": other + speaks + rpc("Other", "Speaks") })).toEqual(
      [],
    );
  });

  it("for a checkout with no client", async () => {
    expect(await reported({ "api/rpcs.ts": refused("Lost") + rpc("Lost") })).toEqual([]);
  });
});

describe("wireOf", () => {
  it("does not count the declaring file as a reader", () => {
    const wire = wireOf(memoryRepo({ "api/rpcs.ts": refused("Lost") + rpc("Lost") }));
    expect(wire.errors.has("Lost")).toBe(true);
    expect(wire.readers.size).toBe(0);
  });

  it("ignores what a comment says", () => {
    const files = {
      "api/rpcs.ts": refused("Lost") + rpc("Lost"),
      "api/handler.ts": "/** Fails with `Lost`. */\n// `Lost`\n",
    };
    expect(wireOf(memoryRepo(files)).readers.size).toBe(0);
  });

  it("reads every member on disk and skips generated folders", () => {
    const root = mkdtempSync(join(tmpdir(), "refusal-"));
    const write = (file: string, text: string): void => {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), text);
    };
    try {
      write("api/package.json", "{}");
      write("api/rpcs.ts", refused("Lost") + refused("Read") + rpc("Lost", "Read"));
      write("app/package.json", "{}");
      write("app/page.ts", "Schema.is(Read)(e);\n");
      write("app/.bundle/out.js", 'const tag = "Lost";\n');
      expect([...wireOf(diskRepo(root)).readers.keys()]).toEqual(["Read"]);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("reads across workspace members", () => {
    const files = {
      "api/package.json": "{}",
      "api/rpcs.ts": refused("Lost") + rpc("Lost"),
      "app/package.json": "{}",
      "app/page.ts": "Schema.is(Lost)(e);\n",
    };
    expect([...(wireOf(memoryRepo(files)).readers.get("Lost") ?? [])]).toEqual(["app/page.ts"]);
  });
});
