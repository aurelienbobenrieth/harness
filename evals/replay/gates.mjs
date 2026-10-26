import path from "node:path";
import { readFile } from "node:fs/promises";
import ts from "typescript-legacy";
import { check, git, overlay } from "./workspace.mjs";
import { mutants, mutantStatus, codecFrameMutant } from "./grade.mjs";

import { isSource } from "./source-paths.mjs";
export { isSource } from "./source-paths.mjs";

const signatures = (sources) => {
  const result = new Set();

  for (const [file, source] of Object.entries(sources)) {
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      if (
        ts.isUnionTypeNode(node) ||
        ((ts.isPropertySignature(node) || ts.isPropertyAssignment(node)) &&
          ["kind", "_tag", "tag", "type"].includes(node.name?.getText(tree)) &&
          (node.type || node.initializer))
      )
        result.add(file + ":" + node.getText(tree));
      ts.forEachChild(node, visit);
    };

    visit(tree);
  }

  return result;
};

/** Compare union and tagged-result declarations rather than making every edit a full type check. */
export function needsTypeCheck(before, after) {
  const previous = signatures(before),
    current = signatures(after);

  return [...previous].some((value) => !current.has(value)) || [...current].some((value) => !previous.has(value));
}

const isTest = (file) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file);

/** Reverse local-import closure includes unchanged preservation suites after extraction. */
export function verificationPlan(sources, changed, extraTests = []) {
  const touched = new Set(changed.filter((file) => isSource(file) && file in sources));
  const affected = new Set(touched);
  const imports = new Map();

  for (const [file, text] of Object.entries(sources)) {
    const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const dependencies = [];
    const visit = (node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const specifier = node.moduleSpecifier.text;

        if (specifier.startsWith(".")) {
          const stem = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
          const bare = stem.replace(/\.[cm]?js$/, "");

          dependencies.push(
            ...[stem, ...[".ts", ".tsx", ".mts", ".cts", "/index.ts", "/index.tsx"].map((ext) => bare + ext)].filter(
              (name) => name in sources,
            ),
          );
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(tree);
    imports.set(file, dependencies);
  }

  for (;;) {
    const before = affected.size;

    for (const [file, dependencies] of imports)
      if (dependencies.some((dependency) => affected.has(dependency))) affected.add(file);
    if (before === affected.size) break;
  }

  const production = [...touched].filter((file) => !isTest(file) && !/\/testing[./]|\.config\./.test(file));
  const owners = new Set(production.map((file) => path.posix.dirname(file)));

  for (const [file, dependencies] of imports)
    if (!isTest(file) && dependencies.some((dependency) => production.includes(dependency)))
      owners.add(path.posix.dirname(file));
  const ownsSuite = (file) =>
    [...owners].some(
      (directory) =>
        path.posix.dirname(file) === directory || path.posix.dirname(file) === path.posix.join(directory, "__tests__"),
    );

  return {
    lint: [...affected].toSorted(),
    tests: [
      ...new Set(
        [...affected]
          .filter((file) => isTest(file) && (touched.has(file) || ownsSuite(file)))
          .concat(extraTests.filter((file) => file in sources && isTest(file))),
      ),
    ].toSorted(),
    production: production.toSorted(),
  };
}

export async function loadSources(cwd) {
  const names = (await git(cwd, "ls-files", "--cached", "--others", "--exclude-standard"))
    .split(/\r?\n/)
    .filter(isSource);
  const sources = {};

  for (const name of new Set(names)) {
    try {
      sources[name] = await readFile(path.join(cwd, name), "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  return sources;
}

/** Green, nonempty suites are a precondition; failures never silently certify coverage. */
export async function mutationGate({ cwd, sources, plan, changedLines, limit = 9, codec, run = check }) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error("mutants must be 1..50");
  const baseline = await run(cwd, "test", plan.tests);

  if (!plan.tests.length || !baseline.pass) return { status: "invalid-baseline", baseline, killed: 0, valid: 0 };
  const candidates = plan.production.flatMap((file) =>
    mutants(file, sources[file])
      .filter((mutant) => !changedLines || changedLines.get(file)?.has(mutant.line))
      .map((mutant) => ({ file, ...mutant })),
  );
  const groups = Map.groupBy(candidates, (mutant) => `${mutant.kind}/${mutant.file}`);
  const sample = [];

  for (let index = 0; sample.length < limit; index++) {
    const next = [...groups.values()].map((group) => group[index]).filter(Boolean);

    if (!next.length) break;
    for (const mutant of next) if (sample.length < limit) sample.push(mutant);
  }

  if (codec && sources[codec]) {
    const source = codecFrameMutant(codec, sources[codec]);

    if (source) sample.push({ file: codec, source, kind: "concat-frame" });
  }

  const results = [];

  for (const mutant of sample) {
    const outcome = await overlay(cwd, { [mutant.file]: mutant.source }, () => run(cwd, "test", plan.tests, 90000));

    results.push({
      file: mutant.file,
      kind: mutant.kind,
      line: mutant.line,
      original: mutant.original,
      replacement: mutant.replacement,
      status: mutantStatus(outcome),
      output: outcome.output?.slice(-6000),
    });
  }

  const killed = results.filter((mutant) => mutant.status === "killed").length;
  const valid = results.filter((mutant) => ["killed", "survived"].includes(mutant.status)).length;

  return {
    status: valid ? "measured" : "no-valid-mutants",
    baseline,
    available: candidates.length,
    sampled: results.length,
    results,
    killed,
    valid,
    survived: results.filter((mutant) => mutant.status === "survived").length,
    invalid: results.filter((mutant) => mutant.status === "invalid").length,
    timedOut: results.filter((mutant) => mutant.status === "timeout").length,
    score: valid ? killed / valid : null,
  };
}
