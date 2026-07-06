import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { createContext, createNode } from "../test-support.js";
import { defineRegistryDrift } from "./rule.js";

async function registryFixture(paths: readonly string[]): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "registry-drift-"));
  const file = path.join(dir, "registry.json");
  await writeFile(file, JSON.stringify({ primitives: paths.map((entry) => ({ id: entry, path: entry })) }));
  return file;
}

it("reports unregistered enhancers", async () => {
  const registryPath = await registryFixture(["frontend/features/cart/cart-machine.ts"]);
  const rule = defineRegistryDrift({ registryPath });
  const context = createContext({ filename: "frontend/features/cart/cart-enhancer.ts" });
  const visitors = rule.createOnce(context);

  expect(visitors.before?.("frontend/features/cart/cart-enhancer.ts")).toBeUndefined();
  visitors["program"]?.(createNode("program", "export class CartEnhancer {}"));

  expect(context.messages).toEqual([expect.stringContaining("not registered")]);
});

it("accepts registered modules", async () => {
  const registryPath = await registryFixture(["frontend/features/cart/cart-enhancer.ts"]);
  const rule = defineRegistryDrift({ registryPath });
  const context = createContext({ filename: "frontend/features/cart/cart-enhancer.ts" });
  const visitors = rule.createOnce(context);

  visitors.before?.("frontend/features/cart/cart-enhancer.ts");
  visitors["program"]?.(createNode("program", "export class CartEnhancer {}"));

  expect(context.messages).toEqual([]);
});

it("skips files outside the delivery pattern and tests", async () => {
  const registryPath = await registryFixture([]);
  const rule = defineRegistryDrift({ registryPath });
  const context = createContext({ filename: "frontend/entrypoints/theme.ts" });
  const visitors = rule.createOnce(context);

  expect(visitors.before?.("frontend/entrypoints/theme.ts")).toBe(false);
  expect(visitors.before?.("frontend/features/cart/cart-enhancer.test.ts")).toBe(false);
});
