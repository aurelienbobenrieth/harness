/**
 * Flags tests that pin no state or output: mock-dense files without an outcome assertion, tests that assert
 * mock interactions only, and tests whose sole oracle is a snapshot of a whole value.
 *
 * @attribution code-slop by asyrafhussin (MIT, concept re-implemented)
 * @attribution "When to Mock" by Vladimir Khorikov (concept: interaction assertions belong to unmanaged process boundaries)
 */
import { type AgentlintNode, defineRule, type StateRule } from "@aurelienbbn/agentlint";
import { isFunctionNode } from "../ast.js";
import {
  isTestCall,
  literalText,
  type MatcherChain,
  matcherChain,
  namedChildren,
  serializePattern,
  testFilePattern,
  unwrapExpression,
} from "../judgment-support-b.js";

const defaultMockPattern = /\b(?:vi\.fn|createMock|mock[A-Z]\w*|fake[A-Z]\w*)\s*\(/;
const defaultOutcomePattern =
  /\.(?:toBe|toEqual|toStrictEqual|toContain|toMatchObject|toHaveLength|toThrow[A-Za-z]*|toBeNull|toBeUndefined|toBeInstanceOf|toBeCloseTo|toBe(?:Greater|Less)Than(?:OrEqual)?|toHaveProperty|toMatch|toMatchSnapshot|toMatchInlineSnapshot|toMatchFileSnapshot)\s*\(|\bfc\.assert\s*\(|\b(?:it|test)\.prop\s*\(/;
const interactionMatcherNames =
  "toHaveBeenCalled[A-Za-z]*|toHaveBeenLastCalledWith|toHaveBeenNthCalledWith|toHaveReturned[A-Za-z]*|toHaveLastReturnedWith|toHaveNthReturnedWith|toBeCalled[A-Za-z]*";
const interactionPattern = new RegExp(`\\.(?:${interactionMatcherNames})\\s*\\(`);
const globalInteractionPattern = new RegExp(interactionPattern.source, "g");
const interactionMatcherPattern = new RegExp(`^(?:${interactionMatcherNames})$`);
const snapshotMatchers = new Set(["toMatchSnapshot", "toMatchInlineSnapshot"]);
const propertyTestPattern = /\bfc\.assert\s*\(|^(?:it|test)\.prop\b/;
const minMockMatches = 3;
const minInteractionOnlyTests = 2;
const minSnapshotOnlyTests = 2;
const defaultMinInteractionShare = 0.5;
const defaultMaxInlineSnapshotLines = 12;
const maxListedDoubles = 8;

const noAssertionMessage =
  "Test file is dense in mocks but asserts no observable outcome; pin returned state or output.";
const interactionOnlyMessage =
  "Test file is dense in mocks and asserts mock interactions only; pin returned state or output, or show that each mocked collaborator is an unmanaged process boundary.";

export type TestBehaviorCoverageOptions = {
  /** Pattern matching mock and fake construction sites. */
  readonly mockPattern?: RegExp;
  /** Pattern matching assertions that pin returned state or output. Interaction matchers never count, whatever this pattern says. */
  readonly outcomePattern?: RegExp;
  /**
   * Share of a file's tests that must be interaction-only before the file is reported; two such tests always
   * report. Above 0 and at most 1. Default: 0.5
   */
  readonly minInteractionShare?: number;
  /** Longest inline snapshot, in lines, that still reads as a stated expectation. Default: 12 */
  readonly maxInlineSnapshotLines?: number;
};

function countMatches(source: string, pattern: RegExp): number {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;

  return [...source.matchAll(new RegExp(pattern.source, flags))].length;
}

function testCallback(test: AgentlintNode): AgentlintNode | undefined {
  return namedChildren(test.childByFieldName("arguments")).findLast(isFunctionNode);
}

function isWholeValue(subject: AgentlintNode | undefined): boolean {
  if (!subject) return false;
  const value = unwrapExpression(subject);
  if (value.type === "identifier") return true;
  return value.type === "call_expression" && value.childByFieldName("function")?.type === "identifier";
}

export function defineTestBehaviorCoverage(options: TestBehaviorCoverageOptions = {}): StateRule {
  options = structuredClone(options);
  const mockPattern = options.mockPattern ?? defaultMockPattern;
  const outcomePattern = options.outcomePattern ?? defaultOutcomePattern;
  const minInteractionShare = options.minInteractionShare ?? defaultMinInteractionShare;
  const maxInlineSnapshotLines = options.maxInlineSnapshotLines ?? defaultMaxInlineSnapshotLines;
  if (!(minInteractionShare > 0 && minInteractionShare <= 1))
    throw new Error("test-behavior-coverage: minInteractionShare must be greater than 0 and at most 1.");
  if (!Number.isSafeInteger(maxInlineSnapshotLines) || maxInlineSnapshotLines < 1)
    throw new Error("test-behavior-coverage: maxInlineSnapshotLines must be a positive integer.");

  function isOpaqueSnapshot(chain: MatcherChain): boolean {
    if (isWholeValue(chain.subject)) return true;
    const body = chain.matcherArguments.map((argument) => literalText(argument)).find((text) => text !== undefined);
    return body !== undefined && body.trim().split("\n").length > maxInlineSnapshotLines;
  }

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "core/test-behavior-coverage",
      revision: 3,
      title: "Test Behavior Coverage",
      summary:
        "Flags mock-dense test files without an outcome assertion, tests that assert mock interactions only, and tests whose only oracle is a snapshot of a whole value.",
      guidance: {
        standard:
          "Tests verify observable behavior through public contracts. Interaction assertions are meaningful when the interaction is the public boundary contract; otherwise they mirror implementation details and break on refactor while missing wrong results. A snapshot of a whole value pins everything and states nothing.",
        checks: [
          "For each double listed in the finding: does it stand for something outside this process that other systems observe (mail, payments, message bus, third-party API)? Then the call is the contract: PASS for that double, and the asserted arguments must be the full outbound message.",
          "Any other double is a collaborator the project owns, or a managed dependency such as the application's own database: FAIL — assert the resulting state or return value instead.",
          "Would the test still pass if the subject computed the wrong value but forwarded the same arguments? Yes: FAIL, whatever check 1 says.",
          "Callback and event-emitter APIs where being called with a value is the return channel PASS.",
          "Snapshot-only tests PASS when the full text is the contract (CLI help, error message, generated code, serialiser format) and small enough to read in review; otherwise name the two or three facts that must not change and assert them directly.",
          "Fakes stand in for real process boundaries only.",
        ],
        examples: [
          {
            label: "FAIL",
            code: 'it("prices the order", async () => {\n  await checkout.place(order);\n  expect(pricing.quote).toHaveBeenCalledWith(order.lines);\n  expect(orders.save).toHaveBeenCalledTimes(1);\n});',
            description: "Both doubles are project code; a wrong total would still pass.",
          },
          {
            label: "PASS",
            code: 'it("prices the order and sends the receipt", async () => {\n  const placed = await checkout.place(order);\n  expect(placed.total).toBe(4200);\n  expect(mailer.send).toHaveBeenCalledWith({ to: "ada@example.com", template: "receipt", total: 4200 });\n});',
            description: "The outcome is pinned, and the only interaction asserted is the full outbound mail.",
          },
        ],
        refs: [
          { type: "skill", id: "test-strategy" },
          { type: "skill", id: "testing" },
          { type: "url", href: "https://enterprisecraftsmanship.com/posts/when-to-mock/" },
          { type: "url", href: "https://testing.googleblog.com/2015/01/testing-on-toilet-change-detector-tests.html" },
          { type: "url", href: "https://testing.googleblog.com/2013/05/testing-on-toilet-dont-overuse-mocks.html" },
          { type: "url", href: "https://martinfowler.com/articles/mocksArentStubs.html" },
          { type: "url", href: "https://www.jamesshore.com/v2/projects/nullables/testing-without-mocks" },
          { type: "url", href: "https://kentcdodds.com/blog/effective-snapshot-testing" },
        ],
      },
    },
    binding: {
      id: "core/test-behavior-coverage",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"],
      exclude: ["**/*.d.ts"],
      options: {
        mockPattern: serializePattern(options.mockPattern),
        outcomePattern: serializePattern(options.outcomePattern),
        minInteractionShare: options.minInteractionShare ?? null,
        maxInlineSnapshotLines: options.maxInlineSnapshotLines ?? null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          { file: "src/handler.test.ts", source: "vi.fn();vi.fn();vi.fn();" },
          {
            file: "src/handler.test.ts",
            source: "const send = vi.fn();vi.fn();vi.fn();expect(send).toHaveBeenCalledWith(1);",
          },
          {
            file: "src/handler.test.ts",
            source:
              'it("a", () => { expect(repo.save).toHaveBeenCalledWith(1); });\nit("b", () => { expect(repo.save).toHaveBeenCalledTimes(1); });',
          },
          {
            file: "src/view.test.ts",
            source:
              'it("a", () => { expect(container).toMatchSnapshot(); });\nit("b", () => { expect(asFragment()).toMatchSnapshot(); });',
          },
        ],
        mustStaySilent: [
          {
            file: "src/handler.test.ts",
            source: "vi.fn();vi.fn();vi.fn();expect(result).toEqual(1);",
          },
          {
            file: "src/handler.test.ts",
            source:
              'it("a", () => { expect(repo.save).toHaveBeenCalledWith(1); expect(result).toEqual(1); });\nit("b", () => { expect(view.total).toMatchInlineSnapshot(`30`); });',
          },
        ],
      },
      id: "core/test-behavior-coverage",
      version: 3,
      scan: "file",
      createOnce(context) {
        function reportFileDensity(root: AgentlintNode): boolean {
          const source = context.source;
          if (countMatches(source, mockPattern) < minMockMatches) return false;
          if (countMatches(source.replace(globalInteractionPattern, " "), outcomePattern) > 0) return false;
          context.report({
            key: "file-density",
            node: root.descendantsOfType("call_expression")[0] ?? root,
            message: countMatches(source, interactionPattern) > 0 ? interactionOnlyMessage : noAssertionMessage,
          });
          return true;
        }

        return {
          program(root) {
            if (!testFilePattern.test(context.path) || context.source.length === 0) return;

            const tests = root.descendantsOfType("call_expression").filter(isTestCall);
            const interactionOnly: AgentlintNode[] = [];
            const snapshotOnly: AgentlintNode[] = [];
            const doubles = new Set<string>();
            for (const test of tests) {
              const callback = testCallback(test);
              if (!callback || propertyTestPattern.test(test.text)) continue;
              const chains = callback.descendantsOfType("call_expression").flatMap((call) => matcherChain(call) ?? []);
              if (chains.length === 0) continue;

              if (chains.every((chain) => snapshotMatchers.has(chain.matcher))) {
                if (chains.some(isOpaqueSnapshot)) snapshotOnly.push(test);
                continue;
              }
              if (!chains.every((chain) => interactionMatcherPattern.test(chain.matcher))) continue;
              if (countMatches(callback.text.replace(globalInteractionPattern, " "), outcomePattern) > 0) continue;
              interactionOnly.push(test);
              for (const chain of chains) if (chain.subject) doubles.add(chain.subject.text.slice(0, 80));
            }

            const dense = reportFileDensity(root);
            const firstInteractionOnly = interactionOnly[0];
            if (
              !dense &&
              firstInteractionOnly &&
              (interactionOnly.length >= minInteractionOnlyTests ||
                interactionOnly.length / tests.length >= minInteractionShare)
            ) {
              const listed = [...doubles].toSorted();
              const shown = listed.slice(0, maxListedDoubles).map((double) => `\`${double}\``);
              if (listed.length > shown.length) shown.push(`${listed.length - shown.length} more`);
              context.report({
                key: "interaction-only",
                node: firstInteractionOnly,
                message: `${interactionOnly.length} of ${tests.length} tests assert mock interactions only (${shown.join(", ")}); assert the resulting state or return value, or show that each listed double is an unmanaged process boundary.`,
                evidence: { interactionOnlyTests: interactionOnly.length, totalTests: tests.length, doubles: listed },
              });
            }

            const firstSnapshotOnly = snapshotOnly[0];
            if (firstSnapshotOnly && snapshotOnly.length >= minSnapshotOnlyTests)
              context.report({
                key: "snapshot-only",
                node: firstSnapshotOnly,
                message: `${snapshotOnly.length} tests rely on a snapshot of a whole value as their only oracle; assert the two or three facts that must not change, or show that the full text is the contract.`,
                evidence: { snapshotOnlyTests: snapshotOnly.length, totalTests: tests.length },
              });
          },
        };
      },
    },
  });
}

export const testBehaviorCoverage = defineTestBehaviorCoverage();
