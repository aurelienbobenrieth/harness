import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { planCheck, selectScope } from "./check-plan.mjs";

const base = "b".repeat(40);
const scripts = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../package.json"), "utf8")).scripts;
const names = (plan) => [plan.build, ...plan.steps].map((step) => step.name);
const step = (plan, name) => plan.steps.find((candidate) => candidate.name === name);

test("keeps package-only changes affected", () => {
  assert.deepEqual(selectScope(["packages/oxlint-plugin-core/src/rules/a/rule.ts", "internal/oxlint-kit/src/ast.ts"]), {
    kind: "affected",
  });
});

test("inert documentation changes stay affected", () => {
  assert.deepEqual(
    selectScope([".changeset/new-rule.md", "docs/compatibility.md", "skills/build/SKILL.md", "README.md"]),
    {
      kind: "affected",
    },
  );
});

for (const file of [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "vite.config.ts",
  "knip.json",
  ".github/workflows/ci.yml",
  "scripts/check.mjs",
  "policy/release.json",
  "examples/conformance-core/closed-design-system-probe.example.ts",
  "packages/README.md",
]) {
  test(`${file} falls back to the full suite`, () => {
    assert.deepEqual(selectScope(["packages/oxlint-plugin-core/src/index.ts", file]), {
      kind: "full",
      reason: `${file} is shared by every package`,
    });
  });
}

test("the full plan runs every validation script once, after one build", () => {
  const plan = planCheck({ kind: "full", reason: "requested" });
  assert.deepEqual(plan.build, { name: "build", args: ["run", "build"] });
  assert.deepEqual(names(plan).toSorted(), [
    "build",
    "catalog:check",
    "compatibility:check",
    "fmt:check",
    "lint",
    "quality:check",
    "release:check",
    "shopify:check",
    "skills:check",
    "test:check-plan",
    "test:compatibility-policy",
    "test:consumer-results",
    "test:release",
    "test:shopify-policy",
    "test:skills",
    "test:unit",
    "typecheck",
  ]);
  for (const { name, args } of plan.steps) {
    assert.ok(Object.hasOwn(scripts, name), `${name}: missing package script`);
    assert.deepEqual(args, ["run", name]);
  }
  assert.equal(plan.steps[0].name, "test:unit", "Start the longest step first.");
});

test("affected plans narrow typecheck and unit tests, and keep repo-wide checks whole", () => {
  const full = planCheck({ kind: "full", reason: "requested" });
  const plan = planCheck({ kind: "affected", base, packages: ["packages/oxlint-plugin-core", "internal/oxlint-kit"] });
  assert.deepEqual(names(plan), names(full));
  assert.deepEqual(plan.build, full.build, "Repo-wide checks import every package's build output.");
  assert.deepEqual(step(plan, "typecheck").args, ["--filter", `...[${base}]`, "typecheck"]);
  assert.deepEqual(step(plan, "test:unit").args, [
    "run",
    "test:unit",
    "packages/oxlint-plugin-core/",
    "internal/oxlint-kit/",
  ]);
  for (const name of full.steps.map((candidate) => candidate.name))
    if (name !== "typecheck" && name !== "test:unit") assert.deepEqual(step(plan, name), step(full, name));
});

test("an agentlint plugin change also runs the core consumer test that loads every plugin build", () => {
  const plan = planCheck({ kind: "affected", base, packages: ["packages/agentlint-plugin-effect"] });
  assert.deepEqual(step(plan, "test:unit").args, [
    "run",
    "test:unit",
    "packages/agentlint-plugin-effect/",
    "packages/agentlint-plugin-core/",
  ]);
  const core = planCheck({ kind: "affected", base, packages: ["packages/agentlint-plugin-core"] });
  assert.deepEqual(step(core, "test:unit").args, ["run", "test:unit", "packages/agentlint-plugin-core/"]);
});

test("no affected package skips typecheck and unit tests with a reason", () => {
  const plan = planCheck({ kind: "affected", base, packages: [] });
  for (const name of ["typecheck", "test:unit"])
    assert.deepEqual(step(plan, name), { name, skip: "no package changed" });
  assert.ok(step(plan, "lint").args);
});
