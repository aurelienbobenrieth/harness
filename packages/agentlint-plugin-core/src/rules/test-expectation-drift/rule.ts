/**
 * Flags test files whose existing expectations were deleted, loosened, skipped or re-valued in a change.
 *
 * The party that wrote the change is the party tempted to accept this finding, so the binding defaults to
 * `authority: "human"`. Change detectors see text only: every signal is derived from diff hunks.
 *
 * @attribution ImpossibleBench (arXiv 2510.20270) (concept: passing by editing the oracle)
 * @attribution "Characterization Testing" by Michael Feathers (concept)
 */
import { type ChangedFile, type ChangeHunk, type ChangeRule, defineRule } from "@aurelienbbn/agentlint";
import {
  matches,
  serializePattern,
  sourceFileGlobs,
  testFilePattern as defaultTestFilePattern,
} from "../judgment-support.js";

const defaultAssertionPattern = /\bexpect\s*\(|\bfc\.assert\s*\(|\bassert(?:\.\w+)?\s*\(/;
const defaultMaxEvidenceLines = 20;

const testLinePattern = /^\s*(?:it|test)(?:\.\w+)*\s*\(/;
const disabledPattern = /\b(?:it|test|describe)\.(?:skip|todo|fails)\b|\bx(?:it|test|describe)\s*\(/;
const snapshotFilePattern = /\.snap$/;
const declarationFilePattern = /\.d\.[cm]?ts$/;
const testSupportPathPattern = /(?:^|\/)(?:__tests__|__mocks__|__fixtures__|__snapshots__)\//;
const wildcardPattern = /\bexpect\.(?:any|anything|objectContaining|arrayContaining)\s*\(/g;
const inlineSnapshotOpenPattern = /\btoMatchInlineSnapshot\s*\(\s*`[^`]*$/;
const matcherTailPattern = /^((?:\s*\.\s*(?:not|resolves|rejects))*)\s*\.\s*(\w+)\s*\(/;

const matcherRank: Readonly<Record<string, number>> = {
  toStrictEqual: 3,
  toEqual: 2,
  toBe: 2,
  toMatchObject: 1,
  toHaveProperty: 0,
  toContain: 0,
  toBeDefined: 0,
  toBeTruthy: 0,
};

export type TestExpectationDriftOptions = {
  /** Who may accept a finding. Default: `"human"`, because the author of the change is the tempted party. */
  readonly authority?: "agent" | "human";
  /** Pattern matching test file paths. Snapshot files (`*.snap`) are always treated as test artefacts. */
  readonly testFilePattern?: RegExp;
  /** Pattern matching a line that carries an assertion. */
  readonly assertionPattern?: RegExp;
  /** Cap on the removed and added lines kept as evidence. Default: 20 */
  readonly maxEvidenceLines?: number;
};

type Expectation = { readonly prefix: string; readonly matcher: string; readonly args: string };

type Moves = { readonly out: Map<string, Map<string, number>>; readonly into: Map<string, number> };

type FileSignals = {
  readonly file: ChangedFile;
  readonly kinds: Set<string>;
  readonly removed: string[];
  readonly added: string[];
  firstLine: number | undefined;
};

function normalize(content: string): string {
  return content.trim().replace(/\s+/g, " ");
}

/** Splits `expect(subject).not.toBe(expected)` into the text up to the matcher, the matcher and its argument text. */
function parseExpectation(line: string): Expectation | undefined {
  const start = line.search(/\bexpect\s*\(/);
  if (start < 0) return undefined;
  let depth = 0;
  let quote: string | undefined;
  for (let index = line.indexOf("(", start); index < line.length; index++) {
    const character = line[index];
    if (quote) {
      if (character === "\\") index++;
      else if (character === quote) quote = undefined;
    } else if (character === '"' || character === "'" || character === "`") quote = character;
    else if (character === "(") depth++;
    else if (character === ")" && --depth === 0) {
      const tail = matcherTailPattern.exec(line.slice(index + 1));
      if (!tail) return undefined;
      return {
        prefix: line.slice(0, index + 1) + (tail[1] ?? "").replace(/\s+/g, ""),
        matcher: tail[2] ?? "",
        args: line.slice(index + 1 + tail[0].length),
      };
    }
  }
  return undefined;
}

function wildcards(text: string): number {
  return [...text.matchAll(wildcardPattern)].length;
}

function stem(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  return base.replace(/\.[cm]?[jt]sx?$/, "").replace(/\.(?:test|spec)$/, "");
}

/** One-based old-side line numbers that sit inside a multi-line inline snapshot body. */
function inlineSnapshotLines(content: string | undefined): ReadonlySet<number> {
  const inside = new Set<number>();
  let open = false;
  for (const [index, line] of (content ?? "").split(/\r?\n/).entries()) {
    if (open) {
      if (line.includes("`")) open = false;
      else inside.add(index + 1);
    } else if (inlineSnapshotOpenPattern.test(line)) open = true;
  }
  return inside;
}

function take(pool: Map<string, number>, line: string): boolean {
  const count = pool.get(line) ?? 0;
  if (count === 0) return false;
  pool.set(line, count - 1);
  return true;
}

function pooled(lines: readonly string[]): Map<string, number> {
  const pool = new Map<string, number>();
  for (const line of lines) pool.set(line, (pool.get(line) ?? 0) + 1);
  return pool;
}

export function defineTestExpectationDrift(options: TestExpectationDriftOptions = {}): ChangeRule {
  options = structuredClone(options);
  const testFilePattern = options.testFilePattern ?? defaultTestFilePattern;
  const assertionPattern = options.assertionPattern ?? defaultAssertionPattern;
  const maxEvidenceLines = options.maxEvidenceLines ?? defaultMaxEvidenceLines;
  if (!Number.isSafeInteger(maxEvidenceLines) || maxEvidenceLines < 1)
    throw new Error("test-expectation-drift: maxEvidenceLines must be a positive integer.");

  const isSnapshot = (path: string): boolean => snapshotFilePattern.test(path);
  const isTest = (path: string): boolean => isSnapshot(path) || matches(testFilePattern, path);
  const isTracked = (line: string): boolean => matches(assertionPattern, line) || testLinePattern.test(line);
  const linesOf = (hunk: ChangeHunk, kind: "addition" | "deletion"): string[] =>
    hunk.lines.filter((line) => line.kind === kind).map((line) => normalize(line.content));

  function snapshotSignals(signals: FileSignals, sourceTouched: boolean): void {
    if (!sourceTouched || signals.file.status === "deleted") return;
    for (const hunk of signals.file.hunks) {
      const deleted = linesOf(hunk, "deletion").filter((line) => line !== "");
      if (deleted.length === 0) continue;
      signals.kinds.add("snapshot-rewritten");
      signals.removed.push(...deleted);
      signals.added.push(...linesOf(hunk, "addition").filter((line) => line !== ""));
      signals.firstLine ??= hunk.newStart;
    }
  }

  function testSignals(signals: FileSignals, sourceTouched: boolean, moves: Moves): void {
    const { file } = signals;
    const snapshotBody = inlineSnapshotLines(file.before?.content);
    const movedOut = moves.out.get(file.path) ?? new Map<string, number>();
    let removedAssertions = 0;
    let addedAssertions = 0;
    let removedTests = 0;
    let addedTests = 0;
    let disabled = 0;

    for (const hunk of file.hunks) {
      const deleted = linesOf(hunk, "deletion").filter((line) => !take(movedOut, line));
      const added = linesOf(hunk, "addition").filter((line) => !take(moves.into, line));
      const unpaired = [...added];
      let offending = false;

      for (const line of deleted) {
        if (testLinePattern.test(line)) {
          removedTests++;
          continue;
        }
        if (!matches(assertionPattern, line)) continue;
        removedAssertions++;
        const before = parseExpectation(line);
        const index = before
          ? unpaired.findIndex((candidate) => parseExpectation(candidate)?.prefix === before.prefix)
          : -1;
        const counterpart = index < 0 ? undefined : unpaired.splice(index, 1)[0];
        const after = counterpart === undefined ? undefined : parseExpectation(counterpart);
        if (!before || !after || counterpart === undefined) continue;
        const fromRank = matcherRank[before.matcher];
        const toRank = matcherRank[after.matcher];
        const downgraded =
          (fromRank !== undefined && toRank !== undefined && toRank < fromRank) ||
          (before.matcher === "toBe" && after.matcher === "toBeCloseTo") ||
          wildcards(counterpart) > wildcards(line);
        const revalued = !downgraded && before.matcher === after.matcher && before.args !== after.args && sourceTouched;
        if (!downgraded && !revalued) continue;
        signals.kinds.add(downgraded ? "matcher-downgraded" : "expectation-revalued");
        offending = true;
      }

      for (const line of added) {
        if (testLinePattern.test(line)) addedTests++;
        else if (matches(assertionPattern, line)) addedAssertions++;
      }
      const newlyDisabled = added.filter((line) => disabledPattern.test(line));
      disabled += newlyDisabled.length - deleted.filter((line) => disabledPattern.test(line)).length;

      let oldLine = hunk.oldStart;
      for (const line of hunk.lines) {
        if (line.kind === "addition") continue;
        if (line.kind === "deletion" && snapshotBody.has(oldLine) && sourceTouched) {
          signals.kinds.add("snapshot-rewritten");
          signals.removed.push(normalize(line.content));
          offending = true;
        }
        oldLine++;
      }

      const lost = deleted.filter(isTracked);
      const gained = added.filter(isTracked);
      if (lost.length > gained.length || newlyDisabled.length > 0) offending = true;
      if (offending) signals.firstLine ??= hunk.newStart;
      signals.removed.push(...lost);
      if (lost.length > 0 || newlyDisabled.length > 0) signals.added.push(...gained);
    }

    if (removedAssertions - addedAssertions >= 1) signals.kinds.add("assertion-removed");
    if (removedTests > addedTests) signals.kinds.add("test-removed");
    if (disabled > 0) signals.kinds.add("disabled");
    if (file.status === "deleted" && (removedAssertions > 0 || removedTests > 0 || file.hunks.length === 0))
      signals.kinds.add("test-removed");
  }

  /** Pure-move discount: a deleted assertion or test line that reappears verbatim anywhere in the change leaves both sides. */
  function findMoves(tests: readonly ChangedFile[]): Moves {
    const pool = pooled(
      tests.flatMap((file) => file.hunks.flatMap((hunk) => linesOf(hunk, "addition"))).filter(isTracked),
    );
    const out = new Map<string, Map<string, number>>();
    const into = new Map<string, number>();
    for (const file of tests) {
      const moved: string[] = [];
      for (const hunk of file.hunks)
        for (const line of linesOf(hunk, "deletion")) if (isTracked(line) && take(pool, line)) moved.push(line);
      out.set(file.path, pooled(moved));
      for (const line of moved) into.set(line, (into.get(line) ?? 0) + 1);
    }
    return { out, into };
  }

  return defineRule({
    lifecycle: "change",
    standard: {
      id: "core/test-expectation-drift",
      revision: 1,
      title: "Test Expectation Drift",
      summary:
        "Flags test files whose existing expectations were deleted, loosened, skipped or re-valued in the same change, so the behaviour change is declared rather than absorbed.",
      guidance: {
        standard:
          "An existing expectation is a recorded decision about behaviour. A change that needs a different expectation is a behaviour change and says so somewhere a reviewer can point to; a change that did not intend one repairs the code, not the test. Moving or strengthening expectations is free.",
        checks: [
          "Classify each removed expectation in the evidence: moved (same subject and expected value reappear elsewhere; cite the line), strengthened (partial to exact, fields added), weakened (exact to partial or existence, literal to wildcard, case deleted, test skipped), or re-valued (same matcher, new expected value). Moved and strengthened pass.",
          "Weakened fails, unless the removed assertion pinned an implementation detail (call order, internal spy) and an outcome assertion for the same behaviour remains; cite it.",
          "Re-valued passes only when the behaviour change is stated where the reviewer can point: task or PR description, commit message, changeset, or a changed spec or doc line. Without a pointer it fails as an undeclared behaviour change: restore the expectation and repair the code.",
          "A regenerated snapshot passes only when its semantic differences are listed and each is covered by the declared change. A snapshot too large to read fails.",
          "Passes when the old expectation contradicted the documented contract (cite the contract), when generated fixtures were refreshed by a declared generator run, or when the test went away with the feature it covered in the same change.",
        ],
        examples: [
          {
            label: "FAIL",
            description:
              "The rounding code changed and the test was re-valued to match, with no declared behaviour change.",
            code: "- expect(lineTotal(cart)).toBe(12.06);\n+ expect(lineTotal(cart)).toBe(12.05);",
          },
          {
            label: "PASS",
            description: "The expectation became exact; nothing was lost.",
            code: '- expect(receipt).toMatchObject({ id: "r1" });\n+ expect(receipt).toEqual({ id: "r1", total: 30, currency: "EUR" });',
          },
        ],
        refs: [
          { type: "skill", id: "testing" },
          {
            type: "url",
            href: "https://blog.cleancoder.com/uncle-bob/2017/10/03/TestContravariance.html",
          },
          { type: "url", href: "https://michaelfeathers.silvrback.com/characterization-testing" },
          { type: "url", href: "https://testdesiderata.com/" },
          { type: "url", href: "https://www.hyrumslaw.com/" },
          { type: "url", href: "https://arxiv.org/abs/2510.20270" },
          { type: "url", href: "https://kentcdodds.com/blog/effective-snapshot-testing" },
        ],
      },
    },
    binding: {
      id: "core/test-expectation-drift",
      authority: options.authority ?? "human",
      include: [...sourceFileGlobs, "**/*.snap"],
      exclude: ["**/*.d.ts"],
      options: {
        authority: options.authority ?? null,
        testFilePattern: serializePattern(options.testFilePattern),
        assertionPattern: serializePattern(options.assertionPattern),
        maxEvidenceLines: options.maxEvidenceLines ?? null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            before: {
              "src/price.ts": "export const total = (a: number) => a * 1.2;\n",
              "src/price.test.ts": 'it("adds tax", () => {\n  expect(total(10)).toBe(12);\n});\n',
            },
            after: {
              "src/price.ts": "export const total = (a: number) => a * 1.25;\n",
              "src/price.test.ts": 'it("adds tax", () => {\n  expect(total(10)).toBe(12.5);\n});\n',
            },
          },
          {
            before: {
              "src/order.test.ts": 'it("builds", () => {\n  expect(order).toEqual({ id: "o1", total: 3 });\n});\n',
            },
            after: {
              "src/order.test.ts": 'it("builds", () => {\n  expect(order).toMatchObject({ id: "o1" });\n});\n',
            },
          },
        ],
        mustStaySilent: [
          {
            before: {
              "src/price.test.ts": 'it("adds tax", () => {\n  expect(total(10)).toBe(12);\n});\n',
            },
            after: {
              "src/price.test.ts": 'it("adds tax", () => {\n  expect(total(10)).toBe(12.5);\n});\n',
            },
          },
          {
            before: {
              "src/price.test.ts": 'it("adds tax", () => {\n  expect(total(10)).toBe(12);\n});\n',
            },
            after: {
              "src/price.test.ts":
                'it("adds tax", () => {\n  expect(total(10)).toBe(12);\n  expect(total(0)).toBe(0);\n});\n',
            },
          },
        ],
      },
      id: "core/test-expectation-drift",
      version: 1,
      detect({ context }) {
        const files = context.change.files;
        const tests = files.filter((file) => isTest(file.path));
        const sources = files.filter(
          (file) =>
            !isTest(file.path) && !declarationFilePattern.test(file.path) && !testSupportPathPattern.test(file.path),
        );
        const sourceTouched = sources.some((file) => file.status !== "added");
        const retiredStems = new Set(
          sources
            .filter((file) => file.status === "deleted" || file.status === "renamed")
            .map((file) => stem(file.previousPath ?? file.path)),
        );
        const moves = findMoves(tests.filter((file) => !isSnapshot(file.path)));

        for (const file of tests) {
          if (file.status === "added") continue;
          if (file.status === "modified" && file.hunks.length === 0)
            throw new Error(`Missing change snapshot: ${file.path}`);
          if (file.status === "deleted" && retiredStems.has(stem(file.path))) continue;

          const signals: FileSignals = {
            file,
            kinds: new Set(),
            removed: [],
            added: [],
            firstLine: undefined,
          };
          if (isSnapshot(file.path)) snapshotSignals(signals, sourceTouched);
          else testSignals(signals, sourceTouched, moves);
          if (signals.kinds.size === 0) continue;

          const kinds = [...signals.kinds].toSorted();
          const line = Math.max(1, signals.firstLine ?? 1);
          context.report({
            key: "expectation-drift",
            file: file.path,
            lineageKey: file.path,
            message: `Existing expectations changed here (${kinds.join(", ")}): point to the declared behaviour change, or restore the expectation and repair the code.`,
            evidence: {
              kinds,
              removed: [...new Set(signals.removed)].toSorted().slice(0, maxEvidenceLines),
              added: [...new Set(signals.added)].toSorted().slice(0, maxEvidenceLines),
            },
            startLine: line,
            endLine: line,
          });
        }
      },
    },
  });
}

export const testExpectationDrift = defineTestExpectationDrift();
