import { readFile } from "node:fs/promises";
import path from "node:path";
import { Effect } from "effect";
import { expect, it } from "vitest";
import { createFixture } from "../test-support.js";
import { scaffoldHandler } from "./handler.js";
import { ScaffoldCommand } from "./request.js";

it("scaffolds a block and registers it", async () => {
  const root = await createFixture({ "registry.json": JSON.stringify({ primitives: [] }) });
  const result = await Effect.runPromise(
    scaffoldHandler(
      new ScaffoldCommand({ root, kind: "block", id: "content.badge", namespace: "oio", jsonPath: "registry.json" }),
    ),
  );
  expect(result.exitCode).toBe(0);

  const liquid = await readFile(path.join(root, "blocks", "badge.liquid"), "utf8");
  expect(liquid).toContain("{% doc %}");
  expect(liquid).toContain("{% schema %}");
  expect(liquid).toContain('"presets"');

  const registry = JSON.parse(await readFile(path.join(root, "registry.json"), "utf8")) as {
    primitives: readonly { id: string; status: string; path: string }[];
  };
  expect(registry.primitives).toEqual([
    expect.objectContaining({ id: "content.badge", status: "skeleton", path: "blocks/badge.liquid" }),
  ]);
});

it("scaffolds a machine with the namespace id", async () => {
  const root = await createFixture({});
  const result = await Effect.runPromise(
    scaffoldHandler(
      new ScaffoldCommand({ root, kind: "machine", id: "cart.quantity", namespace: "oio", jsonPath: "registry.json" }),
    ),
  );
  expect(result.exitCode).toBe(0);
  const machine = await readFile(path.join(root, "frontend", "features", "quantity", "quantity-machine.ts"), "utf8");
  expect(machine).toContain('id: "oio.quantity"');
});

it("refuses to overwrite existing files", async () => {
  const root = await createFixture({ "blocks/badge.liquid": "existing" });
  const result = await Effect.runPromise(
    scaffoldHandler(
      new ScaffoldCommand({ root, kind: "block", id: "content.badge", namespace: "oio", jsonPath: "registry.json" }),
    ),
  );
  expect(result.exitCode).toBe(2);
  expect(await readFile(path.join(root, "blocks", "badge.liquid"), "utf8")).toBe("existing");
});
