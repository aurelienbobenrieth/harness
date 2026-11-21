/**
 * Maintains the shopify-pattern skill's catalog: files the entries waiting in `catalog/_inbox/` into their
 * family file, then rewrites `catalog.md` from the entry headings. Run `pnpm shopify-pattern:index` after
 * adding or renaming an entry or a sheet; `scripts/shopify-pattern.test.mjs` fails until the index matches.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const skill = path.resolve(import.meta.dirname, "../skills/shopify-pattern");

/** Family order and the one-line goal shown in the index. A new family is added here. */
export const families = {
  index: "browse, find, narrow and act on many records",
  detail: "read one record and act on it",
  form: "create or edit a record",
  settings: "configure how something behaves",
  fields: "give one value",
  actions: "trigger something: buttons, links, menus and their states",
  data: "read numbers and trends",
  onboarding: "get started, learn, connect, upgrade",
  feedback: "know what happened, what is wrong, what something means",
  overlay: "do a short task without leaving the page",
  navigation: "move between places and come back",
  flow: "complete a task that crosses several steps or surfaces",
  chrome: "use the admin frame around the app (host-owned)",
  copy: "read wording that sounds like the admin",
};

const heading = /^### (?<id>(?<family>[a-z]+)\.[a-z0-9-]+): (?<goal>.+)$/u;

export const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8").replaceAll("\r\n", "\n") : "");
const familyFile = (root, family) => path.join(root, "catalog", `${family}.md`);

/** The entries a family file declares, in file order: `{ id, family, goal }`. */
export const entriesOf = (text) =>
  text
    .split("\n")
    .map((line) => heading.exec(line)?.groups)
    .filter(Boolean);

/** The `catalog.md` the family files and sheets of `root` imply. An entry with a sheet is marked `[sheet]`. */
export function renderIndex(root) {
  const lines = [
    "# Catalog index",
    "",
    "Find the merchant's intent, then read the entry in `catalog/<family>.md`. `[sheet]`: the admin's values are in `sheets/<id>.json`; compare with them instead of opening the admin. Generated; do not edit by hand.",
  ];
  for (const [family, goal] of Object.entries(families)) {
    const entries = entriesOf(read(familyFile(root, family)));
    if (entries.length === 0) continue;
    const sheet = (id) => (fs.existsSync(path.join(root, "sheets", `${id}.json`)) ? " [sheet]" : "");
    lines.push(
      "",
      `## ${family}: ${goal}`,
      "",
      ...entries.map((entry) => `- \`${entry.id}\`: ${entry.goal}${sheet(entry.id)}`),
    );
  }
  return `${lines.join("\n")}\n`;
}

/** A block runs from its `### ` heading to the next heading of any level. */
function blocksOf(text) {
  const blocks = [];
  let current;
  for (const line of text.split("\n")) {
    if (/^#{1,3} /u.test(line)) {
      if (current) blocks.push(current);
      const groups = heading.exec(line)?.groups;
      current = groups ? { groups, lines: [line] } : undefined;
    } else current?.lines.push(line);
  }
  if (current) blocks.push(current);
  return blocks;
}

/** Moves inbox entries into their family files; returns the conflicts left in the inbox for a person. */
function fileInbox(root) {
  const inbox = path.join(root, "catalog", "_inbox");
  const problems = [];
  const known = new Set(
    Object.keys(families).flatMap((family) => entriesOf(read(familyFile(root, family))).map((entry) => entry.id)),
  );
  for (const name of fs.existsSync(inbox) ? fs.readdirSync(inbox).filter((file) => file.endsWith(".md")) : []) {
    const file = path.join(inbox, name);
    const text = read(file);
    let rest = text;
    for (const block of blocksOf(text)) {
      const { id, family } = block.groups;
      if (!Object.hasOwn(families, family)) {
        problems.push(`${name}: ${id} names an unknown family`);
        continue;
      }
      if (known.has(id)) {
        problems.push(`${name}: ${id} already exists; merge it by hand`);
        continue;
      }
      const target = familyFile(root, family);
      const before =
        read(target) ||
        `# ${family[0].toUpperCase()}${family.slice(1)}\n\nThe merchant wants to ${families[family]}.\n`;
      fs.writeFileSync(target, `${before.trimEnd()}\n\n${block.lines.join("\n").trimEnd()}\n`);
      known.add(id);
      rest = rest.replace(block.lines.join("\n"), "");
    }
    if (/^#{2,3} /mu.test(rest)) fs.writeFileSync(file, `${rest.trim()}\n`);
    else fs.rmSync(file);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const problems = fileInbox(skill);
  fs.writeFileSync(path.join(skill, "catalog.md"), renderIndex(skill));
  console.log(
    `${Object.keys(families).reduce((total, family) => total + entriesOf(read(familyFile(skill, family))).length, 0)} entries indexed`,
  );
  for (const problem of problems) console.error(`PROBLEM ${problem}`);
  if (problems.length > 0) process.exitCode = 1;
}
