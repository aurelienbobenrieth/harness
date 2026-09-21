/**
 * Flags expected strings and inline snapshots that pin the text of a missing or non-numeric value.
 */
import { type AgentlintNode, defineRule, type StateRule } from "@aurelienbbn/agentlint";
import {
  enclosingTestCall,
  literalText,
  matcherChain,
  serializePattern,
  sourceGlobs,
  testFilePattern,
  testTitle,
} from "../judgment-support-b.js";

const defaultSuspectPattern = /\[object Object\]|\bNaN\b|\bundefined\b|Invalid Date/;
const embeddedNullPattern = /\bnull\b/;
const bareSnapshotTokenPattern = /\bNaN\b|Invalid Date|\[object Object\]/;
const quotedSegmentPattern = /"((?:[^"\\]|\\.)*)"/g;
const inlineSnapshotMatchers = new Set(["toMatchInlineSnapshot", "toThrowErrorMatchingInlineSnapshot"]);
const maxFindingsPerFile = 3;

export type PinnedSuspectOutputOptions = {
  /** Pattern matching text that usually betrays a formatting bug. Embedded `null` is checked separately. */
  readonly suspectPattern?: RegExp;
};

function firstMatch(pattern: RegExp, text: string): string | undefined {
  pattern.lastIndex = 0;
  const match = pattern.exec(text);
  pattern.lastIndex = 0;
  return match?.[0];
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

export function definePinnedSuspectOutput(options: PinnedSuspectOutputOptions = {}): StateRule {
  options = structuredClone(options);
  const suspectPattern = options.suspectPattern ?? defaultSuspectPattern;

  /** Suspect token inside one piece of expected text. */
  function suspectIn(text: string): string | undefined {
    const token = firstMatch(suspectPattern, text);
    if (token !== undefined) return token;
    if (!embeddedNullPattern.test(text) || text.trim() === "null" || isJson(text)) return undefined;
    return "null";
  }

  /** Inline snapshots of structures print `undefined` and `null` as ordinary field values; only their strings are text. */
  function suspectInSnapshot(body: string): string | undefined {
    const trimmed = body.trim();
    if (/^"[^\n]*"$/.test(trimmed)) return suspectIn(trimmed.slice(1, -1));
    for (const segment of trimmed.matchAll(quotedSegmentPattern)) {
      const token = suspectIn(segment[1] ?? "");
      if (token !== undefined) return token;
    }
    return firstMatch(bareSnapshotTokenPattern, trimmed.replaceAll(quotedSegmentPattern, '""'));
  }

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "core/pinned-suspect-output",
      revision: 1,
      title: "Pinned Suspect Output",
      summary:
        "Flags expected strings and inline snapshots that contain `undefined`, `NaN`, `[object Object]`, `Invalid Date` or an embedded `null`, which usually certify a bug the test recorded.",
      guidance: {
        standard:
          "An expectation written by running the code and pasting its output records whatever the code did, defects included. The printed form of a missing value, a failed number conversion or an unformatted object inside user-facing text is almost never the specification; a test that pins it turns the defect into a requirement.",
        checks: [
          "FAIL unless printing this token is the specified behaviour of the subject (inspector, serialiser, debug formatter); cite the spec or docblock.",
          "On FAIL name the missing or non-numeric input and what the user should see instead; repair the subject or the fixture, then assert the intended text.",
          "PASS for a declared characterization test guarding a refactor: its title says so and links the follow-up.",
        ],
        examples: [
          {
            label: "FAIL",
            code: 'it("greets the customer", () => {\n  expect(greeting({ firstName: "Ada" })).toBe("Hello Ada undefined!");\n});',
            description: "The fixture has no last name and the template prints the hole.",
          },
          {
            label: "PASS",
            code: 'it("greets a customer who has no last name", () => {\n  expect(greeting({ firstName: "Ada" })).toBe("Hello Ada!");\n});',
            description: "The missing input is named and the intended text is asserted.",
          },
        ],
        refs: [
          { type: "url", href: "https://michaelfeathers.silvrback.com/characterization-testing" },
          { type: "url", href: "https://arxiv.org/html/2410.21136v1" },
        ],
      },
    },
    binding: {
      id: "core/pinned-suspect-output",
      authority: "agent",
      include: [...sourceGlobs],
      exclude: ["**/*.d.ts"],
      options: { suspectPattern: serializePattern(options.suspectPattern) },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            file: "src/greeting.test.ts",
            source: 'it("greets", () => { expect(greeting(user)).toBe("Hello undefined!"); });',
          },
        ],
        mustStaySilent: [
          {
            file: "src/greeting.test.ts",
            source: 'it("prints undefined for missing keys", () => { expect(inspect(bag)).toBe("a: undefined"); });',
          },
        ],
      },
      id: "core/pinned-suspect-output",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        let reported = 0;

        function suspectToken(matcher: string, argument: AgentlintNode): string | undefined {
          const text = literalText(argument);
          if (text === undefined) return undefined;
          return inlineSnapshotMatchers.has(matcher) ? suspectInSnapshot(text) : suspectIn(text);
        }

        return {
          before() {
            reported = 0;
          },
          call_expression(node) {
            if (reported >= maxFindingsPerFile || !testFilePattern.test(context.path)) return;
            const chain = matcherChain(node);
            if (!chain) return;

            for (const argument of chain.matcherArguments) {
              const token = suspectToken(chain.matcher, argument);
              if (token === undefined) continue;
              const test = enclosingTestCall(node);
              const title = test ? testTitle(test) : undefined;
              if (title?.toLowerCase().includes(token.toLowerCase())) return;

              reported += 1;
              context.report({
                node: argument,
                message: `Expected text pins \`${token}\`, which usually records a missing or non-numeric input rather than intended output; repair the subject or the fixture and assert the intended text, or name the token in the test title when printing it is the contract.`,
                evidence: { token },
              });
              return;
            }
          },
        };
      },
    },
  });
}

export const pinnedSuspectOutput = definePinnedSuspectOutput();
