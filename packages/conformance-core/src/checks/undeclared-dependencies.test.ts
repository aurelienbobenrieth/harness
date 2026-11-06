import { expect, it } from "vitest";
import { packageOf, undeclaredDependencies } from "./undeclared-dependencies.js";
import { createFixture } from "./test-support.js";

const manifest = (value: Record<string, unknown>): string => JSON.stringify(value);

it("fires for a member importing a package declared only at the root or in a sibling", async () => {
  const root = await createFixture({
    "package.json": manifest({ name: "root", devDependencies: { "root-only": "1" } }),
    "packages/a/package.json": manifest({ name: "@x/a" }),
    "packages/a/src/index.ts": `import "root-only";\nimport { s } from "sibling-only/sub";\nimport "root-only";`,
    "packages/b/package.json": manifest({ name: "@x/b", dependencies: { "sibling-only": "1" } }),
    "packages/b/src/index.ts": `import "sibling-only";`,
  });

  const findings = await undeclaredDependencies.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.severity).toBe("error");
  expect(findings[0]?.path).toBe("packages/a/package.json");
  expect(findings[0]?.message).toContain("root-only (packages/a/src/index.ts)");
  expect(findings[0]?.message).toContain("sibling-only (packages/a/src/index.ts)");
  expect(findings[0]?.message).toContain("Add each to this manifest");
});

it("is silent for declared packages in every dependency field, workspace deps, builtins and self-references", async () => {
  const root = await createFixture({
    "package.json": manifest({ name: "root" }),
    "packages/a/package.json": manifest({
      name: "@x/a",
      dependencies: { "@x/b": "workspace:*", prod: "1" },
      devDependencies: { dev: "1", "@scope/pkg": "1" },
      peerDependencies: { peer: "1" },
      optionalDependencies: { optional: "1" },
    }),
    "packages/a/src/index.ts": [
      `import "prod"; import "dev/sub"; import "peer"; import "optional"; import "@scope/pkg/deep";`,
      `import "@x/b"; import "@x/a/other"; import "node:fs"; import "fs/promises"; import "./local.js";`,
      `import "~/alias"; import "#internal"; import "cloudflare:workers"; import "@/alias";`,
    ].join("\n"),
    "packages/b/package.json": manifest({ name: "@x/b" }),
    "packages/b/index.ts": `export const b = 1;`,
  });

  expect(await undeclaredDependencies.run({ root })).toEqual([]);
});

it("lets non-shipping files rely on an ancestor manifest but not runtime source", async () => {
  const root = await createFixture({
    "package.json": manifest({ name: "root", devDependencies: { vitest: "1", tsdown: "1" } }),
    "packages/a/package.json": manifest({ name: "@x/a" }),
    "packages/a/src/index.ts": `import "vitest";`,
    "packages/a/src/index.test.ts": `import "vitest";`,
    "packages/a/src/mocks/x.spec.tsx": `import "vitest";`,
    "packages/a/test/helper.ts": `import "vitest";`,
    "packages/a/tsdown.config.ts": `import "tsdown";`,
    "packages/a/vitest.setup.ts": `import "vitest";`,
    "packages/a/scripts/build.mjs": `import "tsdown";`,
    "packages/a/src/scripts/runtime.ts": `import "tsdown";`,
  });

  const findings = await undeclaredDependencies.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("vitest (packages/a/src/index.ts)");
  expect(findings[0]?.message).toContain("tsdown (packages/a/src/scripts/runtime.ts)");
  expect(findings[0]?.message).toContain("2 package(s)");
});

it("still fires for a test importing a package no ancestor manifest declares", async () => {
  const root = await createFixture({
    "package.json": manifest({ name: "root" }),
    "packages/a/package.json": manifest({ name: "@x/a" }),
    "packages/b/package.json": manifest({ name: "@x/b", devDependencies: { vitest: "1" } }),
    "packages/a/src/a.test.ts": `import "vitest";`,
  });

  const findings = await undeclaredDependencies.run({ root });
  expect(findings.map((finding) => finding.path)).toEqual(["packages/a/package.json"]);
});

it("accepts a @types package as the declaration of the package it types", async () => {
  const root = await createFixture({
    "package.json": manifest({ name: "root", devDependencies: { "@types/react": "1", "@types/scope__pkg": "1" } }),
    "src/index.ts": `import type { X } from "react";\nimport type { Y } from "@scope/pkg";`,
  });

  expect(await undeclaredDependencies.run({ root })).toEqual([]);
});

it("attributes a file to the nearest manifest, not the root", async () => {
  const root = await createFixture({
    "package.json": manifest({ name: "root", dependencies: { shared: "1" } }),
    "apps/web/package.json": manifest({ name: "web", dependencies: { own: "1" } }),
    "apps/web/src/index.ts": `import "own"; import "shared";`,
    "tools/script.mjs": `import "shared";`,
  });

  const findings = await undeclaredDependencies.run({ root });
  expect(findings.map((finding) => finding.path)).toEqual(["apps/web/package.json"]);
  expect(findings[0]?.message).toContain("shared");
});

it("skips build output, node_modules, fixtures, declaration files and marker manifests", async () => {
  const root = await createFixture({
    "package.json": manifest({ name: "root" }),
    "dist/out.js": `import "ghost";`,
    "node_modules/x/index.js": `import "ghost";`,
    "src/__fixtures__/sample.ts": `import "ghost";`,
    "src/__testfixtures__/sample.ts": `import "ghost";`,
    "src/types.d.ts": `import "ghost";`,
    "src/esm/package.json": manifest({ type: "module" }),
    "src/esm/index.ts": `import "node:path";`,
  });

  expect(await undeclaredDependencies.run({ root })).toEqual([]);
});

it("honors ignorePackages and excludePaths", async () => {
  const root = await createFixture({
    "package.json": manifest({ name: "root" }),
    "src/index.ts": `import "virtual-alias"; import "other";`,
    "generated/out.ts": `import "gen";`,
  });

  const findings = await undeclaredDependencies.run({
    root,
    undeclaredDependencies: { ignorePackages: ["virtual-alias"], excludePaths: ["generated"] },
  });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("1 package(s)");
  expect(findings[0]?.message).toContain("other");
});

it.each([
  ["effect/sql/SqlError", "effect"],
  ["@acme/jobs/adapters", "@acme/jobs"],
  ["node:path", undefined],
  ["fs/promises", undefined],
  ["cloudflare:workers", undefined],
  ["~/components/x", undefined],
  ["#internal", undefined],
  ["../x.ts", undefined],
])("reads %s as the package %s", (specifier, name) => {
  expect(packageOf(specifier)).toBe(name);
});
