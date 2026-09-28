import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { adoptReview } from "./rule.js";

function findings(source: string, file = "src/deploy.ts") {
  return testRuleOnSource({ rule: adoptReview, source, file });
}

it("reports programmatic adoption for human review", async () => {
  const results = await findings(
    "const run = deploy(program).pipe(Alchemy.AdoptPolicy.adopt());\nconst other = deploy(program).pipe(AdoptPolicy.adopt(decide));",
  );
  expect(results.map((finding) => [finding.authority, finding.line])).toEqual([
    ["human", 1],
    ["human", 2],
  ]);
});

it("reports a bare adopt imported from alchemy/AdoptPolicy and nothing else named adopt", async () => {
  expect(
    await findings('import { adopt } from "alchemy/AdoptPolicy";\nconst run = deploy(program).pipe(adopt(true));'),
  ).toHaveLength(1);
  expect(await findings('import { adopt } from "./pets";\nadopt(cat);')).toEqual([]);
  expect(await findings("const run = deploy(program).pipe(AdoptPolicy.adopt(false));")).toEqual([]);
});

it("reports --adopt in package.json scripts only", async () => {
  const manifest = JSON.stringify({
    name: "backend",
    scripts: { deploy: "alchemy deploy --adopt --stage prod", plan: "alchemy plan", adopt: "alchemy deploy --adopt" },
    config: { flags: "--adopt" },
  });
  expect((await findings(manifest, "package.json")).map((finding) => finding.message)).toEqual([
    expect.stringContaining("`--adopt` in a package script"),
    expect.stringContaining("`--adopt` in a package script"),
  ]);
  expect(await findings(JSON.stringify({ scripts: { deploy: "alchemy deploy --adopted" } }), "package.json")).toEqual(
    [],
  );
  expect(await findings(JSON.stringify({ scripts: { deploy: "alchemy deploy --adopt" } }), "tsconfig.json")).toEqual(
    [],
  );
});
