import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";
import { run, writeFixture } from "./runner-support.js";

it("runs the documented Shopify App Home policy with native and Polaris JSX", async () => {
  const config = JSON.parse(await readFile("shopify-oxlint.json", "utf8")) as { jsPlugins: string[] };
  config.jsPlugins = [import.meta.resolve("@aurelienbbn/oxlint-plugin-shopify-app")];
  await writeFixture("shopify-config.json", JSON.stringify(config));
  await writeFixture(
    "shopify-broken.tsx",
    'export const view = <html><body><img src="/photo.png" /><input autoFocus /><div tabIndex={2} /><s-button icon="edit" /><s-spinner /><s-text-field /></body></html>;',
  );
  await writeFixture(
    "shopify-clean.tsx",
    'export const view = <html lang="en"><body><img src="/decoration.png" alt="" /><div tabIndex={-1} /><s-button icon="edit" accessibilityLabel="Edit order" /><s-spinner accessibilityLabel="Loading orders" /><s-text-field label="Order note" /></body></html>;',
  );
  const executable = path.resolve("node_modules/oxlint/bin/oxlint");
  const broken = JSON.parse(
    run(executable, ["--config", "shopify-config.json", "shopify-broken.tsx", "--format", "json"], 1),
  ) as { diagnostics: { code: string }[]; number_of_files: number };
  expect(broken.number_of_files).toBe(1);
  expect(broken.diagnostics.map((entry) => entry.code).toSorted()).toEqual(
    [
      "jsx-a11y(alt-text)",
      "jsx-a11y(html-has-lang)",
      "jsx-a11y(no-autofocus)",
      "jsx-a11y(tabindex-no-positive)",
      "shopify-app(s-button-accessible-name)",
      "shopify-app(s-spinner-accessible-label)",
      "shopify-app(s-form-control-label-required)",
    ].toSorted(),
  );
  const clean = JSON.parse(
    run(executable, ["--config", "shopify-config.json", "shopify-clean.tsx", "--format", "json"], 0),
  ) as { diagnostics: unknown[]; number_of_files: number };
  expect(clean.number_of_files).toBe(1);
  expect(clean.diagnostics).toEqual([]);
});

it("executes a combined oxlint policy using every packed oxlint plugin", async () => {
  const packages = ["core", "effect", "shopify-app", "type-evidence", "xstate"];
  const rules = [
    "core/no-exported-anonymous-object-return",
    "effect/no-schema-any",
    "shopify-app/require-fetch-abort-signal",
    "type-evidence/no-unknown-parameters",
    "xstate/require-setup-create-machine",
  ];
  await writeFixture(
    "combined-oxlint.json",
    JSON.stringify({
      categories: { correctness: "off" },
      jsPlugins: packages.map((name) => import.meta.resolve(`@aurelienbbn/oxlint-plugin-${name}`)),
      rules: Object.fromEntries(rules.map((name) => [name, "error"])),
    }),
  );
  await writeFixture(
    "combined-broken.ts",
    'import { Schema } from "effect"; import { createMachine } from "xstate"; export const read = () => ({ id: 1 }); export const payload = Schema.Any; fetch("/cart"); export function consume(value: unknown) { return value; } export const machine = createMachine({});',
  );
  await writeFixture(
    "combined-clean.ts",
    'import { Schema } from "effect"; import { setup } from "xstate"; type User = { id: number }; export const read = (): User => ({ id: 1 }); export const payload = Schema.String; export const request = (signal: AbortSignal): Promise<Response> => fetch("/cart", { signal }); export const machine = setup({ types: {} as { context: Record<string, never>; events: { type: "start" } } }).createMachine({});',
  );
  const executable = path.resolve("node_modules/oxlint/bin/oxlint");
  const broken = JSON.parse(
    run(executable, ["--config", "combined-oxlint.json", "combined-broken.ts", "--format", "json"], 1),
  ) as { diagnostics: { code: string }[]; number_of_files: number };
  expect(broken.number_of_files).toBe(1);
  expect(broken.diagnostics.map((finding) => finding.code).toSorted()).toEqual(
    rules.map((name) => name.replace("/", "(") + ")").toSorted(),
  );
  const clean = JSON.parse(
    run(executable, ["--config", "combined-oxlint.json", "combined-clean.ts", "--format", "json"], 0),
  ) as { diagnostics: unknown[]; number_of_files: number };
  expect(clean.number_of_files).toBe(1);
  expect(clean.diagnostics).toEqual([]);
});
