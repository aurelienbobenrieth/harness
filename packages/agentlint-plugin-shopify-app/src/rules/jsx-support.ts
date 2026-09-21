import type { AgentlintNode } from "@aurelienbbn/agentlint";

/** Tests configurable patterns without inheriting a previous match position. */
export function matchesPattern(pattern: RegExp, text: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

/** Reads only the element's grammar name; prop text cannot impersonate an element. */
export function elementName(node: AgentlintNode): string | undefined {
  return node.childByFieldName("name")?.text;
}

/** Finds a direct JSX attribute; spreads and nested expressions are not resolved. */
function attribute(node: AgentlintNode, name: string): AgentlintNode | undefined {
  return node.children.find(
    (child) => child.type === "jsx_attribute" && child.children.find((part) => part.isNamed)?.text === name,
  );
}

/** Undefined means absent, null means dynamic, and literals retain their value. */
export function attributeValue(node: AgentlintNode, name: string): string | boolean | null | undefined {
  const found = attribute(node, name);
  if (!found) return undefined;
  const parts = found.children.filter((child) => child.isNamed);
  const value = parts[1];
  if (!value) return true;
  const literal = value.type === "jsx_expression" ? value.children.find((child) => child.isNamed) : value;
  if (literal?.type === "string") return literal.text.slice(1, -1);
  if (literal?.type === "true") return true;
  if (literal?.type === "false" || literal?.type === "null" || literal?.type === "undefined") return false;
  return null;
}

/** A node may carry runtime content unless its literal value is empty or disabled. */
export function hasPossibleAttributeValue(node: AgentlintNode, name: string): boolean {
  const value = attributeValue(node, name);
  return value !== undefined && value !== false && (typeof value !== "string" || value.trim() !== "");
}

/** Returns the opening node of a direct JSX text or literal expression owner. */
export function textOwner(node: AgentlintNode): AgentlintNode | undefined {
  const parent = node.parent?.type === "jsx_expression" ? node.parent.parent : node.parent;
  if (parent?.type !== "jsx_element") return undefined;
  return parent.children.find((child) => child.type === "jsx_opening_element");
}
