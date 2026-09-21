/**
 * Flags assertions whose expected value is computed from the inputs of the call under test.
 *
 * A computed expectation is reported only when it shares an identifier with the arguments of the subject call,
 * or calls something imported from the subject's own module: arithmetic on unrelated fixture constants is plumbing.
 *
 * @attribution "Don't Put Logic in Tests" (Google Testing Blog) (concept)
 */
import { type AgentlintNode, defineRule, type StateRule } from "@aurelienbbn/agentlint";
import {
  enclosingTestCallback,
  importedBindings,
  matcherChain,
  matches,
  namedChildren,
  serializePattern,
  sourceFileGlobs,
  testFilePattern,
} from "../judgment-support.js";

const defaultMatcherPattern = /^(?:toBe|toEqual|toStrictEqual|toBeCloseTo|toContain|toMatchObject)$/;
const defaultDerivationCallees = [
  "map",
  "filter",
  "reduce",
  "sort",
  "toSorted",
  "join",
  "replace",
  "replaceAll",
  "toLowerCase",
  "toUpperCase",
  "trim",
  "slice",
  "toFixed",
  "round",
  "floor",
  "ceil",
];
const defaultMaxFindingsPerFile = 3;

const arithmeticOperators = new Set(["+", "-", "*", "/", "%", "**"]);
const transparentTypes = new Set(["await_expression", "parenthesized_expression"]);
const identifierTypes = ["identifier", "shorthand_property_identifier"];
const propertyCalleePattern = /^(?:fc\.(?:property|asyncProperty)|(?:it|test)\.prop)$/;

const message =
  "Expected value is computed from the same inputs as the call under test, so a wrong operator is wrong on both sides; state the expected value as a literal, a table row, or a property.";

export type ExpectedValueRecomputedOptions = {
  /** Matcher names whose first argument is the expected value. */
  readonly matcherPattern?: RegExp;
  /** Method names that mark an expected value as derived. Providing this REPLACES the built-in list. */
  readonly derivationCallees?: readonly string[];
  /** Findings reported per file at most. Default: 3 */
  readonly maxFindingsPerFile?: number;
};

function unwrap(node: AgentlintNode): AgentlintNode {
  let current = node;
  while (transparentTypes.has(current.type)) {
    const inner = namedChildren(current)[0];
    if (!inner) break;
    current = inner;
  }
  return current;
}

function withDescendants(node: AgentlintNode, type: string): readonly AgentlintNode[] {
  return node.type === type ? [node, ...node.descendantsOfType(type)] : node.descendantsOfType(type);
}

function identifiers(node: AgentlintNode): ReadonlySet<string> {
  return new Set(identifierTypes.flatMap((type) => withDescendants(node, type)).map((identifier) => identifier.text));
}

function isLiteralArithmetic(node: AgentlintNode): boolean {
  const inner = unwrap(node);
  if (inner.type === "number" || inner.type === "string") return true;
  if (inner.type === "unary_expression") return namedChildren(inner).every(isLiteralArithmetic);
  if (inner.type !== "binary_expression") return false;
  const left = inner.childByFieldName("left");
  const right = inner.childByFieldName("right");
  return left !== null && right !== null && isLiteralArithmetic(left) && isLiteralArithmetic(right);
}

function insidePropertyCallback(node: AgentlintNode): boolean {
  for (let current = node.parent; current !== null; current = current.parent) {
    if (current.type !== "call_expression") continue;
    const callee = current.childByFieldName("function");
    const name = callee?.type === "call_expression" ? callee.childByFieldName("function") : callee;
    if (name && propertyCalleePattern.test(name.text)) return true;
  }
  return false;
}

function rootIdentifier(callee: AgentlintNode | null): string | undefined {
  let current = callee;
  while (current !== null && (current.type === "member_expression" || current.type === "call_expression"))
    current = current.childByFieldName(current.type === "member_expression" ? "object" : "function");
  return current?.type === "identifier" ? current.text : undefined;
}

function resolveLocal(expected: AgentlintNode, matcherCall: AgentlintNode): AgentlintNode {
  if (expected.type !== "identifier") return expected;
  const scope = enclosingTestCallback(matcherCall);
  const declarator = scope
    ?.descendantsOfType("variable_declarator")
    .find((candidate) => candidate.childByFieldName("name")?.text === expected.text);
  return declarator?.childByFieldName("value") ?? expected;
}

export function defineExpectedValueRecomputed(options: ExpectedValueRecomputedOptions = {}): StateRule {
  options = structuredClone(options);
  const matcherPattern = options.matcherPattern ?? defaultMatcherPattern;
  const derivationCallees = new Set(options.derivationCallees ?? defaultDerivationCallees);
  const maxFindingsPerFile = options.maxFindingsPerFile ?? defaultMaxFindingsPerFile;
  if (!Number.isSafeInteger(maxFindingsPerFile) || maxFindingsPerFile < 1)
    throw new Error("expected-value-recomputed: maxFindingsPerFile must be a positive integer.");

  function isComputed(expected: AgentlintNode): boolean {
    const arithmetic = withDescendants(expected, "binary_expression").some(
      (node) => arithmeticOperators.has(node.childByFieldName("operator")?.text ?? "") && !isLiteralArithmetic(node),
    );
    if (arithmetic) return true;
    const derived = withDescendants(expected, "call_expression").some((node) => {
      const callee = node.childByFieldName("function");
      return (
        callee?.type === "member_expression" && derivationCallees.has(callee.childByFieldName("property")?.text ?? "")
      );
    });
    if (derived) return true;
    return withDescendants(expected, "template_string").some(
      (node) => node.children.filter((child) => child.type === "template_substitution").length >= 2,
    );
  }

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "core/expected-value-recomputed",
      revision: 1,
      title: "Expected Value Recomputed",
      summary:
        "Flags assertions whose expected value is computed from the same inputs as the call under test instead of being stated.",
      guidance: {
        standard:
          "An expectation is an independent statement of the right answer. When the test derives it with the arithmetic, string handling or collection pipeline the production code uses, both sides agree by construction and the assertion cannot fail for the reason it exists.",
        checks: [
          "Open the function under test. Fails when the expected expression applies the same operations to the same inputs; name the mirrored production line. A wrong operator would be wrong on both sides.",
          "Passes when the expression is an independent oracle: a different algorithm, a library reference implementation, or an inverse such as decoding what was encoded.",
          "Passes when the computation is test-data plumbing unrelated to the behaviour asserted: an id or URL built from a fixture constant, a date input formatted for the call.",
          "On fail, replace it with hand-chosen literals, an `it.each` table of input and output literals, or a property when the relation itself is the point.",
        ],
        examples: [
          {
            label: "FAIL",
            description: "The test repeats the production formula.",
            code: "expect(applyDiscount(price, percent)).toBe(price - (price * percent) / 100);",
          },
          {
            label: "PASS",
            description: "Inputs and output are stated; the formula lives in one place.",
            code: "expect(applyDiscount(200, 15)).toBe(170);",
          },
        ],
        refs: [
          { type: "skill", id: "testing" },
          { type: "skill", id: "test-strategy" },
          {
            type: "url",
            href: "https://testing.googleblog.com/2014/07/testing-on-toilet-dont-put-logic-in.html",
          },
          {
            type: "url",
            href: "https://fsharpforfunandprofit.com/posts/property-based-testing-2/",
          },
          { type: "url", href: "https://arxiv.org/html/2410.21136v1" },
          { type: "url", href: "https://blog.ploeh.dk/2019/10/07/devils-advocate/" },
        ],
      },
    },
    binding: {
      id: "core/expected-value-recomputed",
      authority: "agent",
      include: [...sourceFileGlobs],
      exclude: ["**/*.d.ts"],
      options: {
        matcherPattern: serializePattern(options.matcherPattern),
        derivationCallees: options.derivationCallees ? [...options.derivationCallees] : null,
        maxFindingsPerFile: options.maxFindingsPerFile ?? null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            file: "src/discount.test.ts",
            source:
              'it("discounts", () => { expect(applyDiscount(price, percent)).toBe(price - (price * percent) / 100); });',
          },
        ],
        mustStaySilent: [
          {
            file: "src/discount.test.ts",
            source: 'it("discounts", () => { expect(applyDiscount(200, 15)).toBe(170); });',
          },
          {
            file: "src/ttl.test.ts",
            source: 'it("lasts an hour", () => { expect(ttl(now)).toBe(60 * 60 * 1000); });',
          },
        ],
      },
      id: "core/expected-value-recomputed",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        let findings = 0;
        let imports: ReadonlyMap<string, string> | undefined;

        return {
          before() {
            findings = 0;
            imports = undefined;
          },
          call_expression(node) {
            if (findings >= maxFindingsPerFile || !testFilePattern.test(context.path)) return;
            const chain = matcherChain(node);
            if (!chain || !matches(matcherPattern, chain.matcher)) return;
            const subjectArgument = namedChildren(chain.expectCall.childByFieldName("arguments"))[0];
            const stated = chain.args[0];
            if (!subjectArgument || !stated) return;
            const subject = unwrap(subjectArgument);
            if (subject.type !== "call_expression") return;
            if (stated.type === "call_expression" && stated.text.startsWith("expect.")) return;
            if (insidePropertyCallback(node)) return;

            const expected = resolveLocal(stated, node);
            if (!isComputed(expected)) return;

            if (imports === undefined) {
              let root = node;
              while (root.parent !== null) root = root.parent;
              imports = importedBindings(root);
            }
            const subjectArguments = subject.childByFieldName("arguments");
            const subjectIds = subjectArguments ? identifiers(subjectArguments) : new Set<string>();
            const shared = [...identifiers(expected)].filter((name) => subjectIds.has(name)).toSorted();
            const subjectRoot = rootIdentifier(subject.childByFieldName("function"));
            const subjectModule = subjectRoot === undefined ? undefined : imports?.get(subjectRoot);
            const sameModuleCallees = withDescendants(expected, "call_expression")
              .map((call) => rootIdentifier(call.childByFieldName("function")))
              .filter((name): name is string => name !== undefined && name !== subjectRoot)
              .filter((name) => subjectModule !== undefined && imports?.get(name) === subjectModule)
              .toSorted();
            if (shared.length === 0 && sameModuleCallees.length === 0) return;

            findings++;
            context.report({
              node,
              message,
              evidence: { expected: expected.text.slice(0, 160), shared, sameModuleCallees },
            });
          },
        };
      },
    },
  });
}

export const expectedValueRecomputed = defineExpectedValueRecomputed();
