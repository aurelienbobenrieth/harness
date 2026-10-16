/**
 * Keeps marked blocks of an always-loaded agent instructions file (AGENTS.md) identical to their source,
 * so a rule every reply must follow is loaded each turn and still written once.
 */
import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { readTextFile } from "../fs-support.js";

const docs = "https://github.com/aurelienbobenrieth/harness/tree/main/packages/conformance-core#instruction-blocks";

const normalize = (text: string) => text.replaceAll("\r\n", "\n").trim();

/** The text between a block's markers, or why it can't be read. */
function blockContent(instructions: string, name: string): { readonly text: string } | { readonly problem: string } {
  const start = `<!-- harness:${name}:start -->`;
  const end = `<!-- harness:${name}:end -->`;
  const startIndex = instructions.indexOf(start);
  const endIndex = instructions.indexOf(end);
  if (startIndex === -1 && endIndex === -1) return { problem: "has no block" };
  if (endIndex === -1) return { problem: "never closes the block" };
  if (startIndex === -1 || endIndex < startIndex) return { problem: "has an end marker without a start before it" };
  if (instructions.includes(start, startIndex + start.length) || instructions.includes(end, endIndex + end.length))
    return { problem: "repeats the block markers" };
  return { text: instructions.slice(startIndex + start.length, endIndex) };
}

export const instructionBlocks: ConformanceCheck = {
  id: "instruction-blocks",
  description: "Marked blocks in the agent instructions file match their source files exactly.",
  docs,
  async run({ root, instructionBlocks: options }) {
    if (options === undefined) return [];
    const names = Object.keys(options.blocks);
    if (names.length === 0)
      throw new Error("instructionBlocks.blocks is empty; name at least one block and its source.");
    for (const name of names)
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name))
        throw new Error(`instructionBlocks.blocks key "${name}" must be kebab-case.`);

    const file = options.file ?? "AGENTS.md";
    const instructions = await readTextFile(path.join(root, file));
    const finding = (message: string): ConformanceFinding => ({
      check: "instruction-blocks",
      severity: "error",
      message,
      path: file,
      docs,
    });
    if (instructions === undefined)
      return [finding(`${file} is missing; create it and copy each instruction block between its markers.`)];

    const findings: ConformanceFinding[] = [];
    for (const [name, sourcePath] of Object.entries(options.blocks)) {
      const source = await readTextFile(path.join(root, sourcePath));
      if (source === undefined)
        throw new Error(`Block source ${sourcePath} is missing; point instructionBlocks.blocks.${name} at the file.`);
      const markers = `\`<!-- harness:${name}:start -->\` and \`<!-- harness:${name}:end -->\``;
      const block = blockContent(instructions, name);
      if ("problem" in block) {
        findings.push(finding(`${file} ${block.problem} "${name}"; copy ${sourcePath} between ${markers}.`));
        continue;
      }
      if (normalize(block.text) !== normalize(source))
        findings.push(
          finding(`The "${name}" block in ${file} drifted from ${sourcePath}; replace the text between ${markers}.`),
        );
    }
    return findings;
  },
};
