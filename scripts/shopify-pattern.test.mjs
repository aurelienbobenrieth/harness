import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { entriesOf, families, read, renderIndex, skill } from "./shopify-pattern-index.mjs";

/** Every family file as one text; `catalog/_inbox` holds entries not filed yet, so it is left out. */
const familyText = Object.keys(families)
  .map((family) => read(path.join(skill, "catalog", `${family}.md`)))
  .join("\n");
const ids = entriesOf(familyText).map((entry) => entry.id);

/** Every markdown, script and sheet file the skill installs, as one text. */
const skillText = fs
  .readdirSync(skill, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => read(path.join(entry.parentPath, entry.name)))
  .join("\n");

test("the index lists exactly the entries of the family files", () => {
  assert.equal(read(path.join(skill, "catalog.md")), renderIndex(skill), "run pnpm shopify-pattern:index");
});

test("every entry an entry cites exists", () => {
  const cited = [...familyText.matchAll(/`([a-z]+\.[a-z0-9-]+)`/gu)].map((match) => match[1]);
  const dangling = cited.filter((id) => Object.hasOwn(families, id.split(".")[0]) && !ids.includes(id));
  assert.deepEqual([...new Set(dangling)], []);
});

test("the skill names nothing of a project that installs it", () => {
  // What belongs to one app lives in its `.agents/shopify-pattern` folder, so the skill installs unchanged.
  // The names are those of the apps the skill was extracted from.
  const names = [...skillText.matchAll(/keepcart|foldkit|app-bridge-mock|shopify-embedded|^- Ours:/gimu)];
  assert.deepEqual([...new Set(names.map((match) => match[0]))], []);
});

test("every entry has measured values or a recorded reason for none", () => {
  const none = JSON.parse(read(path.join(skill, "sheets", "_none.json")));
  const unmeasured = ids.filter(
    (id) => !fs.existsSync(path.join(skill, "sheets", `${id}.json`)) && !Object.hasOwn(none, id),
  );
  assert.deepEqual(unmeasured, [], "measure the admin with /shopify-pattern measure <entry id>, or record why not");
});
