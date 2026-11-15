import { describe, expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, fixCode, reportedMessages } from "../test-support.ts";

const ruleName = "core/module-boundaries";

const member = {
  "package.json": JSON.stringify({ name: "@fixture/app", imports: { "#*": "./src/*" } }),
};

const ruleOptions = {
  units: ["features/*/*", "hosting/*"],
  forbidden: [{ from: "features/**", to: "hosting/**", message: "features never know their host" }],
  private: ["_/state.ts"],
};

describe("core/module-boundaries through oxlint", () => {
  it("fixes a relative path into another unit to its # subpath, keeping quotes and queries", async () => {
    await expect(
      fixCode(
        ruleName,
        'import { order } from \'../order/view.ts\';\nexport * from "../order/raw.css?inline";\nexport const later = () => import("../order/view.ts");\nexport { order };\n',
        "fix",
        { filename: "src/features/leaks/index/view.ts", files: member, ruleOptions },
      ),
    ).resolves.toBe(
      'import { order } from \'#features/leaks/order/view.ts\';\nexport * from "#features/leaks/order/raw.css?inline";\nexport const later = () => import("#features/leaks/order/view.ts");\nexport { order };\n',
    );
  });

  it("fixes a # subpath inside the own unit to its relative path", async () => {
    await expect(
      fixCode(
        ruleName,
        'import { sections } from "#features/leaks/index/_/sections.ts?raw";\nexport { sections };\n',
        "fix",
        {
          filename: "src/features/leaks/index/view.ts",
          files: member,
          ruleOptions,
        },
      ),
    ).resolves.toBe('import { sections } from "./_/sections.ts?raw";\nexport { sections };\n');
  });

  it("treats an unmatched directory as its own unit", async () => {
    await expect(
      fixCode(ruleName, 'import { ids } from "../ids.ts";\nexport { ids };\n', "fix", {
        filename: "src/kernel/time/clock.ts",
        files: member,
        ruleOptions,
      }),
    ).resolves.toBe('import { ids } from "#kernel/ids.ts";\nexport { ids };\n');
  });

  it("reports forbidden edges and private paths without fixing them", async () => {
    const code =
      'import { store } from "#hosting/mock/store.ts";\nimport { state } from "#features/leaks/order/_/state.ts";\nexport { state, store };\n';
    const options = { filename: "src/features/leaks/index/view.ts", files: member, ruleOptions };

    await expect(reportedMessages(ruleName, code, options)).resolves.toEqual([
      'src/features/leaks/index must not import src/hosting/mock ("#hosting/mock/store.ts"): features never know their host. Move what both need where both may import it.',
      '"#features/leaks/order/_/state.ts" reaches into _/state.ts, private to src/features/leaks/order: import a module src/features/leaks/order exposes instead.',
    ]);
    await expect(fixCode(ruleName, code, "fix", options)).resolves.toBe(code);
  });

  it("exempts test files from forbidden and private unless includeTestFiles is set", async () => {
    const code = 'import { store } from "#hosting/mock/store.ts";\nexport { store };\n';
    const options = { filename: "src/features/leaks/index/view.test.ts", files: member };

    await expect(assertRuleDoesNotReport(ruleName, code, { ...options, ruleOptions })).resolves.toBeUndefined();
    await expect(
      reportedMessages(ruleName, code, { ...options, ruleOptions: { ...ruleOptions, includeTestFiles: true } }),
    ).resolves.toHaveLength(1);
  });

  it("still fixes the specifier form in test files", async () => {
    await expect(
      fixCode(ruleName, 'import { view } from "#features/leaks/index/view.ts";\nexport { view };\n', "fix", {
        filename: "src/features/leaks/index/view.test.ts",
        files: member,
        ruleOptions,
      }),
    ).resolves.toBe('import { view } from "./view.ts";\nexport { view };\n');
  });

  it("reports a relative path into another unit without a fix when no # pattern maps the source root", async () => {
    await expect(
      assertRuleReports(ruleName, 'import { order } from "../order/view.ts";\nexport { order };\n', {
        filename: "src/features/leaks/index/view.ts",
        files: { "package.json": JSON.stringify({ name: "@fixture/app" }) },
        ruleOptions,
        message: /leaves src\/features\/leaks\/index for src\/features\/leaks\/order by a relative path: map a /u,
      }),
    ).resolves.toBeUndefined();
  });

  it("stays silent outside the source root, and on files in no package", async () => {
    const code = 'import { x } from "../src/features/a/b/x.ts";\nexport { x };\n';
    await expect(
      assertRuleDoesNotReport(ruleName, code, { filename: "scripts/seed.ts", files: member, ruleOptions }),
    ).resolves.toBeUndefined();
    await expect(
      assertRuleDoesNotReport(ruleName, 'import { y } from "../c/y.ts";\nexport { y };\n', {
        filename: "src/a/b.ts",
        ruleOptions,
      }),
    ).resolves.toBeUndefined();
  });

  it("reads the source root option", async () => {
    await expect(
      fixCode(ruleName, 'import { y } from "../shared/y.ts";\nexport { y };\n', "fix", {
        filename: "lib/feature/x.ts",
        files: { "package.json": JSON.stringify({ imports: { "#lib/*": "./lib/*" } }) },
        ruleOptions: { sourceRoot: "lib" },
      }),
    ).resolves.toBe('import { y } from "#lib/shared/y.ts";\nexport { y };\n');
  });
});
