import { describe, expect, it } from "vitest";
import { environmentBindingsRedeclared } from "./environment-bindings-redeclared.js";
import { createFixture, wrangler } from "./test-support.js";

async function run(config: Record<string, unknown>) {
  const root = await createFixture({ "wrangler.jsonc": wrangler(config) });
  return environmentBindingsRedeclared.run({ root });
}

const kv = [{ binding: "CACHE", id: "a" }];
const d1 = [{ binding: "DB", database_name: "app", database_id: "b" }];

describe("environment-bindings-redeclared", () => {
  it("passes when every environment redeclares each top-level binding and variable", async () => {
    expect(
      await run({
        vars: { MODE: "dev" },
        kv_namespaces: kv,
        d1_databases: d1,
        durable_objects: { bindings: [{ name: "ROOM", class_name: "Room" }] },
        observability: { enabled: true },
        env: {
          production: {
            vars: { MODE: "prod", EXTRA: "1" },
            kv_namespaces: [{ binding: "CACHE", id: "c" }],
            d1_databases: d1,
            durable_objects: { bindings: [{ name: "ROOM", class_name: "Room" }] },
          },
        },
      }),
    ).toEqual([]);
  });

  it("passes configs without environments and ignores empty top-level declarations and inheritable keys", async () => {
    expect(await run({ kv_namespaces: kv })).toEqual([]);
    expect(await run({ vars: {}, kv_namespaces: [], routes: ["a.com/*"], env: { staging: {} } })).toEqual([]);
  });

  it("fails an environment that omits a non-inheritable key, including keys only Wrangler's validator lists", async () => {
    const findings = await run({
      kv_namespaces: kv,
      hyperdrive: [{ binding: "HYPERDRIVE", id: "h" }],
      env: { staging: { kv_namespaces: kv } },
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('env.staging omits "hyperdrive"');
  });

  it("names the top-level bindings and variables an environment forgot", async () => {
    const findings = await run({
      vars: { MODE: "dev", REGION: "eu" },
      queues: { producers: [{ binding: "JOBS", queue: "jobs" }], consumers: [{ queue: "jobs" }] },
      secrets: { required: ["API_KEY"] },
      env: {
        production: {
          vars: { MODE: "prod" },
          queues: { producers: [{ binding: "JOBS", queue: "jobs-prod" }] },
          secrets: { required: [] },
        },
      },
    });
    expect(findings.map((finding) => finding.message.split(" declared")[0])).toEqual([
      "env.production.vars is missing REGION",
      "env.production.secrets is missing API_KEY",
      "env.production.queues is missing consumer jobs",
    ]);
  });

  it("reports a non-object env block as unevaluated", async () => {
    const findings = await run({ kv_namespaces: kv, env: { staging: "inherit" } });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.evaluation).toBe("failed");
  });
});
