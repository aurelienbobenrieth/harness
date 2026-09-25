import { expect, it } from "vitest";
import { createFixture } from "./test-support.js";
import { stripJsonc, tsconfigStrictness } from "./tsconfig-strictness.js";

const strictBaseline = {
  strict: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  verbatimModuleSyntax: true,
  erasableSyntaxOnly: true,
};

function tsconfig(compilerOptions: Record<string, unknown>, rest: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...rest, compilerOptions });
}

it("stays silent until the consumer opts in", async () => {
  const root = await createFixture({ "tsconfig.json": tsconfig({ strict: false }) });

  expect(await tsconfigStrictness.run({ root })).toEqual([]);
});

it("passes a config that carries the whole baseline", async () => {
  const root = await createFixture({ "tsconfig.json": tsconfig(strictBaseline) });

  expect(await tsconfigStrictness.run({ root, tsconfigStrictness: {} })).toEqual([]);
});

it("reports each missing baseline flag with the file that needs it", async () => {
  const root = await createFixture({
    "tsconfig.json": tsconfig({ strict: true, skipLibCheck: true }),
  });

  const findings = await tsconfigStrictness.run({ root, tsconfigStrictness: {} });
  expect(findings.map((finding) => finding.severity)).toEqual(["error", "error", "error", "error"]);
  expect(findings.map((finding) => finding.path)).toEqual(Array.from({ length: 4 }, () => "tsconfig.json"));
  expect(findings.map((finding) => finding.message)).toEqual([
    "tsconfig.json: `noUncheckedIndexedAccess` is unset; set it to true in compilerOptions.",
    "tsconfig.json: `exactOptionalPropertyTypes` is unset; set it to true in compilerOptions.",
    "tsconfig.json: `verbatimModuleSyntax` is unset; set it to true in compilerOptions.",
    "tsconfig.json: `erasableSyntaxOnly` is unset; set it to true in compilerOptions.",
  ]);
});

it("reports a strict-family flag switched off underneath strict: true", async () => {
  const root = await createFixture({
    "tsconfig.json": tsconfig({
      ...strictBaseline,
      strictNullChecks: false,
      strictFunctionTypes: true,
    }),
  });

  const findings = await tsconfigStrictness.run({ root, tsconfigStrictness: {} });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toBe(
    "tsconfig.json: `strictNullChecks` is false (set in tsconfig.json) and carves a hole in `strict`; delete the override.",
  );
});

it("forbids ignoreDeprecations whatever its value", async () => {
  const root = await createFixture({
    "tsconfig.json": tsconfig({ ...strictBaseline, ignoreDeprecations: "6.0" }),
  });

  const findings = await tsconfigStrictness.run({ root, tsconfigStrictness: {} });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain('`ignoreDeprecations` is "6.0"');
});

it("reads JSONC comments and trailing commas without touching string contents", async () => {
  const root = await createFixture({
    "tsconfig.json": `\uFEFF{
  // line comment with "quotes" and a trailing , }
  "compilerOptions": {
    /* block
       comment */
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "paths": { "//literal/*": ["./src/*, ]"], },
  },
}`,
  });

  expect(await tsconfigStrictness.run({ root, tsconfigStrictness: {} })).toEqual([]);
  expect(JSON.parse(stripJsonc('{"a": "// kept, ]", /* gone */ "b": [1, 2, ], }'))).toEqual({
    a: "// kept, ]",
    b: [1, 2],
  });
});

it("inherits flags through relative, extensionless, and array extends with later entries winning", async () => {
  const root = await createFixture({
    "config/strict.json": tsconfig(strictBaseline),
    "config/loose.json": tsconfig({ noUncheckedIndexedAccess: false }),
    "tsconfig.json": JSON.stringify({ extends: ["./config/strict", "./config/loose.json"] }),
  });

  const findings = await tsconfigStrictness.run({
    root,
    tsconfigStrictness: { files: ["tsconfig.json"] },
  });
  expect(findings.map((finding) => finding.message)).toEqual([
    "tsconfig.json: `noUncheckedIndexedAccess` is false (set in config/loose.json); set it to true in compilerOptions.",
  ]);
});

it("lets the extending file override its base in both directions", async () => {
  const root = await createFixture({
    "base.json": tsconfig({ ...strictBaseline, strictNullChecks: false }),
    "tsconfig.json": tsconfig({ strictNullChecks: true }, { extends: "./base.json" }),
    "tsconfig.build.json": tsconfig({ erasableSyntaxOnly: false }, { extends: "./tsconfig.json" }),
  });

  const findings = await tsconfigStrictness.run({
    root,
    tsconfigStrictness: { files: ["tsconfig.json", "tsconfig.build.json"] },
  });
  expect(findings.map((finding) => finding.path)).toEqual(["tsconfig.build.json"]);
  expect(findings[0]?.message).toContain("`erasableSyntaxOnly` is false (set in tsconfig.build.json)");
});

it("resolves package-specifier extends from node_modules, including scoped names, exports and the tsconfig field", async () => {
  const root = await createFixture({
    "node_modules/@scope/tsconfig/package.json": JSON.stringify({
      exports: { "./strict": "./configs/strict.json" },
    }),
    "node_modules/@scope/tsconfig/configs/strict.json": tsconfig(strictBaseline),
    "node_modules/base-config/package.json": JSON.stringify({ tsconfig: "./main.json" }),
    "node_modules/base-config/main.json": tsconfig({ ...strictBaseline, noImplicitAny: false }),
    "packages/app/tsconfig.json": JSON.stringify({ extends: "@scope/tsconfig/strict" }),
    "packages/lib/tsconfig.json": JSON.stringify({ extends: "base-config" }),
  });

  const findings = await tsconfigStrictness.run({
    root,
    tsconfigStrictness: { files: ["packages/app/tsconfig.json", "packages/lib/tsconfig.json"] },
  });
  expect(findings.map((finding) => finding.path)).toEqual(["packages/lib/tsconfig.json"]);
  expect(findings[0]?.message).toContain("`noImplicitAny` is false (set in node_modules/base-config/main.json)");
});

it("fails the evaluation when an extends target is missing or circular", async () => {
  const root = await createFixture({
    "tsconfig.json": tsconfig(strictBaseline, { extends: "missing-preset/tsconfig.json" }),
    "tsconfig.a.json": JSON.stringify({ extends: "./tsconfig.b.json" }),
    "tsconfig.b.json": JSON.stringify({ extends: "./tsconfig.a.json" }),
  });

  const findings = await tsconfigStrictness.run({
    root,
    tsconfigStrictness: { files: ["tsconfig.json", "tsconfig.a.json"] },
  });
  expect(findings.map((finding) => [finding.path, finding.evaluation, finding.severity])).toEqual([
    ["tsconfig.json", "failed", "error"],
    ["tsconfig.a.json", "failed", "error"],
  ]);
  expect(findings[0]?.message).toContain('extends "missing-preset/tsconfig.json"');
  expect(findings[1]?.message).toContain("circular extends");
});

it("discovers root and workspace configs, skipping extends bases and solution files", async () => {
  const root = await createFixture({
    "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
    "tsconfig.json": JSON.stringify({ files: [], references: [{ path: "./packages/app" }] }),
    "tsconfig.base.json": tsconfig({ strict: true }),
    "packages/app/package.json": "{}",
    "packages/app/tsconfig.json": tsconfig(
      {
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true,
        verbatimModuleSyntax: true,
        erasableSyntaxOnly: true,
      },
      { extends: "../../tsconfig.base.json" },
    ),
    "packages/app/tsconfig.test.json": tsconfig({ strict: false }, { extends: "./tsconfig.json" }),
    "packages/app/tsconfig-notes.json": tsconfig({ strict: false }),
  });

  const findings = await tsconfigStrictness.run({ root, tsconfigStrictness: {} });
  expect(findings.map((finding) => finding.path)).toEqual(["packages/app/tsconfig.test.json"]);
  expect(findings[0]?.message).toContain("`strict` is false");
});

it("reports missing evidence instead of passing when nothing can be checked", async () => {
  const root = await createFixture({ "package.json": "{}" });

  expect(await tsconfigStrictness.run({ root, tsconfigStrictness: {} })).toMatchObject([
    { severity: "warning", evaluation: "unsupported" },
  ]);
  expect(await tsconfigStrictness.run({ root, tsconfigStrictness: { files: ["tsconfig.json"] } })).toMatchObject([
    { severity: "error", evaluation: "failed", path: "tsconfig.json" },
  ]);
});

it("downgrades a waived flag to a warning that records the reason, and leaves other flags enforced", async () => {
  const { exactOptionalPropertyTypes: _waived, ...rest } = strictBaseline;
  const root = await createFixture({
    "tsconfig.json": tsconfig({ ...rest, erasableSyntaxOnly: false }),
  });

  const findings = await tsconfigStrictness.run({
    root,
    tsconfigStrictness: {
      waivers: {
        exactOptionalPropertyTypes: "Vendor SDK typings assign undefined to optional fields.",
      },
    },
  });
  expect(findings.map((finding) => [finding.severity, finding.message])).toEqual([
    [
      "warning",
      "tsconfig.json: `exactOptionalPropertyTypes` is waived. Reason: Vendor SDK typings assign undefined to optional fields.",
    ],
    [
      "error",
      "tsconfig.json: `erasableSyntaxOnly` is false (set in tsconfig.json); set it to true in compilerOptions.",
    ],
  ]);
});

it("rejects waivers without a written reason or for flags it does not own, and flags stale ones", async () => {
  const root = await createFixture({ "tsconfig.json": tsconfig(strictBaseline) });

  await expect(
    tsconfigStrictness.run({
      root,
      tsconfigStrictness: { waivers: { erasableSyntaxOnly: "legacy" } },
    }),
  ).rejects.toThrow("needs a written reason");
  await expect(
    tsconfigStrictness.run({
      root,
      tsconfigStrictness: { waivers: { skipLibCheck: "Not a flag this check owns." } },
    }),
  ).rejects.toThrow("Unknown tsconfig-strictness waiver: skipLibCheck");
  expect(
    await tsconfigStrictness.run({
      root,
      tsconfigStrictness: {
        waivers: { erasableSyntaxOnly: "Legacy enums remain in the billing module." },
      },
    }),
  ).toMatchObject([{ severity: "warning", message: expect.stringContaining("delete the stale waiver") }]);
});

it("enforces additional required flags", async () => {
  const root = await createFixture({ "tsconfig.json": tsconfig(strictBaseline) });

  const findings = await tsconfigStrictness.run({
    root,
    tsconfigStrictness: { additionalRequiredFlags: ["noImplicitOverride"] },
  });
  expect(findings.map((finding) => finding.message)).toEqual([
    "tsconfig.json: `noImplicitOverride` is unset; set it to true in compilerOptions.",
  ]);
});
