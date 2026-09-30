/**
 * Decides what `pnpm check` runs: one build, then every validation script, independent of each other.
 * A full scope runs everything; an affected scope narrows only typecheck and unit tests to changed
 * packages and their dependents, because every other check is repo-wide or reads every package's build.
 */

/** Longest first, so the pool starts the critical path immediately. */
const validationScripts = [
  "test:unit",
  "typecheck",
  "quality:check",
  "fmt:check",
  "lint",
  "catalog:check",
  "shopify:check",
  "compatibility:check",
  "test:compatibility-policy",
  "release:check",
  "test:release",
  "skills:check",
  "test:skills",
  "test:consumer-results",
  "test:shopify-policy",
  "test:check-plan",
];

const packageScoped = /^(?:packages|internal)\/[^/]+\//u;
const inert = [/^\.changeset\//u, /^docs\//u, /^skills\//u, /^[^/]+\.md$/u];

/**
 * Tests that load sibling builds by path, invisible to the package graph: a change to any matching
 * package also runs the reader's tests.
 */
const undeclaredReaders = [{ reader: "packages/agentlint-plugin-core", reads: /^packages\/agentlint-plugin-/u }];

/**
 * Classifies changed repository paths. Anything outside a package or the inert documentation
 * paths (root config, workflows, scripts, policy, lockfile, examples) can affect every package.
 * @param {string[]} changedFiles POSIX paths relative to the repository root.
 * @returns {{ kind: "affected" } | { kind: "full", reason: string }}
 */
export function selectScope(changedFiles) {
  const shared = changedFiles.find((file) => !packageScoped.test(file) && !inert.some((path) => path.test(file)));
  return shared === undefined ? { kind: "affected" } : { kind: "full", reason: `${shared} is shared by every package` };
}

/**
 * @param {{ kind: "full", reason: string } | { kind: "affected", base: string, packages: string[] }} scope
 *   `packages` are POSIX package directories selected by `...[base]`: changed packages and their dependents.
 * @returns {{ build: Step, steps: Step[] }} the build runs first; the steps are independent of each other.
 * @typedef {{ name: string, args: string[] } | { name: string, skip: string }} Step pnpm arguments, or a skip reason.
 */
export function planCheck(scope) {
  const steps = validationScripts.map((name) => ({ name, args: ["run", name] }));
  if (scope.kind === "affected") {
    const narrowed = narrow(scope);
    for (const [index, { name }] of steps.entries()) if (narrowed[name]) steps[index] = narrowed[name];
  }
  return { build: { name: "build", args: ["run", "build"] }, steps };
}

function narrow({ base, packages }) {
  if (packages.length === 0)
    return Object.fromEntries(["typecheck", "test:unit"].map((name) => [name, { name, skip: "no package changed" }]));
  const readers = undeclaredReaders
    .filter(({ reader, reads }) => !packages.includes(reader) && packages.some((directory) => reads.test(directory)))
    .map(({ reader }) => reader);
  return {
    typecheck: { name: "typecheck", args: ["--filter", `...[${base}]`, "typecheck"] },
    "test:unit": {
      name: "test:unit",
      args: ["run", "test:unit", ...[...packages, ...readers].map((directory) => `${directory}/`)],
    },
  };
}
