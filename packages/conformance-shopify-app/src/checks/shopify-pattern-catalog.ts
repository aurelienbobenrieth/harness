import { access } from "node:fs/promises";
import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { listDirectory, readTextFile } from "../fs-support.js";

const id = "shopify-pattern-catalog";
const docs = "https://shopify.dev/docs/apps/design";
const defaultSkill = ".agents/skills/shopify-pattern";
const entryHeading = /^### ([a-z]+\.[a-z0-9-]+): /gmu;
const componentLine = /^- `([a-z]+\.[a-z0-9-]+)`: (?:`([^`]+)`)?/gmu;

/** Normalizes a project-relative folder option to POSIX form without a trailing slash; rejects paths outside the project. */
function projectFolder(root: string, value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`shopifyPattern.${field} must be a nonempty project-relative folder.`);
  const relative = path.relative(path.resolve(root), path.resolve(root, value));
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    throw new Error(`shopifyPattern.${field} must name a folder inside the project.`);
  return relative.replaceAll("\\", "/");
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks the project side of the `shopify-pattern` skill: `components.md` in the project folder names only
 * catalogued entries (the skill's family files plus the project's own `catalog.md`) and existing paths, and every
 * direct child of the components folder appears in one of its paths. Silent unless `shopifyPattern` is set.
 *
 * @attribution https://shopify.dev/docs/apps/design (inspiration: admin-consistent app design; independently implemented)
 */
export const shopifyPatternCatalog: ConformanceCheck = {
  id,
  description:
    "With shopifyPattern set, components.md attaches every custom component to an existing path and a catalogued shopify-pattern entry.",
  docs,
  async run(options) {
    if (options.shopifyPattern === undefined) return [];
    const { root } = options;
    const skill = projectFolder(root, options.shopifyPattern.skill ?? defaultSkill, "skill");
    const project = projectFolder(root, options.shopifyPattern.project, "project");
    const components = projectFolder(root, options.shopifyPattern.components, "components");
    const findings: ConformanceFinding[] = [];
    const report = (file: string, message: string): void => {
      findings.push({ check: id, docs, path: file, severity: "error", message });
    };
    const families = (await listDirectory(path.join(root, skill, "catalog"))).filter(
      (file) => file.endsWith(".md") && !file.startsWith("_"),
    );
    const catalogued = new Set<string>();
    for (const file of [...families.map((family) => `${skill}/catalog/${family}`), `${project}/catalog.md`]) {
      for (const match of ((await readTextFile(path.join(root, file))) ?? "").matchAll(entryHeading))
        catalogued.add(match[1] ?? "");
    }
    if (families.length === 0) {
      report(
        `${skill}/catalog`,
        "No catalog family file found. Install the shopify-pattern skill there, or set shopifyPattern.skill to its folder.",
      );
      return findings;
    }
    const ledger = `${project}/components.md`;
    const text = await readTextFile(path.join(root, ledger));
    if (text === undefined) {
      report(ledger, "components.md is missing. Record which component implements each catalogued entry there.");
      return findings;
    }
    const paths = new Set<string>();
    for (const match of text.matchAll(componentLine)) {
      const entry = match[1] ?? "";
      if (!catalogued.has(entry))
        report(
          ledger,
          `\`${entry}\` names no catalogued entry. Use an id from the skill's or the project's catalog, or write the entry first.`,
        );
      if (match[2] !== undefined) paths.add(match[2]);
    }
    for (const file of paths) {
      if (!(await exists(path.join(root, file))))
        report(ledger, `\`${file}\` does not exist. Point the line at the component's current path.`);
    }
    const children = await listDirectory(path.join(root, components));
    if (children.length === 0)
      report(
        components,
        "The components folder is missing or empty. Set shopifyPattern.components to the folder of custom components.",
      );
    for (const child of children) {
      if (child.startsWith(".")) continue;
      const component = `${components}/${child}`;
      if ([...paths].some((file) => file === component || file.startsWith(`${component}/`))) continue;
      report(
        component,
        `No line in ${ledger} names this component. Look up the admin pattern it reproduces and attach it to that entry, or remove the component.`,
      );
    }
    return findings;
  },
};
