import { expect, it } from "vitest";
import { dependencyOverlap } from "./dependency-overlap.js";
import { createFixture } from "./test-support.js";

it("reports two members of a known-duplicate family", async () => {
  const root = await createFixture({
    "package.json": JSON.stringify({ dependencies: { dayjs: "1.0.0", moment: "2.0.0" } }),
  });

  const findings = await dependencyOverlap.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.severity).toBe("warning");
  expect(findings[0]?.message).toContain("dayjs");
  expect(findings[0]?.message).toContain("moment");
  expect(findings[0]?.message).toContain("consolidate substitutable ones");
});

it("passes when only one family member is present", async () => {
  const root = await createFixture({
    "package.json": JSON.stringify({ dependencies: { dayjs: "1.0.0", "left-pad": "1.0.0" } }),
  });

  expect(await dependencyOverlap.run({ root })).toEqual([]);
});

it("looks across dependencies and devDependencies", async () => {
  const root = await createFixture({
    "package.json": JSON.stringify({
      dependencies: { axios: "1.0.0" },
      devDependencies: { ky: "1.0.0" },
    }),
  });

  const findings = await dependencyOverlap.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("axios");
  expect(findings[0]?.message).toContain("ky");
});

it("reports one finding per overlapping family", async () => {
  const root = await createFixture({
    "package.json": JSON.stringify({
      dependencies: { dayjs: "1.0.0", moment: "2.0.0", zod: "3.0.0" },
      devDependencies: { yup: "1.0.0" },
    }),
  });

  const findings = await dependencyOverlap.run({ root });
  expect(findings).toHaveLength(2);
});

it("replaces the default families when dependencyOverlapGroups is provided", async () => {
  const root = await createFixture({
    "package.json": JSON.stringify({
      dependencies: { dayjs: "1.0.0", moment: "2.0.0", "left-pad": "1.0.0" },
    }),
  });

  const customGroups = [["left-pad", "pad-left"]];
  expect(await dependencyOverlap.run({ root, dependencyOverlapGroups: customGroups })).toEqual([]);

  const rootWithCustomOverlap = await createFixture({
    "package.json": JSON.stringify({ dependencies: { "left-pad": "1.0.0", "pad-left": "1.0.0" } }),
  });
  const findings = await dependencyOverlap.run({
    root: rootWithCustomOverlap,
    dependencyOverlapGroups: customGroups,
  });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("left-pad");
});

it("allows different deployment packages to choose different libraries", async () => {
  const root = await createFixture({
    "package.json": JSON.stringify({ devDependencies: { dayjs: "1.0.0" } }),
    "pnpm-workspace.yaml": "packages:\n  - packages/*\n  - tools/cli\n",
    "packages/app/package.json": JSON.stringify({ dependencies: { moment: "2.0.0" } }),
    "tools/cli/package.json": JSON.stringify({ dependencies: { luxon: "3.0.0" } }),
  });

  const findings = await dependencyOverlap.run({ root });
  expect(findings).toEqual([]);
});

it("covers the expanded families", async () => {
  const root = await createFixture({
    "package.json": JSON.stringify({
      dependencies: { winston: "3.0.0", pino: "9.0.0", "drizzle-orm": "0.40.0" },
      devDependencies: { kysely: "0.28.0", glob: "11.0.0", tinyglobby: "0.2.0" },
    }),
  });

  const findings = await dependencyOverlap.run({ root });
  expect(findings).toHaveLength(3);
  const messages = findings.map((finding) => finding.message).join("\n");
  expect(messages).toContain("winston");
  expect(messages).toContain("drizzle-orm");
  expect(messages).toContain("tinyglobby");
});
