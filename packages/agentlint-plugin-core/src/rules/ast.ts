import type { AgentlintNode } from "@aurelienbbn/agentlint";

const opaqueNodeTypes = new Set(["comment", "string", "template_string", "regex"]);

const functionNodeTypes = new Set([
  "function_declaration",
  "function_expression",
  "arrow_function",
  "generator_function",
  "generator_function_declaration",
  "method_definition",
]);

/** Source text of a node with comments, strings, templates and regexes blanked, so keywords inside literals never match. */
export function codeText(node: AgentlintNode): string {
  if (opaqueNodeTypes.has(node.type)) return " ";
  if (node.children.length === 0) return node.text;
  let cursor = 0;
  let source = "";
  for (const child of node.children) {
    const start = node.text.indexOf(child.text, cursor);
    if (start < 0) continue;
    source += node.text.slice(cursor, start) + codeText(child);
    cursor = start + child.text.length;
  }
  return source + node.text.slice(cursor);
}

export function isFunctionNode(node: AgentlintNode): boolean {
  return functionNodeTypes.has(node.type);
}

/** Nearest enclosing function, or the root node when the code runs at module level. */
export function enclosingScope(node: AgentlintNode): AgentlintNode {
  let current = node;
  while (current.parent !== null) {
    current = current.parent;
    if (isFunctionNode(current)) return current;
  }
  return current;
}

/** Stable per-file identity for a node, usable as a grouping or finding key. */
export function nodeKey(node: AgentlintNode): string {
  return `${node.type}@${node.startPosition.row}:${node.startPosition.column}`;
}

const logCalleePattern = /^(?:console|logger|log|this\.logger|this\.log)\b/i;
const reasonCommentPattern = /(?:\/\/|\/\*+|\*)\s*REASON:\s*\S+(?:\s+\S+){2,}/;

/**
 * True when an error handler discards the failure: it never throws, the caught binding is absent or only
 * forwarded to logging calls, and no `REASON:` comment of at least three words justifies the silence.
 */
export function discardsCaughtError(body: AgentlintNode, bindingName: string | undefined): boolean {
  if (body.type === "throw_statement" || body.descendantsOfType("throw_statement").length > 0) return false;
  if (body.descendantsOfType("comment").some((comment) => reasonCommentPattern.test(comment.text))) return false;
  if (bindingName === undefined) return true;

  return body
    .descendantsOfType("identifier")
    .filter((identifier) => identifier.text === bindingName)
    .every((identifier) => isLogArgument(identifier, body));
}

function isLogArgument(identifier: AgentlintNode, boundary: AgentlintNode): boolean {
  let current: AgentlintNode | null = identifier.parent;
  while (current !== null && nodeKey(current) !== nodeKey(boundary)) {
    if (current.type === "call_expression") {
      const callee = current.childByFieldName("function");
      return callee !== null && logCalleePattern.test(callee.text);
    }
    current = current.parent;
  }
  return false;
}
