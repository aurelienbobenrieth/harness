import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compareShopifySource, validateShopifyPolicy } from "./shopify-policy.mjs";

assert.equal(process.argv.length, 2, "Usage: pnpm shopify:sources");
const policy = JSON.parse(await readFile(new URL("../policy/shopify-requirements.json", import.meta.url), "utf8"));
validateShopifyPolicy(policy);
const results = await Promise.allSettled(
  policy.sources.map(async (source) => {
    const response = await fetch(`${source.url}.md`, { signal: AbortSignal.timeout(30_000), redirect: "error" });
    assert.ok(response.ok, `${source.id}: HTTP ${response.status}`);
    const markdown = await response.text();
    assert.ok(
      markdown.startsWith("---\n") || markdown.startsWith("---\r\n"),
      `${source.id}: expected Shopify Markdown`,
    );
    return compareShopifySource(source, markdown);
  }),
);
let changed = false;
for (const result of results) {
  if (result.status === "rejected") {
    console.error(String(result.reason));
    changed = true;
  } else {
    console.log(JSON.stringify(result.value));
    changed ||= result.value.changed;
  }
}
if (changed) {
  console.error("Review changed or unavailable Shopify sources before updating the policy. No snapshot was rewritten.");
  process.exitCode = 1;
}
