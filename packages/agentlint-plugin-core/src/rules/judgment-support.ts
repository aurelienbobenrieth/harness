import type { AgentlintNode } from "@aurelienbbn/agentlint";
import { isFunctionNode } from "./ast.js";

/** Files the judgment rules treat as tests. */
export const testFilePattern = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

/** Default binding scope shared by the judgment rules. */
export const sourceFileGlobs = ["**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"] as const;

/** Globs that keep a production-code rule away from test files. */
export const testFileExcludeGlobs = ["**/*.{test,spec}.*", "**/__tests__/**"] as const;

export type SerializedPattern = { readonly source: string; readonly flags: string };

/** Material form of an optional RegExp option: absent options serialize as `null`. */
export function serializePattern(pattern: RegExp | undefined): SerializedPattern | null {
  return pattern ? { source: pattern.source, flags: pattern.flags } : null;
}

/** `RegExp.test` that is safe for option patterns carrying the `g` or `y` flag. */
export function matches(pattern: RegExp, text: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

export function namedChildren(node: AgentlintNode | null | undefined): readonly AgentlintNode[] {
  return (node?.children ?? []).filter((child) => child.isNamed && child.type !== "comment");
}

/** Content of a quoted string or substitution-free template; `undefined` for anything else. */
export function stringValue(node: AgentlintNode | null | undefined): string | undefined {
  if (!node || (node.type !== "string" && node.type !== "template_string")) return undefined;
  if (node.type === "template_string" && node.descendantsOfType("template_substitution").length > 0) return undefined;
  return node.text.slice(1, -1);
}

export function callArguments(call: AgentlintNode): readonly AgentlintNode[] {
  return namedChildren(call.childByFieldName("arguments"));
}

const testCalleePattern = /^(?:it|test)(?:\.\w+)*$/;

/** True for `it(...)`, `test.only(...)`, `it.each(table)(...)` and the like. */
export function isTestCall(node: AgentlintNode): boolean {
  if (node.type !== "call_expression") return false;
  const callee = node.childByFieldName("function");
  if (!callee) return false;
  if (callee.type !== "call_expression") return testCalleePattern.test(callee.text);
  const inner = callee.childByFieldName("function");
  return inner !== null && inner.type === "member_expression" && testCalleePattern.test(inner.text);
}

export type MatcherChain = {
  readonly matcher: string;
  readonly expectCall: AgentlintNode;
  readonly args: readonly AgentlintNode[];
};

/** Resolves `expect(subject).not.toBe(expected)` into its matcher name, `expect(...)` call and matcher arguments. */
export function matcherChain(node: AgentlintNode): MatcherChain | undefined {
  if (node.type !== "call_expression") return undefined;
  const callee = node.childByFieldName("function");
  const matcher = callee?.type === "member_expression" ? callee.childByFieldName("property")?.text : undefined;
  if (!callee || matcher === undefined) return undefined;
  let current = callee.childByFieldName("object");
  while (current !== null && current.type === "member_expression") current = current.childByFieldName("object");
  if (current === null || current.type !== "call_expression") return undefined;
  if (current.childByFieldName("function")?.text !== "expect") return undefined;
  return { matcher, expectCall: current, args: callArguments(node) };
}

/** Nearest enclosing function that is passed to an `it`/`test` call. */
export function enclosingTestCallback(node: AgentlintNode): AgentlintNode | undefined {
  let current = node.parent;
  while (current !== null) {
    const call = current.parent?.type === "arguments" ? current.parent.parent : null;
    if (isFunctionNode(current) && call && isTestCall(call)) return current;
    current = current.parent;
  }
  return undefined;
}

const loaderCalleePattern = /^(?:import|require|vi\.importActual)$/;

/** Every module specifier a file loads: static imports, re-exports, `import()`, `require()` and `vi.importActual()`. */
export function moduleSpecifiers(root: AgentlintNode): readonly string[] {
  const specifiers: string[] = [];
  for (const type of ["import_statement", "export_statement"]) {
    for (const statement of root.descendantsOfType(type)) {
      const source = stringValue(statement.childByFieldName("source"));
      if (source !== undefined) specifiers.push(source);
    }
  }
  for (const call of root.descendantsOfType("call_expression")) {
    const callee = call.childByFieldName("function");
    if (!callee || !loaderCalleePattern.test(callee.text)) continue;
    const specifier = stringValue(callArguments(call)[0]);
    if (specifier !== undefined) specifiers.push(specifier);
  }
  return specifiers;
}

/** Local binding name to module specifier, for default, namespace and named static imports. */
export function importedBindings(root: AgentlintNode): ReadonlyMap<string, string> {
  const bindings = new Map<string, string>();
  for (const statement of root.descendantsOfType("import_statement")) {
    const source = stringValue(statement.childByFieldName("source"));
    const clause = statement.children.find((child) => child.type === "import_clause");
    if (source === undefined || !clause) continue;
    for (const child of clause.children) {
      if (child.type === "identifier") bindings.set(child.text, source);
      if (child.type === "namespace_import") {
        const name = child.children.find((part) => part.type === "identifier");
        if (name) bindings.set(name.text, source);
      }
    }
    for (const specifier of clause.descendantsOfType("import_specifier")) {
      const local = specifier.childByFieldName("alias") ?? specifier.childByFieldName("name");
      if (local) bindings.set(local.text, source);
    }
  }
  return bindings;
}
