import { expect, it } from "vitest";
import { deadExports } from "./dead-exports.js";
import { createFixture } from "./test-support.js";

const fakeKnipManifest = JSON.stringify({
  name: "knip",
  version: "0.0.0-test",
  bin: { knip: "bin/knip.js" },
});

function fakeKnipBin(report: unknown, exitCode: number): string {
  return `console.log(JSON.stringify(${JSON.stringify(report)})); process.exit(${exitCode});`;
}

it("degrades to a single warning when knip is not installed", async () => {
  const root = await createFixture({
    "package.json": JSON.stringify({ name: "fixture" }),
  });

  const findings = await deadExports.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.severity).toBe("warning");
  expect(findings[0]?.message).toContain("knip not installed");
});

it("fails on the missing config when requireKnipConfig is set and no config exists", async () => {
  const root = await createFixture({
    "package.json": JSON.stringify({ name: "fixture" }),
  });

  const findings = await deadExports.run({ root, deadExports: { requireKnipConfig: true } });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.severity).toBe("error");
  expect(findings[0]?.message).toContain("configuration is missing");
});

it("emits the generic warning when requireKnipConfig is set but a config exists", async () => {
  const root = await createFixture({
    "package.json": JSON.stringify({ name: "fixture" }),
    "knip.json": JSON.stringify({ entry: ["src/index.ts"] }),
  });

  const findings = await deadExports.run({ root, deadExports: { requireKnipConfig: true } });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("knip not installed");
});

it("fails on unused files and exports reported by knip", async () => {
  const report = {
    files: ["src/dead.ts"],
    issues: [
      {
        file: "src/index.ts",
        exports: [{ name: "unusedThing", line: 3, col: 1 }],
        types: ["UnusedType"],
      },
    ],
  };
  const root = await createFixture({
    "package.json": JSON.stringify({ name: "fixture" }),
    "node_modules/knip/package.json": fakeKnipManifest,
    "node_modules/knip/bin/knip.js": fakeKnipBin(report, 1),
  });

  const findings = await deadExports.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.severity).toBe("error");
  expect(findings[0]?.message).toContain("unused file src/dead.ts");
  expect(findings[0]?.message).toContain("unused export unusedThing in src/index.ts");
  expect(findings[0]?.message).toContain("unused export UnusedType in src/index.ts");
});

it("passes on a clean knip report", async () => {
  const root = await createFixture({
    "package.json": JSON.stringify({ name: "fixture" }),
    "node_modules/knip/package.json": fakeKnipManifest,
    "node_modules/knip/bin/knip.js": fakeKnipBin({ files: [], issues: [] }, 0),
  });

  expect(await deadExports.run({ root })).toEqual([]);
});

it("does not certify a malformed required Knip report", async () => {
  const root = await createFixture({
    "knip.json": "{}",
    "node_modules/knip/package.json": fakeKnipManifest,
    "node_modules/knip/bin/knip.js": fakeKnipBin(null, 0),
  });
  expect(await deadExports.run({ root, deadExports: { requireKnipConfig: true } })).toEqual([
    expect.objectContaining({ severity: "error" }),
  ]);
});
