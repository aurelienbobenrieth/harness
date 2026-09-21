import type { AgentlintNode } from "@aurelienbbn/agentlint";
import { isFunctionNode, nodeKey } from "./ast.js";

/** Files the judgment rules treat as tests. */
export const testFilePattern = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

export const sourceGlobs: readonly string[] = ["**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"];
export const nonTestExcludes: readonly string[] = ["**/*.d.ts", "**/*.{test,spec}.*", "**/__tests__/**"];

export type SerializedPattern = { readonly source: string; readonly flags: string };

/** Mirrors a RegExp option into `binding.options`; absent options serialize as `null`. */
export function serializePattern(pattern: RegExp | undefined): SerializedPattern | null {
  return pattern ? { source: pattern.source, flags: pattern.flags } : null;
}

/** Stateless `.test` for option patterns that may carry the `g` or `y` flag. */
export function matches(pattern: RegExp, text: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

export function namedChildren(node: AgentlintNode | null | undefined): readonly AgentlintNode[] {
  return (node?.children ?? []).filter((child) => child.isNamed && child.type !== "comment");
}

const transparentTypes = new Set([
  "parenthesized_expression",
  "await_expression",
  "as_expression",
  "satisfies_expression",
  "non_null_expression",
]);

/** Strips parentheses, `await`, casts and `!` around an expression. */
export function unwrapExpression(node: AgentlintNode): AgentlintNode {
  let current = node;
  while (transparentTypes.has(current.type)) {
    const inner = namedChildren(current)[0];
    if (!inner) break;
    current = inner;
  }
  return current;
}

/** Content of a string or substitution-free template literal, without its quotes. */
export function literalText(node: AgentlintNode): string | undefined {
  if (node.type === "string") return node.text.slice(1, -1);
  if (node.type !== "template_string") return undefined;
  if (node.descendantsOfType("template_substitution").length > 0) return undefined;
  return node.text.slice(1, -1);
}

export function isSameNode(left: AgentlintNode, right: AgentlintNode): boolean {
  return (
    nodeKey(left) === nodeKey(right) &&
    left.endPosition.row === right.endPosition.row &&
    left.endPosition.column === right.endPosition.column
  );
}

/** Parameter nodes of a function-like node, including the bare identifier of `x => …`. */
export function parametersOf(fn: AgentlintNode): readonly AgentlintNode[] {
  const list = fn.childByFieldName("parameters");
  if (list) return namedChildren(list);
  const single = fn.childByFieldName("parameter");
  return single ? [single] : [];
}

/** Binding pattern of a parameter: the identifier or destructuring pattern, without modifiers, type or default. */
export function parameterPattern(parameter: AgentlintNode): AgentlintNode | undefined {
  if (parameter.type === "identifier" || parameter.type === "object_pattern") return parameter;
  return (
    parameter.childByFieldName("pattern") ??
    namedChildren(parameter).find((child) => child.type === "identifier" || child.type === "object_pattern")
  );
}

/** Declared name of a function-like node, looking through `const name = …` and `name: …`. */
export function functionName(fn: AgentlintNode): string | undefined {
  const own = fn.childByFieldName("name");
  if (own) return own.text;
  const parent = fn.parent;
  if (parent?.type === "variable_declarator") return parent.childByFieldName("name")?.text;
  if (parent?.type === "pair") return parent.childByFieldName("key")?.text;
  return undefined;
}

/** `return` statements that belong to `fn` itself, not to a nested function. */
export function ownReturns(fn: AgentlintNode): readonly AgentlintNode[] {
  const body = fn.childByFieldName("body");
  if (!body) return [];
  return body.descendantsOfType("return_statement").filter((statement) => {
    let current = statement.parent;
    while (current !== null && !isSameNode(current, fn)) {
      if (isFunctionNode(current)) return false;
      current = current.parent;
    }
    return true;
  });
}

export type MatcherChain = {
  /** Matcher name, e.g. `toBe`. */
  readonly matcher: string;
  /** Arguments of the matcher call. */
  readonly matcherArguments: readonly AgentlintNode[];
  /** The `expect(...)` call at the root of the chain. */
  readonly expectCall: AgentlintNode;
  /** First argument of `expect(...)`. */
  readonly subject: AgentlintNode | undefined;
};

/** Reads `expect(subject)[.not|.resolves|.rejects].matcher(args)`; undefined for any other call. */
export function matcherChain(call: AgentlintNode): MatcherChain | undefined {
  if (call.type !== "call_expression") return undefined;
  const callee = call.childByFieldName("function");
  if (callee?.type !== "member_expression") return undefined;
  const matcher = callee.childByFieldName("property")?.text;
  let object = callee.childByFieldName("object");
  while (object?.type === "member_expression") object = object.childByFieldName("object");
  if (!matcher || object?.type !== "call_expression") return undefined;
  const root = object.childByFieldName("function");
  if (root?.text !== "expect" && root?.text !== "expect.soft") return undefined;
  return {
    matcher,
    matcherArguments: namedChildren(call.childByFieldName("arguments")),
    expectCall: object,
    subject: namedChildren(object.childByFieldName("arguments"))[0],
  };
}

const testCalleePattern = /^(?:it|test)(?:\.\w+)*$/;

/** True for `it(...)`, `test(...)` and their modifiers (`it.only`, `test.each(...)(...)`). */
export function isTestCall(call: AgentlintNode): boolean {
  if (call.type !== "call_expression") return false;
  let callee = call.childByFieldName("function");
  const outerCallee = call.parent?.type === "call_expression" ? call.parent.childByFieldName("function") : null;
  if (outerCallee && isSameNode(outerCallee, call)) return false;
  if (callee?.type === "call_expression") callee = callee.childByFieldName("function");
  return callee !== null && callee !== undefined && testCalleePattern.test(callee.text);
}

/** Nearest enclosing `it`/`test` call. */
export function enclosingTestCall(node: AgentlintNode): AgentlintNode | undefined {
  let current = node.parent;
  while (current !== null) {
    if (isTestCall(current)) return current;
    current = current.parent;
  }
  return undefined;
}

/** Title literal of an `it`/`test`/`describe` call. */
export function testTitle(call: AgentlintNode): string | undefined {
  const first = namedChildren(call.childByFieldName("arguments"))[0];
  return first ? literalText(first) : undefined;
}
