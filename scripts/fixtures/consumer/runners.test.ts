import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";
import { defineConfig } from "@aurelienbbn/agentlint";
import { testRuleFixtures } from "@aurelienbbn/agentlint/testing";
import { strictPreset as corePreset } from "@aurelienbbn/agentlint-plugin-core";
import { strictPreset as effectPreset } from "@aurelienbbn/agentlint-plugin-effect";
import { shopifyAppPreset } from "@aurelienbbn/agentlint-plugin-shopify-app";
import { strictPreset as queryPreset } from "@aurelienbbn/agentlint-plugin-tanstack-query";
import { xstatePreset } from "@aurelienbbn/agentlint-plugin-xstate";
import { run, runnerRoot, writeFixture } from "./runner-support.js";

const domains = ["core", "effect", "shopify-app", "tanstack-query", "xstate"] as const;
const presets: readonly [string, string][] = [
  ["core", "strictPreset"],
  ["effect", "strictPreset"],
  ["shopify-app", "shopifyAppPreset"],
  ["tanstack-query", "strictPreset"],
  ["xstate", "xstatePreset"],
];
const executable = path.resolve("node_modules/@aurelienbbn/agentlint/dist/bin.mjs");
const brokenSource =
  'export interface IUser { id: string }\nexport type Order = { id: string };\nfetch("/unbounded"); useQuery({}); createActor(machine); const copy = "Hurry!";';

function commitBaseline(cwd: string): void {
  execFileSync("git", ["init", "--quiet"], { cwd, windowsHide: true });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.test",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "-qm",
      "baseline",
    ],
    { cwd, windowsHide: true },
  );
}

it("composes every packed agent preset in a typed config and passes each rule's own fixtures", async () => {
  const config = defineConfig({ extends: [corePreset, effectPreset, shopifyAppPreset, queryPreset, xstatePreset] });
  const rules = (config.extends ?? []).flatMap((preset) => preset.rules ?? []);
  expect(new Set(rules.map((rule) => rule.binding.id.split("/")[0]))).toEqual(new Set(domains));
  const reports = await Promise.all(rules.map((rule) => testRuleFixtures(rule)));
  expect(reports.filter((report) => report.failures.length > 0)).toEqual([]);
});

it("runs every packed agent preset through the actual agentlint parser", async () => {
  await mkdir(path.join(runnerRoot, ".agentlint"), { recursive: true });
  commitBaseline(runnerRoot);
  await writeFixture(
    ".agentlint/config.ts",
    presets
      .map(
        ([name, preset], index) =>
          `import { ${preset} as preset${index} } from "@aurelienbbn/agentlint-plugin-${name}";`,
      )
      .join("\n") + `\nexport default { extends: [ ${presets.map((_, index) => `preset${index}`).join(", ")} ] };`,
  );
  await writeFixture("agent-broken.ts", brokenSource);
  await writeFixture("agent-clean.ts", "interface Local { id: string }; export const id = 1;");
  const findings = run(executable, ["check", "agent-broken.ts", "--base", "HEAD", "--format", "jsonl"], 1)
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(
      (line) =>
        JSON.parse(line) as {
          rule: { id: string };
          location: { line: number };
          identity: { fingerprint: { scheme: string; version: number } };
        },
    );
  expect(new Set(findings.map((finding) => finding.rule.id.split("/")[0]))).toEqual(new Set(domains));
  expect(findings.every((finding) => finding.location.line > 0)).toBe(true);
  expect(
    findings.every(
      ({ identity }) => identity.fingerprint.scheme === "source-structure" && identity.fingerprint.version === 3,
    ),
  ).toBe(true);
  expect(run(executable, ["check", "agent-clean.ts", "--base", "HEAD", "--format", "jsonl"], 0).trim()).toBe("");
});

it("initializes every packed starter preset through the CLI and hands out the next obligation", async () => {
  const starter = path.join(runnerRoot, "starter");
  await mkdir(starter, { recursive: true });
  commitBaseline(starter);
  await writeFixture("starter/sample.ts", brokenSource);
  run(
    executable,
    ["init", ...domains.flatMap((domain) => ["--preset", `@aurelienbbn/agentlint-plugin-${domain}#starterPreset`])],
    0,
    starter,
  );
  run(executable, ["rules", "test"], 0, starter);
  const next = JSON.parse(run(executable, ["next", "--format", "json", "--base", "HEAD"], 1, starter)) as {
    version: number;
    scope: string;
    remaining: number;
    actions: { argv: string[] }[];
    executedBindings: string[];
  };
  expect(next.version).toBe(1);
  expect(next.scope).toBe("complete");
  expect(next.remaining).toBeGreaterThan(0);
  expect(next.actions.at(-1)?.argv[0]).toBe("check");
  expect(new Set(next.executedBindings).size).toBe(next.executedBindings.length);
});
