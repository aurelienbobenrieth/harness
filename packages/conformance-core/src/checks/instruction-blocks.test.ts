import { expect, it } from "vitest";
import { instructionBlocks } from "./instruction-blocks.js";
import { createFixture } from "./test-support.js";

const source = "## Communication\n\n- Line one answers.\n";
const agents = (body: string) =>
  `# AGENTS.md\n\n<!-- harness:communication:start -->\n\n${body}\n<!-- harness:communication:end -->\n`;
const options = { blocks: { communication: "skills/communication/core.md" } };

it("passes when the block matches its source, ignoring line endings and surrounding blank lines", async () => {
  const root = await createFixture({
    "skills/communication/core.md": source,
    "AGENTS.md": agents(source).replaceAll("\n", "\r\n"),
  });

  expect(await instructionBlocks.run({ root, instructionBlocks: options })).toEqual([]);
});

it("reports a block whose text drifted from the source", async () => {
  const root = await createFixture({
    "skills/communication/core.md": source,
    "AGENTS.md": agents("## Communication\n\n- Line one answers, usually.\n"),
  });

  const findings = await instructionBlocks.run({ root, instructionBlocks: options });
  expect(findings).toEqual([
    expect.objectContaining({ severity: "error", path: "AGENTS.md", message: expect.stringContaining("drifted") }),
  ]);
  expect(findings[0]?.message).toContain("skills/communication/core.md");
});

it.each([
  ["no markers", "# AGENTS.md\n", "has no block"],
  ["an unclosed block", "<!-- harness:communication:start -->\nx\n", "never closes"],
  [
    "an end before the start",
    "<!-- harness:communication:end -->\n<!-- harness:communication:start -->\n",
    "without a start",
  ],
  ["two copies", `${agents(source)}${agents(source)}`, "repeats"],
])("reports %s", async (_case, instructions, expected) => {
  const root = await createFixture({ "skills/communication/core.md": source, "AGENTS.md": instructions });

  const findings = await instructionBlocks.run({ root, instructionBlocks: options });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain(expected);
  expect(findings[0]?.message).toContain("<!-- harness:communication:start -->");
});

it("reports a missing instructions file and reads a custom one", async () => {
  const root = await createFixture({ "skills/communication/core.md": source, "CLAUDE.md": agents(source) });

  const missing = await instructionBlocks.run({ root, instructionBlocks: options });
  expect(missing[0]?.message).toContain("AGENTS.md is missing");
  expect(await instructionBlocks.run({ root, instructionBlocks: { ...options, file: "CLAUDE.md" } })).toEqual([]);
});

it("leaves blocks it was not told about alone", async () => {
  const root = await createFixture({
    "skills/communication/core.md": source,
    "AGENTS.md": `${agents(source)}<!-- harness:other:start -->\nanything\n<!-- harness:other:end -->\n`,
  });

  expect(await instructionBlocks.run({ root, instructionBlocks: options })).toEqual([]);
});

it.each([
  ["no blocks", {}, /empty/u],
  ["a non-kebab name", { Communication: "core.md" }, /kebab-case/u],
  ["a missing source", { communication: "missing.md" }, /missing\.md is missing/u],
])("rejects options with %s", async (_case, blocks, expected) => {
  const root = await createFixture({ "AGENTS.md": agents(source) });

  await expect(instructionBlocks.run({ root, instructionBlocks: { blocks } })).rejects.toThrow(expected);
});

it("does nothing when unconfigured", async () => {
  const root = await createFixture({});

  expect(await instructionBlocks.run({ root })).toEqual([]);
});
