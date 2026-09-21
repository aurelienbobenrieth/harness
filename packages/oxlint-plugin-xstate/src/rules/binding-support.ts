import type { Context, ESTree, Scope, Variable } from "@oxlint/plugins";

export function binding(context: Context, node: ESTree.Node, name: string): Variable | undefined {
  let scope: Scope | null = context.sourceCode.getScope(node);
  while (scope !== null) {
    const variable = scope.set.get(name);
    if (variable !== undefined) return variable;
    scope = scope.upper;
  }
  return undefined;
}

export function importedName(context: Context, node: ESTree.Node): string | undefined {
  return importedNameFrom(context, node, xstateSources);
}

const xstateSources: readonly string[] = ["xstate"];

/** Resolve an identifier or `<namespace>.<member>` to its exported name when imported from one of the sources. */
export function importedNameFrom(context: Context, node: ESTree.Node, sources: readonly string[]): string | undefined {
  if (
    node.type === "MemberExpression" &&
    !node.computed &&
    node.object.type === "Identifier" &&
    node.property.type === "Identifier"
  ) {
    const imported = (binding(context, node.object, node.object.name)?.defs ?? []).some(
      (definition) =>
        definition.node.type === "ImportNamespaceSpecifier" &&
        definition.parent?.type === "ImportDeclaration" &&
        sources.includes(String(definition.parent.source.value)),
    );
    return imported ? node.property.name : undefined;
  }
  if (node.type !== "Identifier") return undefined;
  for (const definition of binding(context, node, node.name)?.defs ?? []) {
    if (
      definition.node.type !== "ImportSpecifier" ||
      definition.parent?.type !== "ImportDeclaration" ||
      !sources.includes(String(definition.parent.source.value))
    )
      continue;
    const imported = definition.node.imported;
    return imported.type === "Identifier" ? imported.name : String(imported.value);
  }
  return undefined;
}

const reactSources: readonly string[] = ["@xstate/react"];

function isReactHookCall(context: Context, node: ESTree.Node | null | undefined, hooks: readonly string[]): boolean {
  if (node?.type !== "CallExpression") return false;
  const imported = importedNameFrom(context, node.callee, reactSources);
  return imported !== undefined && hooks.includes(imported);
}

/** `<ActorContext>.useActorRef()` as returned by `createActorContext()`; matched by method name. */
function isContextActorRefCall(node: ESTree.Node | null | undefined): boolean {
  return (
    node?.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "useActorRef"
  );
}

function tupleIndex(declarator: ESTree.Node, name: string): number {
  if (declarator.type !== "VariableDeclarator" || declarator.id.type !== "ArrayPattern") return -1;
  return declarator.id.elements.findIndex((element) => element?.type === "Identifier" && element.name === name);
}

/**
 * True for an identifier bound to an actor ref: a `createActor(...)` result, a
 * `useActorRef(...)` result (imported or from an actor context), or the third
 * element of the `useMachine` / `useActor` tuple.
 */
export function isActor(context: Context, node: ESTree.Node): boolean {
  if (node.type !== "Identifier") return false;
  return (binding(context, node, node.name)?.defs ?? []).some((definition) => {
    if (definition.node.type !== "VariableDeclarator") return false;
    const initial = definition.node.init;
    if (definition.node.id.type === "ArrayPattern")
      return (
        tupleIndex(definition.node, node.name) === 2 && isReactHookCall(context, initial, ["useMachine", "useActor"])
      );
    if (definition.node.id.type !== "Identifier") return false;
    if (initial?.type === "CallExpression" && importedName(context, initial.callee) === "createActor") return true;
    return isReactHookCall(context, initial, ["useActorRef"]) || isContextActorRefCall(initial);
  });
}

/** True for the `send` function taken from the second slot of the `useMachine` / `useActor` tuple. */
export function isTupleSend(context: Context, node: ESTree.Node): boolean {
  if (node.type !== "Identifier") return false;
  return (binding(context, node, node.name)?.defs ?? []).some(
    (definition) =>
      definition.node.type === "VariableDeclarator" &&
      tupleIndex(definition.node, node.name) === 1 &&
      isReactHookCall(context, definition.node.init, ["useMachine", "useActor"]),
  );
}

/** True for the `enqueue` object destructured from the first parameter of an `enqueueActions` callback. */
export function isEnqueueParameter(context: Context, node: ESTree.Node): boolean {
  if (node.type !== "Identifier") return false;
  return (binding(context, node, node.name)?.defs ?? []).some((definition) => {
    if (definition.type !== "Parameter") return false;
    const fn = definition.node;
    if (fn.type !== "ArrowFunctionExpression" && fn.type !== "FunctionExpression" && fn.type !== "FunctionDeclaration")
      return false;
    const first = fn.params[0];
    return (
      first?.type === "ObjectPattern" &&
      first.properties.some(
        (property) =>
          property.type === "Property" &&
          !property.computed &&
          property.key.type === "Identifier" &&
          property.key.name === "enqueue" &&
          property.value.type === "Identifier" &&
          property.value.name === node.name,
      )
    );
  });
}
