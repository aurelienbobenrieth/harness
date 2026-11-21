import { expect, it } from "vitest";
import { shopifyPatternCatalog } from "./shopify-pattern-catalog.js";
import { createFixture } from "./test-support.js";

const folders = { project: ".agents/shopify-pattern", components: "src/components" };

/** A project with the skill's `detail` family installed and a project folder, plus whatever differs by name. */
function project({
  components = "- `detail.timeline`: `src/components/timeline.ts`, iso\n",
  files = {},
}: {
  readonly components?: string;
  readonly files?: Record<string, string>;
} = {}): Promise<string> {
  return createFixture({
    ".agents/skills/shopify-pattern/catalog/detail.md":
      "# Detail\n\n### detail.timeline: follow what happened\n\n- Intent: read events.\n",
    ".agents/shopify-pattern/components.md": `# Our components\n\n${components}`,
    "src/components/timeline.ts": "export {};",
    ...files,
  });
}

it("stays silent unless shopifyPattern is set", async () => {
  const root = await createFixture({ "src/components/orphan.ts": "export {};" });
  expect(await shopifyPatternCatalog.run({ root })).toEqual([]);
});

it("accepts components that each attach to a catalogued entry at an existing path", async () => {
  const root = await project();
  expect(await shopifyPatternCatalog.run({ root, shopifyPattern: folders })).toEqual([]);
});

it("reports a component line that names no catalogued entry", async () => {
  const root = await project({
    components:
      "- `detail.timeline`: `src/components/timeline.ts`, iso\n- `detail.unknown`: `src/components/timeline.ts`, iso\n",
  });
  expect(await shopifyPatternCatalog.run({ root, shopifyPattern: folders })).toEqual([
    expect.objectContaining({
      severity: "error",
      path: ".agents/shopify-pattern/components.md",
      message: expect.stringContaining("`detail.unknown` names no catalogued entry"),
    }),
  ]);
});

it("accepts an entry that the project's own catalog adds", async () => {
  const root = await project({
    components:
      "- `detail.timeline`: `src/components/timeline.ts`, iso\n- `settings.grouped-row`: `src/components/timeline.ts`, gaps: none\n",
    files: { ".agents/shopify-pattern/catalog.md": "### settings.grouped-row: manage items of one kind\n" },
  });
  expect(await shopifyPatternCatalog.run({ root, shopifyPattern: folders })).toEqual([]);
});

it("reports a component path that does not exist", async () => {
  const root = await project({
    components:
      "- `detail.timeline`: `src/components/timeline.ts`, iso\n- `detail.timeline`: `src/components/gone.ts`, iso\n",
  });
  expect(await shopifyPatternCatalog.run({ root, shopifyPattern: folders })).toEqual([
    expect.objectContaining({ message: expect.stringContaining("`src/components/gone.ts` does not exist") }),
  ]);
});

it("reports a custom component that no line attaches to a catalogued pattern", async () => {
  const root = await project({ files: { "src/components/badge/index.ts": "export {};" } });
  const findings = await shopifyPatternCatalog.run({ root, shopifyPattern: folders });
  expect(findings.map((finding) => finding.severity)).toEqual(["error"]);
  expect(findings[0]?.path).toBe("src/components/badge");
});

it("attaches a component folder through any path inside it", async () => {
  const root = await project({
    components:
      "- `detail.timeline`: `src/components/timeline.ts`, iso\n- `detail.timeline`: `src/components/badge/index.ts`, iso\n",
    files: { "src/components/badge/index.ts": "export {};" },
  });
  expect(await shopifyPatternCatalog.run({ root, shopifyPattern: folders })).toEqual([]);
});

it("reports a missing components.md", async () => {
  const root = await createFixture({
    ".agents/skills/shopify-pattern/catalog/detail.md": "### detail.timeline: follow what happened\n",
    "src/components/timeline.ts": "export {};",
  });
  expect(await shopifyPatternCatalog.run({ root, shopifyPattern: folders })).toEqual([
    expect.objectContaining({ path: ".agents/shopify-pattern/components.md" }),
  ]);
});

it("reports a skill folder with no catalog", async () => {
  const root = await project();
  expect(
    await shopifyPatternCatalog.run({ root, shopifyPattern: { ...folders, skill: "skills/shopify-pattern" } }),
  ).toEqual([expect.objectContaining({ path: "skills/shopify-pattern/catalog" })]);
});

it("reports a missing components folder", async () => {
  const root = await project();
  expect(await shopifyPatternCatalog.run({ root, shopifyPattern: { ...folders, components: "src/widgets" } })).toEqual([
    expect.objectContaining({ path: "src/widgets" }),
  ]);
});

it("rejects folders outside the project", async () => {
  const root = await project();
  await expect(
    shopifyPatternCatalog.run({ root, shopifyPattern: { ...folders, components: "../components" } }),
  ).rejects.toThrow("shopifyPattern.components");
});
