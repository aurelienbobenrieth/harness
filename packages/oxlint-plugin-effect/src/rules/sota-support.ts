import { binding, type FunctionNode } from "@aurelienbbn/oxlint-kit/ast";
import type { Context, ESTree } from "@oxlint/plugins";
import { isModuleNamespace } from "./binding-support.js";

/** Return the member name of `<Module>.<member>` when the object resolves to that effect module. */
export function moduleMethod(context: Context, node: ESTree.Node, moduleName: string): string | undefined {
  if (
    node.type !== "MemberExpression" ||
    node.computed ||
    node.property.type !== "Identifier" ||
    !isModuleNamespace(context, node.object, moduleName)
  )
    return undefined;
  return node.property.name;
}

/** True when the identifier resolves to no local binding, i.e. it is the ambient global. */
export function isUnshadowedGlobal(context: Context, node: ESTree.Node, name: string): boolean {
  if (node.type !== "Identifier" || node.name !== name) return false;
  const variable = binding(context, node, name);
  return variable === undefined || variable.defs.length === 0;
}

/** True when the function's first parameter is absent or never read in its body. */
export function ignoresFirstParameter(context: Context, fn: FunctionNode): boolean {
  const first = fn.params[0];
  if (first === undefined) return true;
  const variables = context.sourceCode.getDeclaredVariables(fn);
  const declared = variables.filter((variable) =>
    variable.identifiers.some((identifier) => isWithin(identifier, first)),
  );
  if (declared.length === 0) return false;
  return declared.every((variable) => variable.references.every((reference) => !reference.isRead()));
}

function isWithin(inner: ESTree.Node, outer: ESTree.Node): boolean {
  return inner.range[0] >= outer.range[0] && inner.range[1] <= outer.range[1];
}

export function stringArrayOption(
  options: Readonly<Record<string, unknown>>,
  name: string,
  fallback: readonly string[],
): readonly string[] {
  const value = options[name];
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : fallback;
}

export function booleanOption(options: Readonly<Record<string, unknown>>, name: string, fallback: boolean): boolean {
  const value = options[name];
  return typeof value === "boolean" ? value : fallback;
}

export function propertyNamed(node: ESTree.Node | undefined, name: string): ESTree.ObjectProperty | undefined {
  if (node?.type !== "ObjectExpression") return undefined;
  for (const property of node.properties) {
    if (property.type !== "Property" || property.computed) continue;
    const key = property.key;
    if ((key.type === "Identifier" && key.name === name) || (key.type === "Literal" && key.value === name))
      return property;
  }
  return undefined;
}
