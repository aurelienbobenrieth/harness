import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { compareShopifySource, createShopifyReviewPlan, validateShopifyPolicy } from "./shopify-policy.mjs";

const policy = JSON.parse(readFileSync(new URL("../policy/shopify-requirements.json", import.meta.url), "utf8"));
test("accounts for every numbered requirement in both reviewed source pages", () => {
  assert.equal(validateShopifyPolicy(policy).requirements, 251);
  assert.equal(policy.sources.find((source) => source.id === "app-store").requirementIds.length, 174);
  assert.equal(policy.sources.find((source) => source.id === "bfs").requirementIds.length, 77);
});

for (const [name, mutate] of [
  ["missing disposition", (copy) => copy.requirements.pop()],
  ["duplicate disposition", (copy) => copy.requirements.push(copy.requirements[0])],
  [
    "unknown protocol",
    (copy) => {
      copy.requirements[0].protocol = "not-a-protocol";
    },
  ],
  [
    "unknown tool",
    (copy) => {
      copy.requirements[0].tools = ["missing-rule"];
    },
  ],
  [
    "wrong category",
    (copy) => {
      copy.requirements[0].category = "payment";
    },
  ],
  [
    "unknown source",
    (copy) => {
      copy.requirements[0].source = "unknown";
    },
  ],
  [
    "missing source hash",
    (copy) => {
      copy.sources[0].sha256 = "";
    },
  ],
  [
    "unreviewed source date",
    (copy) => {
      copy.sources[0].reviewedAt = "2026-08-01";
    },
  ],
  [
    "malformed source date",
    (copy) => {
      copy.sources[0].reviewedAt = "2026-9-30";
    },
  ],
  [
    "unofficial source",
    (copy) => {
      copy.sources[0].url = "https://shopify.dev.example.org/docs";
    },
  ],
  ["duplicate source", (copy) => copy.sources.push(copy.sources[0])],
  [
    "empty source inventory",
    (copy) => {
      copy.sources[0].requirementIds = [];
    },
  ],
])
  test(`rejects ${name}`, () => {
    const copy = structuredClone(policy);
    mutate(copy);
    assert.throws(() => validateShopifyPolicy(copy));
  });

test("accepts a source reviewed after the policy review began", () => {
  const copy = structuredClone(policy);
  copy.sources[0].reviewedAt = "2099-01-01";
  assert.doesNotThrow(() => validateShopifyPolicy(copy));
});

test("unknown applicability includes every category and cannot produce a compliance pass", () => {
  const plan = createShopifyReviewPlan(policy, { programs: ["bfs"] });
  assert.equal(plan.requirements.length, 251);
  assert.equal(plan.status, "unreviewed");
  assert.ok(plan.requirements.every((requirement) => requirement.status === "pending"));
  assert.deepEqual(plan.applicability, { bfs: "all-until-triaged", "app-store": "all-until-triaged" });
});

test("BFS adds App Store prerequisites and independently scopes each program", () => {
  const plan = createShopifyReviewPlan(policy, {
    programs: ["bfs"],
    categories: { bfs: ["discount"], "app-store": ["online-store"] },
  });
  assert.ok(plan.requirements.some((requirement) => requirement.id === "bfs/5.5.2"));
  assert.ok(plan.requirements.some((requirement) => requirement.id === "app-store/5.1.1"));
  assert.ok(plan.requirements.some((requirement) => requirement.id === "app-store/1.1.1"));
  assert.ok(!plan.requirements.some((requirement) => requirement.category === "payment"));
  assert.ok(!plan.requirements.some((requirement) => requirement.category === "carrier"));
});

test("explicit no-category profile keeps all general requirements", () => {
  const plan = createShopifyReviewPlan(policy, { programs: ["app-store"], categories: { "app-store": [] } });
  assert.equal(plan.requirements.length, 67);
  assert.ok(plan.requirements.every((requirement) => requirement.category === "general"));
});

for (const profile of [
  { programs: [] },
  { programs: ["typo"] },
  { programs: ["bfs", "bfs"] },
  { programs: ["bfs"], categories: { bfs: ["typo"] } },
  { programs: ["bfs"], categories: { bfs: ["discount", "discount"] } },
  { programs: ["app-store"], categories: { bfs: [] } },
  { programs: ["app-store"], categoriez: {} },
])
  test(`rejects invalid profile ${JSON.stringify(profile)}`, () =>
    assert.throws(() => createShopifyReviewPlan(policy, profile)));

test("source review detects semantic text drift even with unchanged IDs", () => {
  const markdown = "---\n---\n#### 2.1.1 Metric\nA threshold.\n";
  const source = { id: "bfs", sha256: createHash("sha256").update(markdown).digest("hex"), requirementIds: ["2.1.1"] };
  assert.equal(compareShopifySource(source, markdown.replaceAll("\n", "\r\n")).changed, false);
  assert.equal(compareShopifySource(source, markdown.replace("threshold", "new threshold")).changed, true);
  assert.deepEqual(compareShopifySource(source, "#### 2.1.2 New metric\n").added, ["2.1.2"]);
  assert.deepEqual(compareShopifySource(source, "#### 2.1.2 New metric\n").removed, ["2.1.1"]);
});

test("rejects newly numbered categories without an explicit applicability mapping", () => {
  const copy = structuredClone(policy);
  copy.sources.find((source) => source.id === "bfs").requirementIds.push("5.15.1");
  copy.requirements.push({ id: "bfs/5.15.1", source: "bfs", protocol: "workflow-behavior", tools: [] });
  assert.throws(() => validateShopifyPolicy(copy), /applicability mapping/u);
});

test("rejects empty or colliding guidance identities", () => {
  for (const id of ["", "app-store/1.1.1"]) {
    const copy = structuredClone(policy);
    copy.guidance[0].id = id;
    assert.throws(() => validateShopifyPolicy(copy), /Guidance IDs|collides/u);
  }
});

test("scopes optional guidance by explicit surface while preserving numbered requirements", () => {
  const profile = { programs: ["bfs"], surfaces: ["server"] };
  const plan = createShopifyReviewPlan(policy, profile);
  assert.equal(plan.requirements.length, 251);
  assert.ok(plan.guidance.some((entry) => entry.id === "iframe-protection"));
  assert.ok(!plan.guidance.some((entry) => entry.id === "component-button"));
  assert.throws(() => createShopifyReviewPlan(policy, { programs: ["bfs"], surfaces: ["typo"] }), /surfaces/u);
  assert.throws(
    () => createShopifyReviewPlan(policy, { programs: ["bfs"], surfaces: ["server", "server"] }),
    /surfaces/u,
  );
});
