import { readFile } from "node:fs/promises";
import path from "node:path";
import { Effect } from "effect";
import { expect, it } from "vitest";
import { defaultStatuses } from "../../config.js";
import { createFixture } from "../test-support.js";
import { registryCheckHandler, registrySyncHandler } from "./handler.js";
import { RegistryCheckCommand, RegistrySyncCommand } from "./request.js";

const markdown = `
| ID             | Primitive | Status      |
| -------------- | --------- | ----------- |
| layout.surface | Surface   | implemented |
`;

const baseFields = {
  markdownPath: "docs/registry.md",
  jsonPath: "registry.json",
  statuses: defaultStatuses,
};

it("sync writes registry.json from the markdown", async () => {
  const root = await createFixture({ "docs/registry.md": markdown });
  const result = await Effect.runPromise(registrySyncHandler(new RegistrySyncCommand({ root, ...baseFields })));
  expect(result.exitCode).toBe(0);

  const written = JSON.parse(await readFile(path.join(root, "registry.json"), "utf8")) as {
    primitives: readonly { id: string }[];
  };
  expect(written.primitives).toEqual([{ id: "layout.surface", name: "Surface", status: "implemented" }]);
});

it("check passes when markdown and json agree", async () => {
  const root = await createFixture({
    "docs/registry.md": markdown,
    "registry.json": JSON.stringify({
      primitives: [{ id: "layout.surface", name: "Surface", status: "implemented" }],
    }),
  });
  const result = await Effect.runPromise(
    registryCheckHandler(new RegistryCheckCommand({ root, ...baseFields, minCount: 1 })),
  );
  expect(result.exitCode).toBe(0);
});

it("check reports drift and low counts", async () => {
  const root = await createFixture({
    "docs/registry.md": markdown,
    "registry.json": JSON.stringify({ primitives: [{ id: "layout.surface", status: "proposed" }] }),
  });
  const result = await Effect.runPromise(
    registryCheckHandler(new RegistryCheckCommand({ root, ...baseFields, minCount: 5 })),
  );
  expect(result.exitCode).toBe(1);
  expect(result.lines.join("\n")).toContain("status drift for layout.surface");
  expect(result.lines.join("\n")).toContain("expected at least 5");
});
