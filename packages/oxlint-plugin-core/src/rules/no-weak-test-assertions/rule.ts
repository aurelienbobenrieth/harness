/**
 * @attribution code-slop by asyrafhussin (MIT, concept re-implemented)
 */
import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { resolveVariable, unwrapExpression } from "../ast-support.js";
import { isTestFile, type RuleContextWithFilename } from "../filename-support.js";
import { isTestCall, testApi } from "../test-api-support.js";

const weakMatcherNames = new Set(["toBeDefined", "toBeTruthy"]);
const strongMatcherNames = new Set([
  "toMatchSnapshot",
  "toMatchInlineSnapshot",
  "toBe",
  "toEqual",
  "toStrictEqual",
  "toContain",
  "toHaveLength",
  "toMatchObject",
  "toHaveBeenCalledWith",
  "toHaveBeenCalledExactlyOnceWith",
  "toHaveBeenCalledTimes",
  "toHaveBeenLastCalledWith",
  "toHaveBeenNthCalledWith",
  "toBeGreaterThan",
  "toBeGreaterThanOrEqual",
  "toBeLessThan",
  "toBeLessThanOrEqual",
  "toBeCloseTo",
  "toContainEqual",
  "toMatch",
  "toHaveProperty",
]);
const bareInteractionMatcherNames = new Set(["toHaveBeenCalled", "toBeCalled"]);
const wildcardConstructorNames = new Set(["Object", "Function", "Array", "String", "Number", "Boolean"]);
const throwMatcherNames = new Set(["toThrow", "toThrowError", "rejects", "throws"]);

function getMatcherName(callee: ESTree.Expression): string | undefined {
  if (callee.type !== "MemberExpression" || callee.computed) return undefined;
  return callee.property.type === "Identifier" ? callee.property.name : undefined;
}

function isNegatedChain(callee: ESTree.MemberExpression): boolean {
  const object = callee.object;
  if (object.type !== "MemberExpression" || object.computed) return false;
  return object.property.type === "Identifier" && object.property.name === "not";
}

/** A value fixed by the test source itself: literals, `undefined`, and arrays or objects made only of those. */
function isStaticValue(node: ESTree.Node | null): boolean {
  if (node === null) return false;
  const value = unwrapExpression(node);
  if (value.type === "Literal") return true;
  if (value.type === "Identifier") return value.name === "undefined";
  if (value.type === "TemplateLiteral") return value.expressions.length === 0;
  if (value.type === "UnaryExpression") return value.operator === "-" && isStaticValue(value.argument);
  if (value.type === "ArrayExpression") return value.elements.every((element) => isStaticValue(element));
  if (value.type !== "ObjectExpression") return false;
  return value.properties.every(
    (property) => property.type === "Property" && !property.computed && isStaticValue(property.value),
  );
}

/** Identifiers and non-computed member paths read the same value twice; calls may not, so they never match. */
function stableReferenceText(context: Context, node: ESTree.Node): string | undefined {
  const value = unwrapExpression(node);
  if (value.type === "Identifier" || value.type === "ThisExpression") return context.sourceCode.getText(value);
  if (value.type !== "MemberExpression" || value.computed) return undefined;
  const object = stableReferenceText(context, value.object);
  return object === undefined ? undefined : `${object}.${context.sourceCode.getText(value.property)}`;
}

function isTautology(context: Context, subject: ESTree.Node, expected: readonly ESTree.Node[]): boolean {
  if (isStaticValue(subject)) return expected.every((argument) => isStaticValue(argument));
  const subjectText = stableReferenceText(context, subject);
  const [first] = expected;
  return subjectText !== undefined && first !== undefined && stableReferenceText(context, first) === subjectText;
}

function isViFnChain(context: Context, node: ESTree.Node | null | undefined): boolean {
  let current = node === null || node === undefined ? undefined : unwrapExpression(node);
  while (current?.type === "CallExpression") {
    if (testApi(context, current.callee) === "vi.fn") return true;
    const callee = unwrapExpression(current.callee);
    current = callee.type === "MemberExpression" ? unwrapExpression(callee.object) : undefined;
  }
  return false;
}

/** `expect(double())` where `double` is a local `vi.fn()` binding asserts the stub's own configuration. */
function isOwnMockResult(context: Context, subject: ESTree.Node): boolean {
  let value = unwrapExpression(subject);
  if (value.type === "AwaitExpression") value = unwrapExpression(value.argument);
  if (value.type !== "CallExpression" || value.callee.type !== "Identifier") return false;
  const variable = resolveVariable(context, value.callee);
  return (
    variable?.defs.some(
      (definition) =>
        definition.type === "Variable" &&
        definition.node.type === "VariableDeclarator" &&
        isViFnChain(context, definition.node.init),
    ) ?? false
  );
}

/**
 * An asymmetric matcher that accepts nearly any value: `expect.anything()`, `expect.any(<builtin constructor>)`,
 * `expect.objectContaining({})` and `expect.arrayContaining([])`.
 */
function isWildcard(context: Context, node: ESTree.Node): boolean {
  const value = unwrapExpression(node);
  if (value.type !== "CallExpression") return false;
  const callee = unwrapExpression(value.callee);
  if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return false;
  if (testApi(context, callee.object) !== "expect") return false;
  const [argument] = value.arguments;
  const shape = argument === undefined ? undefined : unwrapExpression(argument);
  switch (callee.property.name) {
    case "anything":
      return true;
    case "any":
      return shape?.type === "Identifier" && wildcardConstructorNames.has(shape.name);
    case "objectContaining":
      return shape?.type === "ObjectExpression" && shape.properties.length === 0;
    case "arrayContaining":
      return shape?.type === "ArrayExpression" && shape.elements.length === 0;
    default:
      return false;
  }
}

function isWildcardOnly(context: Context, expected: readonly ESTree.Node[]): boolean {
  return expected.length > 0 && expected.every((argument) => isWildcard(context, argument));
}

/** `expect(typeof value).toBe("function")` pins a runtime category, never a behavior. */
function isTypeofComparison(subject: ESTree.Node | undefined, expected: readonly ESTree.Node[]): boolean {
  if (subject === undefined) return false;
  const value = unwrapExpression(subject);
  const [first] = expected;
  return value.type === "UnaryExpression" && value.operator === "typeof" && first !== undefined && isStaticValue(first);
}

function isInstanceOfObject(matcherName: string, expected: readonly ESTree.Node[]): boolean {
  const [first] = expected;
  if (matcherName !== "toBeInstanceOf" || first === undefined) return false;
  const value = unwrapExpression(first);
  return value.type === "Identifier" && value.name === "Object";
}

function owner(context: Context, node: ESTree.Node): ESTree.Node | undefined {
  let current = node.parent;
  while (current !== null && current.type !== "Program") {
    if (current.type === "CallExpression" && isTestCall(context, current)) return current;
    current = current.parent;
  }
  return undefined;
}

export const noWeakTestAssertions: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow individual tests whose only assertions check existence, a bare call, a `typeof` or `Object` instance, wildcard-only matcher arguments, a value against itself or a literal against a literal, or a local mock's own return value.",
    },
    schema: [
      {
        type: "object",
        properties: {
          assertionHelpers: {
            type: "array",
            items: { type: "string", minLength: 1 },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      weakAssertionsOnly:
        "This test pins no behavior: existence, bare-call, `typeof` and `Object` instance checks, wildcard-only matcher arguments such as `expect.anything()`, tautological expects, and assertions on a local mock's own result pass whatever the code does. Assert an observable value, rendered contract, exact call arguments, or specific failure.",
    },
  },
  create(context) {
    if (!isTestFile(context as RuleContextWithFilename)) return {};

    const tests = new Map<ESTree.Node, { weak: boolean; strong: boolean }>();
    const options = context.options[0] as { readonly assertionHelpers?: readonly string[] } | undefined;
    const helpers = new Set(options?.assertionHelpers ?? []);

    return {
      CallExpression(node) {
        const test = owner(context, node);
        if (test === undefined) return;
        const state = tests.get(test) ?? { weak: false, strong: false };
        tests.set(test, state);
        if (
          testApi(context, node.callee) === "fc.assert" ||
          (node.callee.type === "Identifier" && helpers.has(node.callee.name))
        ) {
          state.strong = true;
          return;
        }

        let root = node.callee;
        while (root.type === "MemberExpression") root = root.object;
        if (root.type !== "CallExpression" || testApi(context, root.callee) !== "expect") return;
        const matcherName = getMatcherName(node.callee);
        if (matcherName === undefined) return;

        const subject = root.arguments[0];
        if (
          subject !== undefined &&
          (isTautology(context, subject, node.arguments) || isOwnMockResult(context, subject))
        ) {
          state.weak = true;
          return;
        }

        if (matcherName === "toHaveProperty" && node.arguments.length < 2) {
          state.weak = true;
          return;
        }

        if (
          isWildcardOnly(context, node.arguments) ||
          isTypeofComparison(subject, node.arguments) ||
          isInstanceOfObject(matcherName, node.arguments)
        ) {
          state.weak = true;
          return;
        }

        if (bareInteractionMatcherNames.has(matcherName)) {
          if (!isNegatedChain(node.callee as ESTree.MemberExpression)) state.weak = true;
          return;
        }

        if (strongMatcherNames.has(matcherName)) {
          state.strong = true;
          return;
        }

        if (throwMatcherNames.has(matcherName)) {
          if (node.arguments.length > 0) {
            state.strong = true;
          } else if (isNegatedChain(node.callee as ESTree.MemberExpression)) {
            state.weak = true;
          }
          return;
        }

        if (weakMatcherNames.has(matcherName)) {
          state.weak = true;
        }
      },
      "Program:exit"() {
        for (const [node, state] of tests)
          if (state.weak && !state.strong) context.report({ node, messageId: "weakAssertionsOnly" });
      },
    };
  },
};
