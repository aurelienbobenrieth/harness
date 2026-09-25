import type { Context, ESTree } from "@oxlint/plugins";
import { binding, parentOf, unwrapExpressionKeepingChain } from "@aurelienbbn/oxlint-kit/ast";
import { findProperty, propertyName, someNode } from "./ast.js";
import { importedQueryName } from "./binding-support.js";

/**
 * Hooks whose `data` is `undefined` until the first fetch settles. Suspense
 * hooks are excluded on purpose: their data is defined on first render, so
 * seeding local state from it is a legitimate initial-value pattern.
 */
const pendingDataHooks: ReadonlySet<string> = new Set(["useQuery", "useInfiniteQuery", "useQueries"]);

const reactSources: ReadonlySet<string> = new Set(["react", "preact/hooks", "preact/compat"]);

/** True when the callee is the named React hook, through a named import (aliases included) or a `React.` namespace. */
export function isReactHook(context: Context, callee: ESTree.Node, hook: string): boolean {
  if (callee.type === "Identifier") {
    return (binding(context, callee, callee.name)?.defs ?? []).some((definition) => {
      if (definition.node.type !== "ImportSpecifier" || definition.parent?.type !== "ImportDeclaration") return false;
      if (!reactSources.has(String(definition.parent.source.value))) return false;
      const imported = definition.node.imported;
      return (imported.type === "Identifier" ? imported.name : String(imported.value)) === hook;
    });
  }
  if (
    callee.type !== "MemberExpression" ||
    callee.computed ||
    callee.property.type !== "Identifier" ||
    callee.property.name !== hook ||
    callee.object.type !== "Identifier"
  )
    return false;
  return (binding(context, callee.object, callee.object.name)?.defs ?? []).some(
    (definition) =>
      (definition.node.type === "ImportNamespaceSpecifier" || definition.node.type === "ImportDefaultSpecifier") &&
      definition.parent?.type === "ImportDeclaration" &&
      reactSources.has(String(definition.parent.source.value)),
  );
}

function isBindingReference(identifier: ESTree.Node): boolean {
  const parent = parentOf(identifier);
  if (parent?.type === "MemberExpression" && parent.property === identifier && !parent.computed) return false;
  if (parent?.type === "Property" && parent.key === identifier && !parent.computed && parent.value !== identifier)
    return false;
  return true;
}

/** Destructuring path from a declared name up to its declarator, outermost key last. */
function destructuredKeys(name: ESTree.Node, declarator: ESTree.VariableDeclarator): readonly string[] | undefined {
  const keys: string[] = [];
  let current: ESTree.Node = name;
  while (current !== declarator.id) {
    const parent = parentOf(current);
    if (parent === undefined) return undefined;
    if (parent.type === "AssignmentPattern" && parent.left === current) {
      current = parent;
    } else if (parent.type === "Property" && parent.value === current) {
      const key = propertyName(parent);
      const pattern = parentOf(parent);
      if (key === undefined || pattern === undefined) return undefined;
      keys.push(key);
      current = pattern;
    } else if (parent.type === "ArrayPattern") {
      current = parent;
    } else {
      return undefined;
    }
  }
  return keys;
}

function readsDataMember(identifier: ESTree.Node): boolean {
  let current: ESTree.Node = identifier;
  for (;;) {
    const parent = parentOf(current);
    if (parent === undefined) return false;
    if (parent.type === "TSNonNullExpression" || parent.type === "ChainExpression") {
      current = parent;
      continue;
    }
    if (parent.type !== "MemberExpression" || parent.object !== current) return false;
    if (!parent.computed && parent.property.type === "Identifier" && parent.property.name === "data") return true;
    current = parent;
  }
}

/**
 * True when the identifier reads data produced by `useQuery`, `useInfiniteQuery`
 * or `useQueries` imported from a TanStack Query package: a destructured `data`
 * (aliases and defaults included) or `result.data` on the whole result. Queries
 * seeded with `initialData` are skipped because their data is never undefined.
 */
function isQueryDataReference(context: Context, identifier: ESTree.Node): boolean {
  if (identifier.type !== "Identifier" || !isBindingReference(identifier)) return false;
  for (const definition of binding(context, identifier, identifier.name)?.defs ?? []) {
    const declarator = definition.node;
    if (declarator.type !== "VariableDeclarator" || declarator.init === null) continue;
    const call = unwrapExpressionKeepingChain(declarator.init);
    if (call.type !== "CallExpression") continue;
    const hook = importedQueryName(context, call.callee);
    if (hook === undefined || !pendingDataHooks.has(hook)) continue;
    const options = call.arguments[0];
    if (options?.type === "ObjectExpression" && findProperty(options, "initialData") !== undefined) continue;
    const keys = destructuredKeys(definition.name, declarator);
    if (keys === undefined) continue;
    if (keys.length === 0 ? readsDataMember(identifier) : keys.at(-1) === "data") return true;
  }
  return false;
}

export function referencesQueryData(context: Context, root: ESTree.Node): boolean {
  return someNode(root, (node) => isQueryDataReference(context, node));
}
