import { binding, importedSpecifierName } from "@aurelienbbn/oxlint-kit/ast";
import type { Context, ESTree, Variable } from "@oxlint/plugins";

/**
 * Recognize a root Effect module (`Effect`, `Layer`, `Schema`...) through its import and aliases without matching
 * local shadows. An unbound identifier only matches when it carries the canonical module name.
 */
export function isModuleNamespace(context: Context, node: ESTree.Node, moduleName: string): boolean {
  if (node.type !== "Identifier") return false;
  const variable = binding(context, node, node.name);
  if (variable === undefined) return node.name === moduleName;
  return variable.defs.some((definition) => {
    if (definition.parent?.type !== "ImportDeclaration") return false;
    const source = definition.parent.source.value;
    if (definition.node.type === "ImportNamespaceSpecifier") return source === `effect/${moduleName}`;
    if (definition.node.type !== "ImportSpecifier" || source !== "effect") return false;
    const name = definition.node.imported;
    return name.type === "Identifier" && name.name === moduleName;
  });
}

/** Recognize Effect imports and aliases without matching local shadows. */
function isEffectNamespace(context: Context, node: ESTree.Node): boolean {
  return isModuleNamespace(context, node, "Effect");
}

/** Resolve the member name of `<Module>.<member>` or `<Module>["member"]` for an alias-aware module reference. */
export function moduleMethod(context: Context, node: ESTree.Node, moduleName: string): string | undefined {
  if (node.type !== "MemberExpression" || !isModuleNamespace(context, node.object, moduleName)) return undefined;
  if (!node.computed) return node.property.type === "Identifier" ? node.property.name : undefined;
  return node.property.type === "Literal" && typeof node.property.value === "string" ? node.property.value : undefined;
}

export function effectMethod(context: Context, node: ESTree.Node): string | undefined {
  if (
    node.type !== "MemberExpression" ||
    node.computed ||
    node.property.type !== "Identifier" ||
    !isEffectNamespace(context, node.object)
  )
    return undefined;
  return node.property.name;
}

/** Effect constructors whose function argument is a generator body executed by the Effect runtime. */
const effectBodyMethods: ReadonlySet<string> = new Set(["gen", "fn", "fnUntraced", "fnUntracedEager"]);

/**
 * Resolve the Effect function a callee denotes: a member of an alias-aware `Effect` namespace (`Effect.gen`) or a
 * named import from `effect/Effect` (`import { gen as g } from "effect/Effect"`). A same-named local never matches.
 */
function effectCallee(context: Context, callee: ESTree.Node): string | undefined {
  return (
    effectMethod(context, callee) ?? importedSpecifierName(context, callee, (source) => source === "effect/Effect")
  );
}

/** Resolve the body constructor of the call `node` is an argument of, direct (`gen(body)`) or curried (`fn("x")(body)`). */
function bodyCallMethod(context: Context, node: ESTree.Node): string | undefined {
  const parent = node.parent;
  if (parent?.type !== "CallExpression") return undefined;
  if (!parent.arguments.some((argument) => argument === node)) return undefined;

  const method = effectCallee(context, parent.callee.type === "CallExpression" ? parent.callee.callee : parent.callee);
  return method !== undefined && effectBodyMethods.has(method) ? method : undefined;
}

/**
 * The variable a generator is bound to when declared by name: `function* program() {}` or
 * `const program = function* () {}`.
 */
function generatorBinding(context: Context, node: ESTree.Node): Variable | undefined {
  if (node.type === "FunctionDeclaration" && node.id !== null) {
    const id = node.id;
    return context.sourceCode.getDeclaredVariables(node).find((variable) => variable.identifiers.includes(id));
  }
  const declarator = node.parent;
  if (
    node.type !== "FunctionExpression" ||
    declarator?.type !== "VariableDeclarator" ||
    declarator.init !== node ||
    declarator.id.type !== "Identifier"
  )
    return undefined;
  const id = declarator.id;
  return context.sourceCode.getDeclaredVariables(declarator).find((variable) => variable.identifiers.includes(id));
}

/**
 * Resolve the Effect body constructor a generator runs under. Covers a generator passed inline, directly
 * (`Effect.gen(function* ...)`) or curried (`Effect.fn("name")(function* ...)`), through a namespace or a named
 * import, and a named generator passed by reference (`function* program() {}; Effect.gen(program)`), resolved
 * through its scope binding rather than its name.
 */
export function effectBodyMethod(context: Context, node: ESTree.Node): string | undefined {
  const inline = bodyCallMethod(context, node);
  if (inline !== undefined) return inline;
  if (!(node.type === "FunctionDeclaration" || node.type === "FunctionExpression") || !node.generator) return undefined;

  for (const reference of generatorBinding(context, node)?.references ?? []) {
    const method = reference.isRead() ? bodyCallMethod(context, reference.identifier) : undefined;
    if (method !== undefined) return method;
  }
  return undefined;
}

/**
 * Recognize a service dependency statement in an Effect body: a single-declarator `const x = yield* Service`
 * whose operand is a capitalized identifier, or `const x = yield* Effect.service(...)`.
 */
export function isServiceDependency(context: Context, statement: ESTree.Node): boolean {
  const initial =
    statement.type === "VariableDeclaration" && statement.declarations.length === 1
      ? statement.declarations[0]?.init
      : undefined;
  const argument = initial?.type === "YieldExpression" && initial.delegate ? initial.argument : undefined;
  return (
    (argument?.type === "Identifier" && /^[A-Z]/.test(argument.name)) ||
    (argument?.type === "CallExpression" && effectMethod(context, argument.callee) === "service")
  );
}

/** Resolve same-file aliases without revisiting cyclic type graphs. */
export function isUnsafeType(context: Context, type: ESTree.TSType, seen = new Set<ESTree.Node>()): boolean {
  if (seen.has(type)) return false;
  seen.add(type);
  if (type.type === "TSUnknownKeyword" || type.type === "TSAnyKeyword") return true;
  if (type.type === "TSParenthesizedType") return isUnsafeType(context, type.typeAnnotation, seen);
  if (type.type === "TSUnionType") return type.types.some((member) => isUnsafeType(context, member, seen));
  if (type.type !== "TSTypeReference" || type.typeName.type !== "Identifier") return false;
  return (binding(context, type.typeName, type.typeName.name)?.defs ?? []).some(
    (definition) =>
      definition.node.type === "TSTypeAliasDeclaration" && isUnsafeType(context, definition.node.typeAnnotation, seen),
  );
}
