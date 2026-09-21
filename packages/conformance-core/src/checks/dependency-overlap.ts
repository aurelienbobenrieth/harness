/**
 * Flags dependency families where more than one interchangeable package is
 * installed (for example dayjs and moment side by side).
 *
 * @attribution code-slop by asyrafhussin (MIT, concept re-implemented)
 */
import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { isRecord, parseJson, readTextFile } from "../fs-support.js";
import { workspacePackageJsonPaths } from "../workspace-support.js";

const docs = "https://github.com/aurelienbobenrieth/harness/tree/main/packages/conformance-core#dependency-overlap";

const defaultGroups: readonly (readonly string[])[] = [
  ["dayjs", "date-fns", "moment", "luxon"],
  ["axios", "got", "ky", "node-fetch", "superagent"],
  ["uuid", "nanoid", "cuid", "cuid2", "@paralleldrive/cuid2", "ulid"],
  ["zod", "yup", "joi", "ajv", "superstruct", "valibot", "arktype"],
  ["lodash", "lodash-es", "ramda", "remeda", "es-toolkit"],
  ["chalk", "picocolors", "kleur", "colorette", "ansis"],
  ["dotenv", "dotenv-flow"],
  ["jest", "vitest"],
  ["winston", "pino", "bunyan", "loglevel", "consola"],
  ["glob", "fast-glob", "globby", "tinyglobby"],
  ["commander", "yargs", "cac", "citty", "meow"],
  ["inquirer", "@inquirer/prompts", "prompts", "@clack/prompts", "enquirer"],
  ["p-limit", "p-queue", "p-map", "promise-pool", "@supercharge/promise-pool"],
  ["yaml", "js-yaml"],
  ["papaparse", "csv-parse", "fast-csv"],
  ["prisma", "drizzle-orm", "kysely", "knex", "typeorm", "sequelize"],
  ["ws", "socket.io"],
  ["immer", "mutative"],
  ["zustand", "jotai", "valtio", "@xstate/store"],
  ["fs-extra", "graceful-fs"],
  ["semver", "compare-versions"],
  ["marked", "markdown-it", "remark", "micromark"],
  ["cheerio", "parse5", "linkedom", "node-html-parser"],
  ["execa", "zx", "tinyexec"],
  ["rimraf", "del"],
  ["cross-env", "env-cmd"],
  ["nodemon", "tsx-watch", "watchexec"],
  ["mime", "mime-types"],
  ["deepmerge", "defu", "ts-deepmerge"],
  ["query-string", "qs"],
];

function dependencyNames(manifest: unknown): readonly string[] {
  if (!isRecord(manifest)) return [];
  const names: string[] = [];
  for (const key of ["dependencies", "devDependencies"]) {
    const section = manifest[key];
    if (isRecord(section)) names.push(...Object.keys(section));
  }
  return names;
}

export const dependencyOverlap: ConformanceCheck = {
  id: "dependency-overlap",
  description: "Only one package per known-duplicate dependency family may be installed.",
  docs,
  async run({ root, dependencyOverlapGroups }) {
    const groups = dependencyOverlapGroups ?? defaultGroups;
    const packageJsonPaths = [path.join(root, "package.json"), ...(await workspacePackageJsonPaths(root))];

    const findings: ConformanceFinding[] = [];
    for (const packageJsonPath of packageJsonPaths) {
      const manifest = parseJson(await readTextFile(packageJsonPath));
      const relativePath = path.relative(root, packageJsonPath).replaceAll(path.sep, "/") || "package.json";
      const names = new Set(dependencyNames(manifest));
      for (const group of groups) {
        const present = group.filter((name) => names.has(name));
        if (present.length <= 1) continue;
        findings.push({
          check: "dependency-overlap",
          severity: dependencyOverlapGroups === undefined ? "warning" : "error",
          message: `Review overlapping dependencies in ${relativePath}: ${present.join(", ")}. Keep complementary tools; consolidate substitutable ones.`,
          path: relativePath,
          docs,
        });
      }
    }
    return findings;
  },
};
