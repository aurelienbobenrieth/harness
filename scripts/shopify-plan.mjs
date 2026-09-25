import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createShopifyReviewPlan } from "./shopify-policy.mjs";

assert.equal(process.argv.length, 3, "Usage: pnpm shopify:plan <profile.json>");
const policy = JSON.parse(await readFile(new URL("../policy/shopify-requirements.json", import.meta.url), "utf8"));
const profile = JSON.parse(await readFile(process.argv[2], "utf8"));
console.log(JSON.stringify(createShopifyReviewPlan(policy, profile), null, 2));
