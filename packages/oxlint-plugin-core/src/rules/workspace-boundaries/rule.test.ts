import { describe, expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.ts";

const ruleName = "core/workspace-boundaries";

const workspace = {
  "pnpm-workspace.yaml": "packages:\n  - apps/*\n  - packages/*\n  - packages/features/*\n",
  "apps/web/package.json": JSON.stringify({ name: "@fixture/web" }),
  "apps/web/src/main.ts": "export const web = 1;\n",
  "packages/kernel/package.json": JSON.stringify({ name: "@fixture/kernel", exports: { ".": "./src/index.ts" } }),
  "packages/kernel/src/index.ts": "export const kernel = 1;\n",
  "packages/features/mage/package.json": JSON.stringify({ name: "@fixture/mage" }),
  "packages/features/ranger/package.json": JSON.stringify({ name: "@fixture/ranger" }),
  "packages/features/ranger/src/index.ts": "export const ranger = 1;\n",
};

describe("core/workspace-boundaries through oxlint", () => {
  it("stays silent on an app importing a package through its exports", async () => {
    await expect(
      assertRuleDoesNotReport(ruleName, 'import { kernel } from "@fixture/kernel";\nexport const app = kernel;\n', {
        filename: "apps/web/src/app.ts",
        files: workspace,
      }),
    ).resolves.toBeUndefined();
  });

  it("reports a package importing an app, statically and dynamically", async () => {
    const messages = await reportedMessages(
      ruleName,
      'import { web } from "@fixture/web";\nexport { web };\nexport const later = () => import("@fixture/web");\n',
      { filename: "packages/kernel/src/leak.ts", files: workspace },
    );

    expect(messages).toHaveLength(2);
    expect(messages.every((message) => message.startsWith("Packages never import apps: @fixture/kernel"))).toBe(true);
  });

  it("reports a deep import and a re-export into package internals", async () => {
    const messages = await reportedMessages(
      ruleName,
      'import { kernel } from "@fixture/kernel/src/index.ts";\nexport * from "@fixture/kernel/src/index.ts";\nexport const app = kernel;\n',
      { filename: "apps/web/src/app.ts", files: workspace },
    );

    expect(messages).toHaveLength(2);
  });

  it("stays silent on a subpath of a member whose manifest declares no exports", async () => {
    await expect(
      assertRuleDoesNotReport(
        ruleName,
        'import { ranger } from "@fixture/ranger/src/index.ts";\nexport const mage = ranger;\n',
        { filename: "packages/features/mage/src/index.ts", files: workspace },
      ),
    ).resolves.toBeUndefined();
  });

  it("exempts test files from the relative-path and unexported-subpath checks", async () => {
    await expect(
      assertRuleDoesNotReport(
        ruleName,
        'import { kernel } from "@fixture/kernel/src/index.ts";\nimport { again } from "../../../packages/kernel/src/index.ts";\nexport const t = [kernel, again];\n',
        { filename: "apps/web/src/app.test.ts", files: workspace },
      ),
    ).resolves.toBeUndefined();
  });

  it("judges test files too with includeTestFiles", async () => {
    const messages = await reportedMessages(
      ruleName,
      'import { kernel } from "@fixture/kernel/src/index.ts";\nimport { again } from "../../../packages/kernel/src/index.ts";\nexport const t = [kernel, again];\n',
      { filename: "apps/web/src/app.test.ts", files: workspace, ruleOptions: { includeTestFiles: true } },
    );

    expect(messages).toHaveLength(2);
  });

  it('closes a member without an exports field to its root with missingExports "root"', async () => {
    await expect(
      assertRuleReports(
        ruleName,
        'import { ranger } from "@fixture/ranger/src/index.ts";\nexport const mage = ranger;\n',
        {
          filename: "packages/features/mage/src/index.ts",
          files: workspace,
          ruleOptions: { missingExports: "root" },
          message: /is not opened by the package.json exports of @fixture\/ranger/u,
        },
      ),
    ).resolves.toBeUndefined();
  });

  it('keeps the root of a member without exports open with missingExports "root"', async () => {
    await expect(
      assertRuleDoesNotReport(ruleName, 'import { ranger } from "@fixture/ranger";\nexport const mage = ranger;\n', {
        filename: "packages/features/mage/src/index.ts",
        files: workspace,
        ruleOptions: { missingExports: "root" },
      }),
    ).resolves.toBeUndefined();
  });

  it("still reports a package importing an app from a test file", async () => {
    await expect(
      assertRuleReports(ruleName, 'import { web } from "@fixture/web";\nexport { web };\n', {
        filename: "packages/kernel/src/leak.test.ts",
        files: workspace,
      }),
    ).resolves.toBeUndefined();
  });

  it("reports the same deep import and relative path from a non-test file", async () => {
    const messages = await reportedMessages(
      ruleName,
      'import { kernel } from "@fixture/kernel/src/index.ts";\nimport { again } from "../../../packages/kernel/src/index.ts";\nexport const t = [kernel, again];\n',
      { filename: "apps/web/src/app.ts", files: workspace },
    );

    expect(messages).toHaveLength(2);
  });

  it("reports a relative path between members", async () => {
    await expect(
      assertRuleReports(
        ruleName,
        'import { ranger } from "../../ranger/src/index.ts";\nexport const mage = ranger;\n',
        {
          filename: "packages/features/mage/src/index.ts",
          files: workspace,
          message: /reaches into @fixture\/ranger by a relative path/u,
        },
      ),
    ).resolves.toBeUndefined();
  });

  it("reports an edge of the forbidden matrix with its reason", async () => {
    await expect(
      assertRuleReports(ruleName, 'import { ranger } from "@fixture/ranger";\nexport const mage = ranger;\n', {
        filename: "packages/features/mage/src/index.ts",
        files: workspace,
        ruleOptions: {
          forbidden: [
            { from: "packages/features/*", to: "packages/features/*", message: "features meet in the kernel" },
          ],
        },
        message:
          /@fixture\/mage must not import @fixture\/ranger \(\\"@fixture\/ranger\\"\): features meet in the kernel/u,
      }),
    ).resolves.toBeUndefined();
  });

  it("stays silent on the same edge without the matrix", async () => {
    await expect(
      assertRuleDoesNotReport(ruleName, 'import { ranger } from "@fixture/ranger";\nexport const mage = ranger;\n', {
        filename: "packages/features/mage/src/index.ts",
        files: workspace,
      }),
    ).resolves.toBeUndefined();
  });

  it("classifies members as apps through the apps option", async () => {
    await expect(
      assertRuleReports(ruleName, 'import { kernel } from "@fixture/kernel";\nexport const mage = kernel;\n', {
        filename: "packages/features/mage/src/index.ts",
        files: workspace,
        ruleOptions: { apps: ["apps/**", "packages/kernel"] },
        message: /Packages never import apps: @fixture\/mage imports @fixture\/kernel/u,
      }),
    ).resolves.toBeUndefined();
  });

  it("stays silent outside any workspace", async () => {
    await expect(
      assertRuleDoesNotReport(ruleName, 'import { x } from "../../elsewhere/src/x.ts";\nexport const y = x;\n', {
        filename: "src/a/b.ts",
      }),
    ).resolves.toBeUndefined();
  });
});
