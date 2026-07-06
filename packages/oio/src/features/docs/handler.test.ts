import { readFile } from "node:fs/promises";
import path from "node:path";
import { Effect } from "effect";
import { expect, it } from "vitest";
import { createFixture } from "../test-support.js";
import { docsBuildHandler } from "./handler.js";
import { DocsBuildCommand } from "./request.js";

it("generates the catalog, event docs, and llms.txt", async () => {
  const root = await createFixture({
    "registry.json": JSON.stringify({
      primitives: [
        {
          id: "content.badge",
          status: "implemented",
          surface: "merchant",
          delivery: "block",
          path: "blocks/badge.liquid",
        },
        { id: "layout.modal", status: "implemented", surface: "internal", delivery: "snippet", via: "layout.surface" },
      ],
    }),
    "blocks/badge.liquid": "{% doc %}\n  Renders a badge.\n{% enddoc %}<span></span>",
    "events.json": JSON.stringify({ events: [{ name: "oio:cart:error", source: "theme", detail: "cart failed" }] }),
  });

  const result = await Effect.runPromise(
    docsBuildHandler(
      new DocsBuildCommand({ root, jsonPath: "registry.json", eventsPath: "events.json", outputDir: "docs/generated" }),
    ),
  );
  expect(result.exitCode).toBe(0);

  const catalog = await readFile(path.join(root, "docs", "generated", "primitives.md"), "utf8");
  expect(catalog).toContain("| content.badge | block | implemented | `blocks/badge.liquid` | Renders a badge. |");
  expect(catalog).toContain("via `layout.surface`");

  const events = await readFile(path.join(root, "docs", "generated", "events.md"), "utf8");
  expect(events).toContain("`oio:cart:error`");

  const llms = await readFile(path.join(root, "llms.txt"), "utf8");
  expect(llms).toContain("registry.json (2 entries, 2 implemented, 1 merchant-facing)");
});

it("fails without a registry", async () => {
  const root = await createFixture({});
  const result = await Effect.runPromise(
    docsBuildHandler(
      new DocsBuildCommand({ root, jsonPath: "registry.json", eventsPath: undefined, outputDir: "docs/generated" }),
    ),
  );
  expect(result.exitCode).toBe(2);
});
