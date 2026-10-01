/**
 * The statement types an option of `padding-line-between-statements` may name, with ESLint's semantics: a keyword
 * type matches the statement's first token, so `export const x = 1` is an `export` and never a `const`, and a
 * labeled statement matches as the statement it labels.
 *
 * @module
 */
import type { Context, ESTree } from "@oxlint/plugins";

type SourceCode = Context["sourceCode"];
type Test = (node: ESTree.Node, sourceCode: SourceCode) => boolean;

const isMultiline = (node: ESTree.Node): boolean => node.loc.start.line !== node.loc.end.line;

const startsWith =
  (keyword: string): Test =>
  (node, sourceCode) =>
    sourceCode.getFirstToken(node)?.value === keyword;

const isDirective = (node: ESTree.Node): boolean =>
  node.type === "ExpressionStatement" && typeof node.directive === "string";

const isExpression = (node: ESTree.Node): boolean => node.type === "ExpressionStatement" && !isDirective(node);

const skipChain = (node: ESTree.Node): ESTree.Node => (node.type === "ChainExpression" ? node.expression : node);

/** `(function () {})()`, `!function () {}()`, `(() => {})()` and their optional-call forms. */
function isIife(node: ESTree.Node): boolean {
  if (node.type !== "ExpressionStatement") return false;
  const expression = skipChain(node.expression);
  const call = expression.type === "UnaryExpression" ? skipChain(expression.argument) : expression;
  return (
    call.type === "CallExpression" &&
    (call.callee.type === "FunctionExpression" || call.callee.type === "ArrowFunctionExpression")
  );
}

/**
 * A do-while around a block, an IIFE, or a statement whose last token before any `;` closes a block or a switch:
 * `if (x) {}` and `const f = () => {};` are block-like, `class A {}`, `const o = {};` and `if (x) return;` are not.
 */
function isBlockLike(node: ESTree.Node, sourceCode: SourceCode): boolean {
  if (node.type === "DoWhileStatement" && node.body.type === "BlockStatement") return true;
  if (isIife(node)) return true;
  const last = sourceCode.getLastToken(node, { filter: (token) => token.value !== ";" || token.type !== "Punctuator" });
  if (last?.value !== "}" || last.type !== "Punctuator") return false;
  const owner = sourceCode.getNodeByRangeIndex(last.range[0]);
  return owner?.type === "BlockStatement" || owner?.type === "SwitchStatement";
}

const lines =
  (keyword: string, multiline: boolean): Test =>
  (node, sourceCode) =>
    isMultiline(node) === multiline && startsWith(keyword)(node, sourceCode);

const tests: Readonly<Record<string, Test>> = {
  "*": () => true,
  "block-like": isBlockLike,
  "multiline-block-like": (node, sourceCode) => isMultiline(node) && isBlockLike(node, sourceCode),
  block: (node) => node.type === "BlockStatement",
  empty: (node) => node.type === "EmptyStatement",
  expression: isExpression,
  "multiline-expression": (node) => isMultiline(node) && isExpression(node),
  directive: isDirective,
  function: (node) => node.type === "FunctionDeclaration",
  iife: isIife,
  "multiline-const": lines("const", true),
  "singleline-const": lines("const", false),
  "multiline-let": lines("let", true),
  "singleline-let": lines("let", false),
  "multiline-var": lines("var", true),
  "singleline-var": lines("var", false),
  break: startsWith("break"),
  case: startsWith("case"),
  class: startsWith("class"),
  const: startsWith("const"),
  continue: startsWith("continue"),
  debugger: startsWith("debugger"),
  default: startsWith("default"),
  do: startsWith("do"),
  export: startsWith("export"),
  for: startsWith("for"),
  if: startsWith("if"),
  import: startsWith("import"),
  let: startsWith("let"),
  return: startsWith("return"),
  switch: startsWith("switch"),
  throw: startsWith("throw"),
  try: startsWith("try"),
  var: startsWith("var"),
  while: startsWith("while"),
  with: startsWith("with"),
};

/** Every statement type an option may name, for the option schema. */
export const statementTypes: readonly string[] = Object.keys(tests);

/** A labeled statement matches as the statement it labels. */
function unlabeled(node: ESTree.Node): ESTree.Node {
  return node.type === "LabeledStatement" ? unlabeled(node.body) : node;
}

/** Whether the statement has one of `types`; a name outside {@link statementTypes} matches nothing. */
export function matchesAny(node: ESTree.Node, types: readonly string[], sourceCode: SourceCode): boolean {
  const statement = unlabeled(node);
  return types.some((type) => Object.hasOwn(tests, type) && tests[type]?.(statement, sourceCode) === true);
}
