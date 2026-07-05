import { expect, it } from "vitest";
import { routeCoverage } from "./route-coverage.js";
import { createFixture } from "./test-support.js";

it("passes with a custom required set", async () => {
  const root = await createFixture({
    "templates/index.json": "{}",
    "templates/product.json": "{}",
  });
  expect(await routeCoverage.run({ root, requiredTemplates: ["index", "product"] })).toEqual([]);
});

it("reports missing templates", async () => {
  const root = await createFixture({ "templates/index.json": "{}" });
  const findings = await routeCoverage.run({ root, requiredTemplates: ["index", "gift_card", "customers/login"] });
  expect(findings.map((finding) => finding.message)).toEqual([
    expect.stringContaining("templates/gift_card.json is missing"),
    expect.stringContaining("templates/customers/login.json is missing"),
  ]);
});

it("accepts liquid templates and customer routes", async () => {
  const root = await createFixture({
    "templates/gift_card.liquid": "<html></html>",
    "templates/customers/login.json": "{}",
  });
  expect(await routeCoverage.run({ root, requiredTemplates: ["gift_card", "customers/login"] })).toEqual([]);
});
