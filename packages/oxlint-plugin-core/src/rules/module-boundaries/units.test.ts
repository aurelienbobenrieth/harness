import { describe, expect, it } from "vitest";
import { aliasesFrom, type ImportSite, moduleViolation, unitOf, type UnitPolicy } from "./units.ts";

const policy: UnitPolicy = {
  sourceRoot: "src",
  units: ["features/*/*", "connectors/*", "hosting/*"],
  forbidden: [{ from: "features/**", to: "hosting/**" }],
  private: ["_/state.ts", "_/ports/**"],
};

const aliases = aliasesFrom({ "#*": "./src/*" }, "src");

function site(importer: string, specifier: string, overrides: Partial<ImportSite> = {}): ImportSite {
  return { policy, aliases, importer, specifier, judgeDependencies: true, ...overrides };
}

describe("unitOf", () => {
  it("picks the deepest directory a unit pattern names", () => {
    expect(unitOf(policy.units, "features/leaks/index/_/state.ts")).toBe("features/leaks/index");
    expect(unitOf(policy.units, "connectors/shopify/http.ts")).toBe("connectors/shopify");
  });

  it("falls back to the file's own directory", () => {
    expect(unitOf(policy.units, "kernel/time/clock.ts")).toBe("kernel/time");
    expect(unitOf(policy.units, "features/leaks/shared.ts")).toBe("features/leaks");
    expect(unitOf(policy.units, "worker.ts")).toBe("");
  });
});

describe("aliasesFrom", () => {
  it("keeps star patterns that map onto the source root", () => {
    expect(aliasesFrom({ "#*": "./src/*", "#env": "./src/env.ts", "#lib/*": "./lib/*" }, "./src/")).toEqual([
      { keyPrefix: "#", keySuffix: "", targetPrefix: "", targetSuffix: "" },
    ]);
  });

  it("reads nested targets and ignores non-object fields", () => {
    expect(aliasesFrom({ "#features/*.ts": "./src/features/*.ts" }, "src")).toEqual([
      { keyPrefix: "#features/", keySuffix: ".ts", targetPrefix: "features/", targetSuffix: ".ts" },
    ]);
    expect(aliasesFrom(undefined, "src")).toEqual([]);
  });
});

describe("moduleViolation", () => {
  it("rewrites a relative path into another unit to its # subpath", () => {
    expect(moduleViolation(site("features/leaks/index/view.ts", "../../../connectors/shopify/http.ts"))).toEqual({
      message:
        '"../../../connectors/shopify/http.ts" leaves src/features/leaks/index for src/connectors/shopify by a relative path: import "#connectors/shopify/http.ts".',
      replacement: "#connectors/shopify/http.ts",
    });
  });

  it("rewrites a # subpath inside the importer's own unit to its relative path", () => {
    expect(moduleViolation(site("features/leaks/index/view.ts", "#features/leaks/index/_/sections.ts"))).toEqual({
      message:
        '"#features/leaks/index/_/sections.ts" stays inside src/features/leaks/index: import its relative path "./_/sections.ts".',
      replacement: "./_/sections.ts",
    });
    expect(moduleViolation(site("features/leaks/index/_/a.ts", "#features/leaks/index/b.ts"))?.replacement).toBe(
      "../b.ts",
    );
  });

  it("keeps a query suffix through both rewrites", () => {
    expect(moduleViolation(site("features/leaks/index/view.ts", "../order/x/logo.svg?url"))?.replacement).toBe(
      "#features/leaks/order/x/logo.svg?url",
    );
    expect(
      moduleViolation(site("features/leaks/index/view.ts", "#features/leaks/index/raw.css?inline"))?.replacement,
    ).toBe("./raw.css?inline");
  });

  it("stays silent on the preferred form, bare packages, and paths outside the source root", () => {
    expect(moduleViolation(site("features/leaks/index/view.ts", "./_/sections.ts"))).toBeUndefined();
    expect(moduleViolation(site("features/leaks/index/view.ts", "#connectors/shopify/http.ts"))).toBeUndefined();
    expect(moduleViolation(site("features/leaks/index/view.ts", "effect"))).toBeUndefined();
    expect(moduleViolation(site("worker.ts", "../package.json"))).toBeUndefined();
    expect(moduleViolation(site("worker.ts", "#unmapped", { aliases: [] }))).toBeUndefined();
  });

  it("judges the fallback unit like any other", () => {
    expect(moduleViolation(site("kernel/time/clock.ts", "../ids.ts"))?.replacement).toBe("#kernel/ids.ts");
    expect(moduleViolation(site("kernel/time/clock.ts", "#kernel/time/zone.ts"))?.replacement).toBe("./zone.ts");
  });

  it("reports a forbidden edge without a fix, whatever the specifier form", () => {
    const expected = {
      message:
        'src/features/leaks/index must not import src/hosting/mock ("#hosting/mock/store.ts"): files under "features/**" never import files under "hosting/**". Move what both need where both may import it.',
    };
    expect(moduleViolation(site("features/leaks/index/view.ts", "#hosting/mock/store.ts"))).toEqual(expected);
    expect(
      moduleViolation(site("features/leaks/index/view.ts", "../../../hosting/mock/store.ts"))?.replacement,
    ).toBeUndefined();
  });

  it("reports another unit's private path, and allows it inside the unit", () => {
    expect(moduleViolation(site("features/leaks/index/view.ts", "#features/leaks/order/_/ports/codes.ts"))).toEqual({
      message:
        '"#features/leaks/order/_/ports/codes.ts" reaches into _/ports/codes.ts, private to src/features/leaks/order: import a module src/features/leaks/order exposes instead.',
    });
    expect(moduleViolation(site("features/leaks/order/view.ts", "./_/state.ts"))).toBeUndefined();
    expect(moduleViolation(site("features/leaks/order/view.ts", "#features/leaks/index/events.ts"))).toBeUndefined();
  });

  it("matches private patterns with a leading star against any folder of the unit", () => {
    const starred = { ...policy, units: ["*/*"], forbidden: [], private: ["*/aggregate.ts", "*/ports/**"] };
    const judge = (importer: string, specifier: string) =>
      moduleViolation(site(importer, specifier, { policy: starred }));

    expect(judge("leaks/index/view.ts", "#protection/exposure/_/aggregate.ts")?.message).toMatch(
      /reaches into _\/aggregate\.ts, private to src\/protection\/exposure/u,
    );
    expect(judge("leaks/index/view.ts", "#protection/exposure/_/ports/store/codes.ts")?.message).toMatch(
      /reaches into _\/ports\/store\/codes\.ts/u,
    );
    expect(judge("leaks/index/view.ts", "#protection/exposure/_/events.ts")).toBeUndefined();
    expect(judge("protection/exposure/record/run.ts", "../_/aggregate.ts")).toBeUndefined();
  });

  it("skips forbidden and private edges when dependencies are not judged, but still fixes the form", () => {
    const exempt = { judgeDependencies: false };
    expect(moduleViolation(site("features/leaks/index/view.ts", "#hosting/mock/store.ts", exempt))).toBeUndefined();
    expect(
      moduleViolation(site("features/leaks/index/view.ts", "#features/leaks/order/_/state.ts", exempt)),
    ).toBeUndefined();
    expect(moduleViolation(site("features/leaks/index/view.ts", "../order/_/state.ts", exempt))?.replacement).toBe(
      "#features/leaks/order/_/state.ts",
    );
  });

  it("reports without a fix when no # pattern reaches the target", () => {
    expect(moduleViolation(site("features/leaks/index/view.ts", "../order/view.ts", { aliases: [] }))).toEqual({
      message:
        '"../order/view.ts" leaves src/features/leaks/index for src/features/leaks/order by a relative path: map a "#" subpath import onto src in package.json and import through it.',
    });
  });

  it("offers only a # subpath that resolves back to the target", () => {
    const shadowed = aliasesFrom({ "#*": "./src/*", "#kernel/*": "./src/legacy/*" }, "src");
    expect(
      moduleViolation(site("features/leaks/index/view.ts", "../../../kernel/ids.ts", { aliases: shadowed }))
        ?.replacement,
    ).toBeUndefined();
  });
});
