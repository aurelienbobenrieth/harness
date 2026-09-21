import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { validateShopifyPolicy } from "./shopify-policy.mjs";

const root = path.resolve(import.meta.dirname, "..");
const policy = JSON.parse(await readFile(path.join(root, "policy/shopify-requirements.json"), "utf8"));
const summary = validateShopifyPolicy(policy);
const modules = new Map(
  await Promise.all(
    [
      ...new Set(
        Object.values(policy.tools)
          .map((tool) => tool.package)
          .filter(Boolean),
      ),
    ].map(async (name) => [
      name,
      await import(pathToFileURL(path.join(root, "packages", name, "dist/index.mjs")).href),
    ]),
  ),
);
for (const [id, tool] of Object.entries(policy.tools)) {
  if (tool.kind === "upstream") continue;
  const module = modules.get(tool.package);
  if (tool.kind === "export")
    assert.equal(typeof module[tool.member], "function", `${id}: missing public function export`);
  else if (tool.package.startsWith("oxlint-"))
    assert.ok(Object.hasOwn(module.default.rules, tool.member), `${id}: missing registered AST rule`);
  else if (tool.kind === "check")
    assert.ok(
      Object.values(module).some((value) => value?.id === tool.member && typeof value.run === "function"),
      `${id}: missing registered check`,
    );
  else
    assert.ok(
      Object.values(module).some(
        (value) =>
          value?.standard?.id === tool.member &&
          value?.binding?.id === tool.member &&
          typeof value?.detector?.createOnce === "function",
      ),
      `${id}: missing registered agent review rule`,
    );
}
console.log(
  `Validated Shopify coverage: ${JSON.stringify(summary)}. Coverage records are not app acceptance evidence.`,
);
