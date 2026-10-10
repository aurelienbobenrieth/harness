import { describe, expect, it } from "vitest";
import { boundaryViolation, matchesDirectory, type Member } from "./boundaries.ts";

const open = (key: string) => ({ key, open: true });

const members: readonly Member[] = [
  { dir: "apps/web", name: "@fixture/web", kind: "app", exports: [open(".")] },
  { dir: "apps/server", name: "@fixture/server", kind: "app", exports: [open(".")] },
  {
    dir: "packages/ui",
    name: "@fixture/ui",
    kind: "package",
    exports: [open("."), open("./components/*"), { key: "./components/internal/*", open: false }],
  },
  { dir: "packages/kernel", name: "@fixture/kernel", kind: "package", exports: [open(".")] },
  { dir: "packages/adapters/storage", name: "@fixture/storage", kind: "package", exports: [open(".")] },
  { dir: "packages/features/mage", name: "@fixture/mage", kind: "package", exports: [open("."), open("./sim")] },
  { dir: "packages/features/ranger", name: "@fixture/ranger", kind: "package", exports: [open(".")] },
];

describe("packages never import apps", () => {
  it("reports a package importing an app by name", () => {
    expect(boundaryViolation({ members, importer: "packages/ui/src/button.ts", specifier: "@fixture/web" })).toBe(
      'Packages never import apps: @fixture/ui imports @fixture/web ("@fixture/web"). Move the shared code into a package both can import.',
    );
  });

  it("reports a package importing an app by relative path", () => {
    expect(
      boundaryViolation({
        members,
        importer: "packages/ui/src/button.ts",
        specifier: "../../../apps/web/src/theme.ts",
      }),
    ).toMatch(/^Packages never import apps: @fixture\/ui imports @fixture\/web/u);
  });

  it("accepts an app importing another app through its exports", () => {
    expect(
      boundaryViolation({ members, importer: "apps/web/src/main.ts", specifier: "@fixture/server" }),
    ).toBeUndefined();
  });
});

describe("members enter each other only through exports", () => {
  it.each(["@fixture/ui", "@fixture/ui/components/button", "@fixture/mage/sim"])("accepts %s", (specifier) => {
    expect(boundaryViolation({ members, importer: "apps/web/src/main.ts", specifier })).toBeUndefined();
  });

  it("reports a deep import into package internals", () => {
    expect(
      boundaryViolation({ members, importer: "apps/web/src/main.ts", specifier: "@fixture/ui/src/button.ts" }),
    ).toBe(
      '"@fixture/ui/src/button.ts" is not opened by the package.json exports of @fixture/ui: import one of its exports, or export this subpath from @fixture/ui.',
    );
  });

  it("reports a subpath a more specific null key closes", () => {
    expect(
      boundaryViolation({ members, importer: "apps/web/src/main.ts", specifier: "@fixture/ui/components/internal/x" }),
    ).toMatch(/is not opened by the package\.json exports of @fixture\/ui/u);
  });

  it("reports an unexported facet of a vertical package", () => {
    expect(boundaryViolation({ members, importer: "apps/web/src/main.ts", specifier: "@fixture/ranger/sim" })).toMatch(
      /is not opened/u,
    );
  });
});

describe("members never reach each other by relative path", () => {
  it("reports a package reaching into a sibling", () => {
    expect(
      boundaryViolation({ members, importer: "packages/kernel/src/tick.ts", specifier: "../../ui/src/internal.ts" }),
    ).toBe(
      '@fixture/kernel reaches into @fixture/ui by a relative path: import "@fixture/ui" through its package.json exports.',
    );
  });

  it("reports an app reaching into a package", () => {
    expect(
      boundaryViolation({
        members,
        importer: "apps/web/src/main.ts",
        specifier: "../../../packages/kernel/src/index.ts",
      }),
    ).toMatch(/^@fixture\/web reaches into @fixture\/kernel by a relative path/u);
  });
});

describe("the forbidden-import matrix", () => {
  const forbidden = [
    { from: "packages/features/*", to: "packages/features/*", message: "features meet only through the kernel" },
    { from: "packages/kernel", to: "packages/adapters/**" },
  ];

  it("reports one vertical package importing another, with the configured reason", () => {
    expect(
      boundaryViolation({
        members,
        forbidden,
        importer: "packages/features/mage/src/bolt.ts",
        specifier: "@fixture/ranger",
      }),
    ).toBe('@fixture/mage must not import @fixture/ranger ("@fixture/ranger"): features meet only through the kernel.');
  });

  it("reports the kernel importing an adapter, with the default reason", () => {
    expect(
      boundaryViolation({ members, forbidden, importer: "packages/kernel/src/tick.ts", specifier: "@fixture/storage" }),
    ).toBe(
      '@fixture/kernel must not import @fixture/storage ("@fixture/storage"): members under "packages/kernel" never import members under "packages/adapters/**".',
    );
  });

  it("reports a forbidden edge before the relative-path breach it also is", () => {
    expect(
      boundaryViolation({
        members,
        forbidden,
        importer: "packages/features/mage/src/bolt.ts",
        specifier: "../../ranger/src/arrow.ts",
      }),
    ).toMatch(/^@fixture\/mage must not import @fixture\/ranger/u);
  });

  it("accepts the reverse of a forbidden edge", () => {
    expect(
      boundaryViolation({
        members,
        forbidden,
        importer: "packages/adapters/storage/src/a.ts",
        specifier: "@fixture/kernel",
      }),
    ).toBeUndefined();
  });

  it("never judges a member against itself", () => {
    expect(
      boundaryViolation({
        members,
        forbidden,
        importer: "packages/features/mage/src/bolt.ts",
        specifier: "../sim/index.ts",
      }),
    ).toBeUndefined();
  });
});

describe("imports no boundary covers", () => {
  it.each([
    { label: "a parent folder of the same member", importer: "packages/ui/src/a/b.ts", specifier: "../c.ts" },
    { label: "a third-party subpath", importer: "packages/ui/src/a.ts", specifier: "effect/Effect" },
    { label: "a scoped third-party package", importer: "packages/ui/src/a.ts", specifier: "@types/node" },
    { label: "a node builtin", importer: "packages/ui/src/a.ts", specifier: "node:fs" },
    { label: "a subpath import", importer: "packages/ui/src/a.ts", specifier: "#internal/a" },
    { label: "a root file outside every member", importer: "vite.config.ts", specifier: "./apps/web/src/main.ts" },
    { label: "a relative path above the workspace root", importer: "packages/ui/a.ts", specifier: "../../../../x.ts" },
  ])("accepts $label", ({ importer, specifier }) => {
    expect(boundaryViolation({ members, importer, specifier })).toBeUndefined();
  });
});

describe("directory patterns", () => {
  it.each([
    ["apps/**", "apps/web", true],
    ["apps/**", "apps/tools/cli", true],
    ["apps/**", "packages/web", false],
    ["packages/*", "packages/ui", true],
    ["packages/*", "packages/features/mage", false],
    ["packages/features/class-*", "packages/features/class-mage", true],
    ["packages/features/class-*", "packages/features/map-arena", false],
    ["**/adapters/*", "packages/adapters/storage", true],
    ["./packages/kernel/", "packages/kernel", true],
  ] as const)("%s against %s is %s", (pattern, directory, expected) => {
    expect(matchesDirectory(pattern, directory)).toBe(expected);
  });
});
