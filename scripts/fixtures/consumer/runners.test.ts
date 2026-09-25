import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";
import { run, runnerRoot, writeFixture } from "./runner-support.js";

it("runs every packed agent preset through the actual agentlint parser", async () => {
  await mkdir(path.join(runnerRoot, ".agentlint"), { recursive: true });
  execFileSync("git", ["init", "--quiet"], { cwd: runnerRoot, windowsHide: true });
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
    { cwd: runnerRoot, windowsHide: true },
  );
  const presets: readonly [string, string][] = [
    ["core", "strictPreset"],
    ["effect", "strictPreset"],
    ["shopify-app", "shopifyAppPreset"],
    ["tanstack-query", "strictPreset"],
    ["xstate", "xstatePreset"],
  ];
  await writeFixture(
    ".agentlint/config.ts",
    presets
      .map(
        ([name, preset], index) =>
          `import { ${preset} as preset${index} } from "@aurelienbbn/agentlint-plugin-${name}";`,
      )
      .join("\n") +
      `\nexport default { rules: [ ${presets.map((_, index) => `...preset${index}.rules`).join(", ")} ] };`,
  );
  await writeFixture(
    "agent-broken.ts",
    'export interface IUser { id: string }\nexport type Order = { id: string };\nfetch("/unbounded"); useQuery({}); createActor(machine); const copy = "Hurry!";',
  );
  await writeFixture("agent-clean.ts", "interface Local { id: string }; export const id = 1;");
  const executable = path.resolve("node_modules/@aurelienbbn/agentlint/dist/bin.mjs");
  const findings = run(executable, ["check", "agent-broken.ts", "--base", "HEAD", "--format", "jsonl"], 1)
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { rule: { id: string }; location: { line: number } });
  expect(new Set(findings.map((finding) => finding.rule.id.split("/")[0]))).toEqual(
    new Set(presets.map(([name]) => name)),
  );
  expect(findings.every((finding) => finding.location.line > 0)).toBe(true);
  expect(run(executable, ["check", "agent-clean.ts", "--base", "HEAD", "--format", "jsonl"], 0).trim()).toBe("");
});
