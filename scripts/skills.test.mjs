import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkSkills, validateSkill } from "./check-skills.mjs";

const source = (body = "Complete the requested task.") =>
  `---\nname: example\ndescription: A focused task skill.\n---\n\n${body}\n`;

function fixture(context, files) {
  const root = mkdtempSync(path.join(os.tmpdir(), "harness-skill-check-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(root, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return root;
}

test("a self-contained skill is automatically discoverable without optional metadata", (context) => {
  const root = fixture(context, { "example/SKILL.md": source() });
  assert.deepEqual(checkSkills(root), [{ name: "example", implicitInvocation: true, files: 1 }]);
});

test("local reference files and sibling skills resolve without requiring a specific prose style", (context) => {
  const root = fixture(context, {
    "example/SKILL.md": source("Use [detail](references/decision.md) or [another skill](../other/SKILL.md)."),
    "example/references/decision.md": "Only load this when the task needs it.",
    "other/SKILL.md": source().replace("name: example", "name: other"),
  });
  assert.equal(checkSkills(root).length, 2);
});

for (const [name, invalid, expected] of [
  ["directory/name mismatch", source().replace("name: example", "name: unrelated"), /name must match/u],
  [
    "empty description",
    source().replace("description: A focused task skill.", 'description: ""'),
    /description must contain/u,
  ],
  ["duplicate YAML fields", source().replace("name: example", "name: example\nname: example"), /unique/u],
  ["unknown frontmatter", source().replace("name: example", "name: example\nmisleading: true"), /unsupported/u],
  ["empty instructions", source(""), /add skill instructions/u],
  ["unfinished scaffold", source("[TODO: complete this]"), /unfinished scaffold/u],
]) {
  test(`rejects ${name}`, () => {
    assert.throws(() => validateSkill({ directory: "example", source: invalid }), expected);
  });
}

test("example placeholders and links inside a code fence are documentation, not dependencies", (context) => {
  const root = fixture(context, {
    "example/SKILL.md": source("Example:\n\n```md\n[TODO: a sample]\n[example](missing.md)\n```"),
  });
  assert.equal(checkSkills(root).length, 1);
});

for (const [name, body, expected] of [
  ["missing inline reference", "Read [detail](missing.md).", /missing linked file/u],
  ["missing reference-style link", "[detail]: missing.md", /missing linked file/u],
  ["escaping reference", "Read [detail](../../outside.md).", /escapes/u],
]) {
  test(`rejects ${name}`, (context) => {
    const root = fixture(context, { "example/SKILL.md": source(body) });
    assert.throws(() => checkSkills(root), expected);
  });
}

test("explicit-only invocation is accepted as metadata, without requiring it for ordinary skills", (context) => {
  const root = fixture(context, {
    "example/SKILL.md": source(),
    "example/agents/openai.yaml": "policy:\n  allow_implicit_invocation: false\n",
  });
  assert.equal(checkSkills(root)[0].implicitInvocation, false);
});

test("a string cannot silently change the invocation policy", (context) => {
  const root = fixture(context, {
    "example/SKILL.md": source(),
    "example/agents/openai.yaml": 'policy:\n  allow_implicit_invocation: "false"\n',
  });
  assert.throws(() => checkSkills(root), /must be a boolean/u);
});

test("empty inventories and incomplete skill directories fail", (context) => {
  const empty = fixture(context, {});
  assert.throws(() => checkSkills(empty), /no skills found/u);
  mkdirSync(path.join(empty, "example"));
  assert.throws(() => checkSkills(empty), /missing SKILL.md/u);
});

test("inline examples with single or multiple backticks do not create link dependencies", (context) => {
  const root = fixture(context, {
    "example/SKILL.md": source("Use `[name](missing.md)` or ``a ` [name](also-missing.md)`` as literal examples."),
  });
  assert.equal(checkSkills(root).length, 1);
});

test("an unmatched backtick does not hide a broken reference", (context) => {
  const root = fixture(context, {
    "example/SKILL.md": source("A stray ` is followed by [detail](missing.md)."),
  });
  assert.throws(() => checkSkills(root), /missing linked file/u);
});

test("a top-level junction cannot bypass the self-contained reference check", (context) => {
  const root = fixture(context, {
    "skills/example/SKILL.md": source("Read [external file](../linked/secret.md)."),
    "outside/secret.md": "This does not belong to the skills bundle.",
  });
  symlinkSync(
    path.join(root, "outside"),
    path.join(root, "skills/linked"),
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.throws(() => checkSkills(path.join(root, "skills")), /symbolic links/u);
});
