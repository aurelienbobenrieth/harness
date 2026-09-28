import { describe, expect, it } from "vitest";
import { alchemyPinnedExact } from "./alchemy-pinned-exact.js";
import { createFixture } from "./test-support.js";

const manifest = (name: string, dependencies: Record<string, string>, field = "dependencies"): string =>
  JSON.stringify({ name, [field]: dependencies });

describe("alchemy-pinned-exact", () => {
  it("passes exact versions, direct or through default and named pnpm catalogs", async () => {
    const root = await createFixture({
      "package.json": manifest("root", { alchemy: "2.0.0-beta.79" }, "devDependencies"),
      "pnpm-workspace.yaml":
        "packages:\n  - apps/*\n  - '!apps/ignored'\ncatalog:\n  alchemy: 2.0.0-beta.79\ncatalogs:\n  infra:\n    alchemy: 2.0.0-beta.79\n",
      "apps/api/package.json": manifest("api", { alchemy: "catalog:" }),
      "apps/web/package.json": manifest("web", { alchemy: "catalog:infra" }),
      "apps/ignored/package.json": manifest("ignored", { alchemy: "^2.0.0-beta.1" }),
      "apps/alias/package.json": manifest("alias", { alchemy: "npm:alchemy@=2.0.0-beta.79" }),
    });
    expect(await alchemyPinnedExact.run({ root })).toEqual([]);
  });

  it("fails ranges on the beta line, in a manifest or in the catalog it resolves to", async () => {
    const root = await createFixture({
      "package.json": manifest("root", { alchemy: "^2.0.0-beta.79" }),
      "pnpm-workspace.yaml": "packages: [apps/*]\ncatalog:\n  alchemy: ~2.0.0-beta.79\n",
      "apps/api/package.json": manifest("api", { alchemy: "catalog:" }, "optionalDependencies"),
      "apps/web/package.json": manifest("web", { alchemy: "latest" }, "devDependencies"),
    });
    const findings = await alchemyPinnedExact.run({ root });
    expect(findings).toHaveLength(3);
    expect(findings.every((finding) => finding.severity === "error")).toBe(true);
    expect(findings.map((finding) => finding.path)).toEqual([
      "package.json",
      "apps/api/package.json",
      "apps/web/package.json",
    ]);
    expect(findings[1]?.message).toContain('pnpm-workspace.yaml catalog "default": "~2.0.0-beta.79"');
  });

  it("stays silent on a range of a stable 1.0+ line, and reads npm/yarn workspaces", async () => {
    const root = await createFixture({
      "package.json": JSON.stringify({ name: "root", workspaces: { packages: ["packages/*"] } }),
      "packages/infra/package.json": manifest("infra", { alchemy: "^3.1.0" }),
    });
    expect(await alchemyPinnedExact.run({ root })).toEqual([]);
  });

  it("reports missing catalogs and entries as failed, unknown protocols as unsupported", async () => {
    const root = await createFixture({
      "package.json": JSON.stringify({ workspaces: ["a", "b", "c", "d"] }),
      "pnpm-workspace.yaml": "catalogs:\n  infra: {}\n",
      "a/package.json": manifest("a", { alchemy: "catalog:infra" }),
      "b/package.json": manifest("b", { alchemy: "workspace:*" }),
      "c/package.json": "{ not json",
      "d/package.json": manifest("d", { alchemy: "catalog:missing" }),
    });
    const findings = await alchemyPinnedExact.run({ root });
    expect(findings.map((finding) => [finding.path, finding.evaluation])).toEqual([
      ["c/package.json", "failed"],
      ["a/package.json", "failed"],
      ["b/package.json", "unsupported"],
      ["d/package.json", "failed"],
    ]);
    const noWorkspace = await createFixture({ "package.json": manifest("x", { alchemy: "catalog:" }) });
    expect(await alchemyPinnedExact.run({ root: noWorkspace })).toMatchObject([{ evaluation: "failed" }]);
    const broken = await createFixture({
      "package.json": manifest("x", { alchemy: "catalog:" }),
      "pnpm-workspace.yaml": "a: [",
    });
    expect((await alchemyPinnedExact.run({ root: broken }))[0]?.message).toContain("not valid YAML");
  });

  it("fails when no manifest declares alchemy", async () => {
    const root = await createFixture({ "package.json": manifest("x", { effect: "4.0.0" }) });
    expect(await alchemyPinnedExact.run({ root })).toMatchObject([{ severity: "error", evaluation: "failed" }]);
  });
});
