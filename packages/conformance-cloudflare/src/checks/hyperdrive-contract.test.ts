import { describe, expect, it } from "vitest";
import { hyperdriveContract } from "./hyperdrive-contract.js";
import { createFixture, wrangler } from "./test-support.js";

const binding = { binding: "HYPERDRIVE", id: "h" };
const current = { compatibility_date: "2026-09-01" };

function pkg(dependencies: Record<string, string>, devDependencies: Record<string, string> = {}): string {
  return JSON.stringify({ name: "worker", dependencies, devDependencies });
}

function installed(name: string, version: string): Record<string, string> {
  return { [`node_modules/${name}/package.json`]: JSON.stringify({ name, version }) };
}

async function run(files: Record<string, string>) {
  return hyperdriveContract.run({ root: await createFixture(files) });
}

describe("hyperdrive-contract", () => {
  it("passes a Worker without database drivers", async () => {
    expect(await run({ "wrangler.jsonc": wrangler(current), "package.json": pkg({ hono: "^4.0.0" }) })).toEqual([]);
  });

  it("passes supported drivers behind a binding, preferring the installed version over the range", async () => {
    expect(
      await run({
        "wrangler.jsonc": wrangler({ ...current, hyperdrive: [binding] }),
        "package.json": pkg({ pg: "^8.0.0" }, { mysql2: "3.13.0" }),
        ...installed("pg", "8.16.3"),
      }),
    ).toEqual([]);
  });

  it("fails a driver without a Hyperdrive binding", async () => {
    const findings = await run({ "wrangler.jsonc": wrangler(current), "package.json": pkg({ postgres: "3.4.5" }) });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("declares no hyperdrive binding");
  });

  it("accepts a binding declared only in an environment", async () => {
    const files = {
      "wrangler.jsonc": wrangler({ ...current, env: { production: { hyperdrive: [binding] } } }),
      "package.json": pkg({ postgres: "^3.4.7" }),
    };
    expect(await run(files)).toEqual([]);
  });

  it("fails drivers below Hyperdrive's minimum, from the install or the declared range", async () => {
    const findings = await run({
      "wrangler.jsonc": wrangler({ ...current, hyperdrive: [binding] }),
      "package.json": pkg({ pg: "^8.20.0", mysql2: "~3.12.9" }),
      ...installed("pg", "8.16.2"),
    });
    expect(findings.map((finding) => finding.message.split(" is below")[0])).toEqual([
      "pg 8.16.2",
      "mysql2 range ~3.12.9",
    ]);
  });

  it("reports an unverifiable driver version as unsupported evidence", async () => {
    const findings = await run({
      "wrangler.jsonc": wrangler({ ...current, hyperdrive: [binding] }),
      "package.json": pkg({ pg: "catalog:" }),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: "warning", evaluation: "unsupported" });
  });

  it("fails a driver when Node.js compatibility is off", async () => {
    const findings = await run({
      "wrangler.jsonc": wrangler({ compatibility_date: "2026-06-01", hyperdrive: [binding] }),
      "package.json": pkg({ pg: "8.16.3" }),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("need Node.js compatibility");
    const optedOut = await run({
      "wrangler.jsonc": wrangler({ ...current, compatibility_flags: ["no_nodejs_compat"], hyperdrive: [binding] }),
      "package.json": pkg({ pg: "8.16.3" }),
    });
    expect(optedOut).toHaveLength(1);
  });

  it("fails a committed remote password and warns about a loopback one", async () => {
    const findings = await run({
      "wrangler.jsonc": wrangler({
        ...current,
        hyperdrive: [{ ...binding, localConnectionString: "postgres://app:s3cret@db.example.com:5432/app" }],
        env: {
          dev: { hyperdrive: [{ binding: "LOCAL", id: "l", localConnectionString: "postgres://u:p@localhost/app" }] },
          ci: { hyperdrive: [{ binding: "CI", id: "c", localConnectionString: "postgres://u@localhost/app" }] },
        },
      }),
      "package.json": pkg({}),
    });
    expect(findings.map((finding) => [finding.severity, finding.message.split(" commits")[0]])).toEqual([
      ["error", "top level: hyperdrive binding HYPERDRIVE"],
      ["warning", "env.dev: hyperdrive binding LOCAL"],
    ]);
    expect(findings[0]?.message).not.toContain("s3cret");
  });

  it("fails the PlanetScale serverless driver next to a Hyperdrive binding", async () => {
    const findings = await run({
      "wrangler.jsonc": wrangler({ ...current, hyperdrive: [binding] }),
      "package.json": pkg({ "@planetscale/database": "^1.19.0" }),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("@planetscale/database");
    expect(
      await run({ "wrangler.jsonc": wrangler(current), "package.json": pkg({ "@planetscale/database": "^1.19.0" }) }),
    ).toEqual([]);
  });

  it("reports a missing package.json as unsupported evidence", async () => {
    const findings = await run({ "wrangler.jsonc": wrangler(current) });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.evaluation).toBe("unsupported");
  });
});
