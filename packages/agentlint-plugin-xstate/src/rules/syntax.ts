/**
 * Tree-sitter helpers shared by the XState rules: property keys, function parameters, and the two spawn spellings
 * that depend on which parameter a handler binds (v6 `enq.spawn(...)`, and `spawn(...)` destructured from the
 * first argument of a v5 `assign` updater or a context factory).
 */
import type { AgentlintNode } from "@aurelienbbn/agentlint";

const functionTypes = new Set([
  "arrow_function",
  "function_expression",
  "function",
  "function_declaration",
  "generator_function",
  "generator_function_declaration",
  "method_definition",
]);

/** Key of a `pair` or name of a `method_definition`, unquoted. */
export function propertyKey(node: AgentlintNode | null | undefined): string | undefined {
  if (node?.type !== "pair" && node?.type !== "method_definition") return undefined;
  const key = node.childByFieldName(node.type === "pair" ? "key" : "name") ?? node.children.find((c) => c.isNamed);
  return key?.text.replace(/^['"`]|['"`]$/g, "");
}

export function isFunction(node: AgentlintNode): boolean {
  return functionTypes.has(node.type);
}

/** Parameter binding patterns in declaration order, TypeScript and JavaScript grammars alike. */
function parameters(fn: AgentlintNode): ReadonlyArray<AgentlintNode> {
  const single = fn.childByFieldName("parameter");
  if (single) return [single];
  const list = fn.childByFieldName("parameters") ?? fn.children.find((child) => child.type === "formal_parameters");
  if (!list) return [];
  return list.children
    .filter((child) => child.isNamed && child.type !== "comment")
    .map((child) => {
      const pattern =
        child.type === "required_parameter" || child.type === "optional_parameter"
          ? (child.childByFieldName("pattern") ?? child.children.find((c) => c.isNamed))
          : child;
      return pattern?.type === "assignment_pattern"
        ? (pattern.childByFieldName("left") ?? pattern)
        : (pattern ?? child);
    });
}

function bindsName(pattern: AgentlintNode, name: string): boolean {
  if (pattern.type === "identifier") return pattern.text === name;
  if (pattern.type !== "object_pattern") return false;
  return pattern.children.some(
    (child) =>
      (child.type === "shorthand_property_identifier_pattern" && child.text === name) ||
      (child.type === "pair_pattern" && child.childByFieldName("value")?.text === name),
  );
}

/**
 * Index of the parameter of the nearest enclosing function that binds `name`, walking outwards so an inner
 * function shadowing the name wins. `undefined` when no enclosing function binds it.
 */
function bindingParameter(node: AgentlintNode, name: string): { index: number; destructured: boolean } | undefined {
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (!isFunction(ancestor)) continue;
    const params = parameters(ancestor);
    const index = params.findIndex((param) => bindsName(param, name));
    if (index >= 0) return { index, destructured: params[index]?.type === "object_pattern" };
  }
  return undefined;
}

function calleeOf(call: AgentlintNode): AgentlintNode | null {
  return call.type === "call_expression" ? call.childByFieldName("function") : null;
}

/** `enq.spawn(...)` where `enq` is the second parameter of an enclosing handler: the v6 enqueue object. */
export function isEnqueueSpawn(call: AgentlintNode): boolean {
  const callee = calleeOf(call);
  if (callee?.type !== "member_expression") return false;
  const receiver = callee.childByFieldName("object");
  if (receiver?.type !== "identifier" || callee.childByFieldName("property")?.text !== "spawn") return false;
  return bindingParameter(call, receiver.text)?.index === 1;
}

/** `spawn(...)` destructured from the first parameter: a v5 assign updater or a v5/v6 context factory. */
export function isDestructuredSpawn(call: AgentlintNode): boolean {
  const callee = calleeOf(call);
  if (callee?.type !== "identifier" || callee.text !== "spawn") return false;
  const binding = bindingParameter(call, "spawn");
  return binding?.index === 0 && binding.destructured;
}

/** Positional, non-comment arguments of a call. */
export function callArguments(call: AgentlintNode): ReadonlyArray<AgentlintNode> {
  return (call.childByFieldName("arguments")?.children ?? []).filter(
    (child) => child.isNamed && child.type !== "comment",
  );
}
