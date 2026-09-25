import { expect, it } from "vitest";
import { duplicationBudget } from "./duplication-budget.js";
import { createFixture } from "./test-support.js";

const fakeJscpdManifest = JSON.stringify({
  name: "jscpd",
  version: "0.0.0-test",
  bin: { jscpd: "bin/jscpd.js" },
});

const fakeJscpdBin = `
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const output = args[args.indexOf("--output") + 1];
const report = {
  duplicates: [
    { firstFile: { name: "src/a.ts", start: 1, end: 12 }, secondFile: { name: "src/b.ts", start: 4, end: 15 } },
    { firstFile: { name: "src/c.ts", start: 2, end: 10 }, secondFile: { name: "src/d.ts", start: 2, end: 10 } },
  ],
};
fs.writeFileSync(path.join(output, "jscpd-report.json"), JSON.stringify(report));
`;

it("degrades to a single warning when jscpd is not installed", async () => {
  const root = await createFixture({
    "package.json": JSON.stringify({ name: "fixture" }),
  });

  const findings = await duplicationBudget.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.severity).toBe("warning");
  expect(findings[0]?.message).toContain("jscpd not installed");
});

it("fails when the reported clone count exceeds the budget", async () => {
  const root = await createFixture({
    "package.json": JSON.stringify({ name: "fixture" }),
    "node_modules/jscpd/package.json": fakeJscpdManifest,
    "node_modules/jscpd/bin/jscpd.js": fakeJscpdBin,
  });

  const findings = await duplicationBudget.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.severity).toBe("error");
  expect(findings[0]?.message).toContain("2 duplicated block(s)");
  expect(findings[0]?.message).toContain("src/a.ts:1-12");
});

it("passes when the clone count stays within maxClones", async () => {
  const root = await createFixture({
    "package.json": JSON.stringify({ name: "fixture" }),
    "node_modules/jscpd/package.json": fakeJscpdManifest,
    "node_modules/jscpd/bin/jscpd.js": fakeJscpdBin,
  });

  expect(await duplicationBudget.run({ root, duplication: { maxClones: 5 } })).toEqual([]);
});

it("degrades to a warning when jscpd produces no readable report", async () => {
  const root = await createFixture({
    "package.json": JSON.stringify({ name: "fixture" }),
    "node_modules/jscpd/package.json": fakeJscpdManifest,
    "node_modules/jscpd/bin/jscpd.js": "console.error('jscpd exploded'); process.exit(1);",
  });

  const findings = await duplicationBudget.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.severity).toBe("warning");
  expect(findings[0]?.message).toContain("no readable JSON report");
  expect(findings[0]?.message).toContain("jscpd exploded");
});

it("fails when required jscpd is missing", async () => {
  const root = await createFixture({ "package.json": "{}" });
  expect(await duplicationBudget.run({ root, duplication: { requireTool: true } })).toEqual([
    expect.objectContaining({ severity: "error" }),
  ]);
});

it("rejects malformed clones even inside a permissive budget", async () => {
  const root = await createFixture({
    "node_modules/jscpd/package.json": fakeJscpdManifest,
    "node_modules/jscpd/bin/jscpd.js":
      'const args = process.argv; const out = args[args.indexOf("--output") + 1]; require("node:fs").writeFileSync(require("node:path").join(out, "jscpd-report.json"), JSON.stringify({ duplicates: [null] }));',
  });
  expect(await duplicationBudget.run({ root, duplication: { maxClones: 5, requireTool: true } })).toEqual([
    expect.objectContaining({ severity: "error", evaluation: "failed" }),
  ]);
});

it.each([NaN, Infinity, -1, 0.5])("rejects an invalid clone budget %s before tool execution", async (maxClones) => {
  const root = await createFixture({});
  expect(await duplicationBudget.run({ root, duplication: { maxClones } })).toEqual([
    expect.objectContaining({ severity: "error", evaluation: "failed" }),
  ]);
});
