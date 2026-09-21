import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseDocument } from "yaml";

const allowedFields = new Set(["name", "description", "license", "compatibility", "allowed-tools", "metadata"]);

function parseMapping(source, label) {
  const document = parseDocument(source, { uniqueKeys: true });
  if (document.errors.length) throw new Error(`${label}: ${document.errors[0].message}`);
  const value = document.toJS({ maxAliasCount: 0 });
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label}: expected a YAML mapping.`);
  return value;
}

/** Validate discovery metadata without pretending to grade behavioral quality. */
export function validateSkill({ directory, source }) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(source);
  if (!match) throw new Error(`${directory}: add YAML frontmatter with name and description.`);
  const metadata = parseMapping(match[1], directory);
  if (metadata.name !== directory || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(metadata.name) || metadata.name.length > 64)
    throw new Error(`${directory}: name must match the kebab-case directory and contain at most 64 characters.`);
  if (typeof metadata.description !== "string" || !metadata.description.trim() || metadata.description.length > 1024)
    throw new Error(`${directory}: description must contain 1 to 1024 characters.`);
  for (const field of Object.keys(metadata))
    if (!allowedFields.has(field)) throw new Error(`${directory}: unsupported frontmatter field ${field}.`);
  const body = source.slice(match[0].length);
  if (!body.trim()) throw new Error(`${directory}: add skill instructions after frontmatter.`);
  if (/^\s*\[TODO:[^\n]*\]\s*$/mu.test(withoutFences(body)))
    throw new Error(`${directory}: replace the unfinished scaffold placeholder.`);
  return { name: metadata.name, description: metadata.description, body };
}

function withoutFences(source) {
  let marker;
  return source
    .split(/\r?\n/u)
    .map((line) => {
      const fence = /^\s*(`{3,}|~{3,})(.*)$/u.exec(line);
      if (fence) {
        if (!marker) marker = fence[1];
        else if (fence[1][0] === marker[0] && fence[1].length >= marker.length && !fence[2].trim()) marker = undefined;
        return "";
      }
      return marker ? "" : line;
    })
    .join("\n");
}

function localLinks(source) {
  const visible = withoutInlineCode(withoutFences(source));
  const inline = [...visible.matchAll(/\[[^\]\n]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\s*\)/gu)];
  const references = [...visible.matchAll(/^\s*\[[^\]\n]+\]:\s*(<[^>]+>|\S+)/gmu)];
  return [...inline, ...references]
    .map((match) => match[1].replace(/^<|>$/gu, ""))
    .filter((target) => !/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/iu.test(target));
}

function withoutInlineCode(source) {
  let result = "";
  let index = 0;
  while (index < source.length) {
    if (source[index] !== "`") {
      result += source[index++];
      continue;
    }
    const start = index;
    while (source[index] === "`") index++;
    const length = index - start;
    let cursor = index;
    let closed = false;
    while (cursor < source.length) {
      if (source[cursor] !== "`") {
        cursor++;
        continue;
      }
      const endStart = cursor;
      while (source[cursor] === "`") cursor++;
      if (cursor - endStart === length) {
        index = cursor;
        result += " ";
        closed = true;
        break;
      }
    }
    if (!closed) result += source.slice(start, index);
  }
  return result;
}

function filesWithin(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`${file}: skills must not depend on symbolic links.`);
    return entry.isDirectory() ? filesWithin(file) : [file];
  });
}

/** Check installed skill structure, local references, and optional invocation metadata. */
export function checkSkills(skillsRoot) {
  const root = path.resolve(skillsRoot);
  const entries = readdirSync(root, { withFileTypes: true });
  for (const entry of entries)
    if (entry.isSymbolicLink())
      throw new Error(`${path.join(root, entry.name)}: skills must not depend on symbolic links.`);
  const directories = entries.filter((entry) => entry.isDirectory());
  if (!directories.length) throw new Error(`${root}: no skills found; an empty inventory cannot pass.`);
  return directories
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((directory) => {
      const folder = path.join(root, directory.name);
      const entrypoint = path.join(folder, "SKILL.md");
      if (!existsSync(entrypoint)) throw new Error(`${directory.name}: missing SKILL.md.`);
      const files = filesWithin(folder);
      const result = validateSkill({
        directory: directory.name,
        source: readFileSync(entrypoint, "utf8"),
      });
      for (const file of files.filter((candidate) => candidate.endsWith(".md"))) {
        for (const link of localLinks(readFileSync(file, "utf8"))) {
          const target = path.resolve(path.dirname(file), decodeURIComponent(link.split(/[?#]/u)[0]));
          const relative = path.relative(root, target);
          if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
            throw new Error(`${file}: local skill link escapes the skills directory: ${link}.`);
          if (!existsSync(target) || !statSync(target).isFile())
            throw new Error(`${file}: missing linked file ${link}.`);
        }
      }
      const openai = path.join(folder, "agents", "openai.yaml");
      let implicitInvocation = true;
      if (existsSync(openai)) {
        const metadata = parseMapping(readFileSync(openai, "utf8"), openai);
        if (metadata.policy !== undefined) {
          if (!metadata.policy || typeof metadata.policy !== "object" || Array.isArray(metadata.policy))
            throw new Error(`${openai}: policy must be a mapping.`);
          if (metadata.policy.allow_implicit_invocation !== undefined) {
            if (typeof metadata.policy.allow_implicit_invocation !== "boolean")
              throw new Error(`${openai}: allow_implicit_invocation must be a boolean.`);
            implicitInvocation = metadata.policy.allow_implicit_invocation;
          }
        }
      }
      return { name: result.name, implicitInvocation, files: files.length };
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const skills = checkSkills(path.resolve(import.meta.dirname, "../skills"));
    console.log(
      `Validated ${skills.length} skills, local references, and invocation metadata. Behavioral quality requires separate evaluation.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
