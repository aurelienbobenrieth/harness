/**
 * Schedules review when the same newly written decision token is spread across several production files.
 *
 * @attribution https://alexn.org/blog/2026/09/22/ai-has-no-wisdom-and-neither-will-you/ (inspiration; independently implemented)
 */
import { defineRule, type ChangeRule } from "@aurelienbbn/agentlint";
import { matches, serializePattern } from "../judgment-support-b.js";

const defaultTokenPattern = /["'`]([A-Za-z][A-Za-z0-9_.:-]{3,})["'`]/g;
const ignoredPathPattern =
  /(?:^|\/)(?:dist|build|coverage|vendor|generated|__snapshots__)(?:\/|$)|(?:^|\/)(?:pnpm-lock|package-lock|yarn\.lock)|\.(?:test|spec)\.[cm]?[jt]sx?$/;
const ignoredLinePattern = /^\s*(?:import|export\s+.*\sfrom\s|\/\/|\*)/;
const ignoredTokens = new Set(["use strict", "node:module"]);

export type ChangeScatterReviewOptions = {
  /** Number of production files that must add the same token. Default: 3. */
  readonly minFiles?: number;
  /** Pattern whose first capture is the decision token. Default: quoted identifier-like strings. */
  readonly tokenPattern?: RegExp;
  /** Maximum findings emitted for one change. Default: 3. */
  readonly maxFindings?: number;
};

function positiveInteger(value: number, option: string): void {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`change-scatter-review: ${option} must be positive.`);
}

function addedLines(file: {
  readonly hunks: ReadonlyArray<{
    readonly newStart: number;
    readonly lines: ReadonlyArray<{ readonly kind: string; readonly content: string }>;
  }>;
}): readonly { readonly line: number; readonly content: string }[] {
  const added: { line: number; content: string }[] = [];
  for (const hunk of file.hunks) {
    let line = hunk.newStart;
    for (const entry of hunk.lines) {
      if (entry.kind === "addition") added.push({ line, content: entry.content });
      if (entry.kind !== "deletion") line += 1;
    }
  }
  return added;
}

function tokens(pattern: RegExp, line: string): readonly string[] {
  if (ignoredLinePattern.test(line)) return [];
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);
  return [...line.matchAll(matcher)].map((match) => match[1] ?? match[0]).filter((token) => !ignoredTokens.has(token));
}

export function defineChangeScatterReview(options: ChangeScatterReviewOptions = {}): ChangeRule {
  options = structuredClone(options);
  const minFiles = options.minFiles ?? 3;
  const maxFindings = options.maxFindings ?? 3;
  const tokenPattern = options.tokenPattern ?? defaultTokenPattern;
  positiveInteger(minFiles, "minFiles");
  positiveInteger(maxFindings, "maxFindings");
  if (tokenPattern.source.length === 0) throw new Error("change-scatter-review: tokenPattern must not be empty.");

  return defineRule({
    lifecycle: "change",
    standard: {
      id: "core/change-scatter-review",
      revision: 1,
      title: "One invariant has one clear owner",
      summary:
        "Flags a decision token added across several production files so a reader checks whether the change is legitimately cross-cutting or duplicates ownership.",
      guidance: {
        standard:
          "A business decision or state vocabulary changed in several places has one identifiable owner. Repetition at independent boundaries is justified; repetition that must evolve in lockstep is centralized or generated from one contract.",
        checks: [
          "Trace every reported file and name the owner of the repeated decision.",
          "PASS when independent adapters intentionally translate the same external token, or generated artifacts have a checked source of truth.",
          "FAIL when future changes require remembering the same edit in several modules.",
          "Do not centralize coincidental text that represents different domain concepts.",
        ],
        examples: [
          {
            label: "REVIEW",
            code: 'Three handlers each add a branch for the literal "awaiting-payment".',
            description: "The diff shape suggests one transition may have several owners.",
          },
          {
            label: "PASS",
            code: 'Independent protocol adapters each translate the provider token "awaiting-payment".',
            description: "Boundary duplication can be intentional when each adapter owns its translation.",
          },
        ],
        refs: [{ type: "url", href: "https://alexn.org/blog/2026/09/22/ai-has-no-wisdom-and-neither-will-you/" }],
      },
    },
    binding: {
      id: "core/change-scatter-review",
      authority: "human",
      include: ["**/*"],
      options: {
        minFiles: options.minFiles ?? null,
        maxFindings: options.maxFindings ?? null,
        tokenPattern: serializePattern(options.tokenPattern),
      },
    },
    detector: {
      id: "core/change-scatter-review",
      version: 1,
      fixtures: {
        mustReport: [
          {
            before: { "src/a.ts": "", "src/b.ts": "", "src/c.ts": "" },
            after: {
              "src/a.ts": "if (state === 'awaiting-payment') run();\n",
              "src/b.ts": "case 'awaiting-payment': run();\n",
              "src/c.ts": "return { status: 'awaiting-payment' };\n",
            },
          },
        ],
        mustStaySilent: [
          {
            before: { "src/a.ts": "", "src/b.ts": "" },
            after: { "src/a.ts": "return 'awaiting-payment';\n", "src/b.ts": "return 'awaiting-payment';\n" },
          },
        ],
      },
      detect({ context }) {
        const occurrences = new Map<string, Map<string, number>>();
        for (const file of context.change.files) {
          if (file.after === null || matches(ignoredPathPattern, file.path)) continue;
          for (const added of addedLines(file)) {
            for (const token of new Set(tokens(tokenPattern, added.content))) {
              const byFile = occurrences.get(token) ?? new Map<string, number>();
              if (!byFile.has(file.path)) byFile.set(file.path, added.line);
              occurrences.set(token, byFile);
            }
          }
        }

        const scattered = [...occurrences.entries()]
          .filter(([, files]) => files.size >= minFiles)
          .toSorted(([left], [right]) => left.localeCompare(right))
          .slice(0, maxFindings);
        for (const [token, files] of scattered) {
          const paths = [...files.keys()].toSorted();
          const file = paths[0];
          if (!file) continue;
          context.report({
            key: token,
            file,
            lineageKey: token,
            message: `Decision token \`${token}\` was added in ${paths.length} production files; identify one owner or justify why the boundaries must repeat it.`,
            evidence: { token, files: paths },
            relatedFiles: paths.filter((path) => path !== file),
            startLine: files.get(file) ?? 1,
            endLine: files.get(file) ?? 1,
          });
        }
      },
    },
  });
}

export const changeScatterReview = defineChangeScatterReview();
