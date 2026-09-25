/**
 * Syntactic model of Alchemy v2 Runtime declarations shared by this plugin's rules.
 *
 * A Runtime declaration is a call that pairs a resource with its Effectful
 * Constructor (the "init"): `Cloudflare.Worker(id, props, init)`, the class form
 * `Cloudflare.Worker<Self>()(id, props, init)`, or `Tag.make(props, init)` on a
 * class declared in the same file as `Cloudflare.Worker<Self>()(id)`. The init
 * runs at deploy time and at cold start; the expression it returns (handlers,
 * Durable Object instance, Workflow body) runs only inside the deployed runtime.
 *
 * Recognition is purely lexical: inits assembled in another file, passed by
 * identifier, or built through helper functions are not seen.
 *
 * @module
 */
import {
  type FunctionNode,
  binding,
  importedNameFrom,
  importedSpecifierName,
  isFunctionNode,
  memberPropertyName,
  nearestFunction,
  parentOf,
  stringLiteralValue,
  unwrapExpression,
  walk,
} from "@aurelienbbn/oxlint-kit/ast";
import type { Context, ESTree } from "@oxlint/plugins";

type RuntimeKind = "worker" | "durable-object" | "workflow" | "lambda";

/** Qualified Alchemy export paths of the Runtimes this plugin understands, checked against alchemy 2.0.0-beta.79. */
const runtimeKinds: ReadonlyMap<string, RuntimeKind> = new Map([
  ["Cloudflare.Worker", "worker"],
  ["Cloudflare.Workers.Worker", "worker"],
  ["Cloudflare.DurableObject", "durable-object"],
  ["Cloudflare.Workers.DurableObject", "durable-object"],
  ["Cloudflare.Workflow", "workflow"],
  ["Cloudflare.Workflows.Workflow", "workflow"],
  ["AWS.Lambda.Function", "lambda"],
]);

type RuntimeDeclaration = {
  readonly kind: RuntimeKind;
  readonly call: ESTree.CallExpression;
  /** Props object argument, when the declaration form carries one. */
  readonly props: ESTree.Node | undefined;
  /** The init Effect (last argument), when it is written inline as `Effect.gen(...)` or `Effect.succeed(...)`. */
  readonly init: ESTree.Node | undefined;
};

function stripInstantiation(node: ESTree.Node): ESTree.Node {
  const value = unwrapExpression(node);
  return value.type === "TSInstantiationExpression" ? unwrapExpression(value.expression) : value;
}

/**
 * Dotted Alchemy export path a reference resolves to, relative to the `alchemy`
 * package: `Cloudflare.Worker` for `Cloudflare.Worker` with
 * `import * as Cloudflare from "alchemy/Cloudflare"` or for `Worker` with
 * `import { Worker } from "alchemy/Cloudflare"`.
 */
export function alchemyPath(context: Context, node: ESTree.Node): string | undefined {
  const members: string[] = [];
  let current = stripInstantiation(node);
  while (current.type === "MemberExpression") {
    const name = memberPropertyName(current);
    if (name === undefined) return undefined;
    members.unshift(name);
    current = stripInstantiation(current.object);
  }
  if (current.type !== "Identifier") return undefined;
  for (const definition of binding(context, current, current.name)?.defs ?? []) {
    const declaration = definition.parent;
    if (declaration?.type !== "ImportDeclaration") continue;
    const source = String(declaration.source.value);
    if (source !== "alchemy" && !source.startsWith("alchemy/")) return undefined;
    const segments = source.split("/").slice(1);
    const specifier = definition.node;
    if (specifier.type === "ImportSpecifier") {
      const imported = specifier.imported;
      segments.push(imported.type === "Identifier" ? imported.name : String(imported.value));
    } else if (specifier.type !== "ImportNamespaceSpecifier" && specifier.type !== "ImportDefaultSpecifier") {
      return undefined;
    }
    return [...segments, ...members].join(".");
  }
  return undefined;
}

/** Member name of `<Module>.<member>` when `<Module>` is `effect/<Module>` or `{ <Module> } from "effect"`. */
export function effectMember(context: Context, node: ESTree.Node, moduleName: string): string | undefined {
  const target = unwrapExpression(node);
  const name = memberPropertyName(target);
  if (name === undefined || target.type !== "MemberExpression") return undefined;
  const owner = unwrapExpression(target.object);
  if (
    owner.type === "Identifier" &&
    importedSpecifierName(context, owner, (source) => source === "effect") === moduleName
  )
    return name;
  return importedNameFrom(context, target, [`effect/${moduleName}`]) === name ? name : undefined;
}

/** Strip trailing `.pipe(...)` calls: `Effect.gen(fn).pipe(Effect.provide(layer))` yields `Effect.gen(fn)`. */
function unpiped(node: ESTree.Node): ESTree.Node {
  let current = unwrapExpression(node);
  while (current.type === "CallExpression") {
    const callee = unwrapExpression(current.callee);
    if (callee.type !== "MemberExpression" || memberPropertyName(callee) !== "pipe") break;
    current = unwrapExpression(callee.object);
  }
  return current;
}

/** The outermost `.pipe(...)` chain that starts at `node`, so upward walks land on the expression actually passed. */
function outermostPipe(node: ESTree.Node): ESTree.Node {
  let current: ESTree.Node = node;
  for (;;) {
    const member = parentOf(current);
    const call = member === undefined ? undefined : parentOf(member);
    if (
      member?.type !== "MemberExpression" ||
      member.object !== current ||
      memberPropertyName(member) !== "pipe" ||
      call?.type !== "CallExpression" ||
      call.callee !== member
    )
      return current;
    current = call;
  }
}

/** Generator passed to `Effect.gen(...)` (optionally piped), if `node` is such a call. */
export function effectGenGenerator(context: Context, node: ESTree.Node): FunctionNode | undefined {
  const call = unpiped(node);
  if (call.type !== "CallExpression" || effectMember(context, call.callee, "Effect") !== "gen") return undefined;
  const last = call.arguments.at(-1);
  return isFunctionNode(last) ? last : undefined;
}

function looksLikeInit(context: Context, node: ESTree.Node | undefined): boolean {
  if (node === undefined) return false;
  const call = unpiped(node);
  if (call.type !== "CallExpression") return false;
  const method = effectMember(context, call.callee, "Effect");
  return method === "gen" || method === "succeed";
}

type CalleeForm = { readonly kind: RuntimeKind; readonly form: "direct" | "make" };

function tagKind(context: Context, node: ESTree.Node): RuntimeKind | undefined {
  const value = stripInstantiation(node);
  if (value.type !== "CallExpression" || value.arguments.length > 0) return undefined;
  return runtimeKinds.get(alchemyPath(context, value.callee) ?? "");
}

/** `Tag.make` where `Tag` is a class in this file extending `<Runtime><Self>()(id, ...)`. */
function makeReceiverKind(context: Context, callee: ESTree.Node): RuntimeKind | undefined {
  if (callee.type !== "MemberExpression" || memberPropertyName(callee) !== "make") return undefined;
  const receiver = unwrapExpression(callee.object);
  if (receiver.type !== "Identifier") return undefined;
  for (const definition of binding(context, receiver, receiver.name)?.defs ?? []) {
    const declared = definition.node;
    if (declared.type !== "ClassDeclaration" || declared.superClass === null || declared.superClass === undefined)
      continue;
    const superCall = unwrapExpression(declared.superClass);
    if (superCall.type === "CallExpression") return tagKind(context, superCall.callee);
  }
  return undefined;
}

function calleeForm(context: Context, call: ESTree.CallExpression): CalleeForm | undefined {
  const callee = stripInstantiation(call.callee);
  const direct = runtimeKinds.get(alchemyPath(context, callee) ?? "") ?? tagKind(context, callee);
  if (direct !== undefined) return { kind: direct, form: "direct" };
  const made = makeReceiverKind(context, callee);
  return made === undefined ? undefined : { kind: made, form: "make" };
}

/** Recognize an Alchemy Runtime declaration call; see the module documentation for the accepted forms. */
export function runtimeDeclaration(context: Context, call: ESTree.CallExpression): RuntimeDeclaration | undefined {
  const shape = calleeForm(context, call);
  if (shape === undefined) return undefined;
  const args = call.arguments as readonly ESTree.Node[];
  const last = args.at(-1);
  const init = looksLikeInit(context, last) ? last : undefined;
  const propsIndex = shape.form === "make" ? 0 : 1;
  const propsCandidate = args[propsIndex];
  const props = propsCandidate !== undefined && propsCandidate !== init ? propsCandidate : undefined;
  return { kind: shape.kind, call, props, init };
}

/** Expressions a function returns: `return` arguments owned by it, or an arrow's expression body. */
export function returnedExpressions(fn: FunctionNode): readonly ESTree.Node[] {
  const body = fn.body;
  if (body === null) return [];
  if (body.type !== "BlockStatement") return [body];
  const returned: ESTree.Node[] = [];
  walk(body, (node) => {
    if (isFunctionNode(node)) return false;
    if (node.type === "ReturnStatement" && node.argument !== null && node.argument !== undefined)
      returned.push(node.argument);
    return undefined;
  });
  return returned;
}

/** Init generator of `declaration`, when its init is written as `Effect.gen(function* () { ... })`. */
export function initGenerator(context: Context, declaration: RuntimeDeclaration): FunctionNode | undefined {
  return declaration.init === undefined ? undefined : effectGenGenerator(context, declaration.init);
}

/** True for `Effect.gen(...)`, `Effect.fn(...)` or `Effect.fn(name)(...)`, optionally piped: a deferred handler Effect. */
function isDeferredEffect(context: Context, node: ESTree.Node): boolean {
  const call = unpiped(node);
  if (call.type !== "CallExpression") return false;
  const callee = unwrapExpression(call.callee);
  const method = effectMember(context, callee.type === "CallExpression" ? callee.callee : callee, "Effect");
  return method === "gen" || method === "fn";
}

/** Identifiers a returned expression hands out by reference: `return fetch`, `return { fetch }`, `return { fetch: run }`. */
function returnedReferences(returned: ESTree.Node): readonly ESTree.Node[] {
  const value = unwrapExpression(returned);
  if (value.type === "Identifier") return [value];
  if (value.type !== "ObjectExpression") return [];
  return value.properties.flatMap((property) =>
    property.type === "Property" ? [unwrapExpression(property.value as ESTree.Node)] : [],
  );
}

/**
 * Initializers of `const` handlers declared in the init generator and returned
 * by reference, such as `const fetch = Effect.gen(...); return { fetch }`.
 * A const the init also runs itself (`yield* warmup`) stays init code.
 */
function returnedHandlerInitializers(
  context: Context,
  generator: FunctionNode,
  returned: readonly ESTree.Node[],
): readonly ESTree.Node[] {
  const initializers: ESTree.Node[] = [];
  for (const reference of returned.flatMap(returnedReferences)) {
    if (reference.type !== "Identifier") continue;
    const variable = binding(context, reference, reference.name);
    for (const definition of variable?.defs ?? []) {
      const declarator = definition.node;
      const declaration = parentOf(declarator);
      if (declarator.type !== "VariableDeclarator" || declarator.init === null || declarator.init === undefined)
        continue;
      if (declaration?.type !== "VariableDeclaration" || declaration.kind !== "const") continue;
      if (nearestFunction(declarator) !== generator || !isDeferredEffect(context, declarator.init)) continue;
      const runByInit = (variable?.references ?? []).some((use) => {
        const parent = parentOf(use.identifier);
        return parent?.type === "YieldExpression" && nearestFunction(parent) === generator;
      });
      if (!runByInit) initializers.push(declarator.init);
    }
  }
  return initializers;
}

/**
 * Runtime-phase expressions of a declaration: what the init generator returns
 * (plus the `const` handlers it returns by reference), or the value of an
 * `Effect.succeed(...)` init.
 */
export function runtimeRoots(context: Context, declaration: RuntimeDeclaration): readonly ESTree.Node[] {
  if (declaration.init === undefined) return [];
  const generator = initGenerator(context, declaration);
  if (generator !== undefined) {
    const returned = returnedExpressions(generator);
    return [...returned, ...returnedHandlerInitializers(context, generator, returned)];
  }
  const succeed = unpiped(declaration.init);
  return succeed.type === "CallExpression" ? (succeed.arguments as readonly ESTree.Node[]).slice(0, 1) : [];
}

/** Runtime declaration whose init generator is `fn`, when `fn` is one. */
export function declarationOfInitGenerator(context: Context, fn: FunctionNode): RuntimeDeclaration | undefined {
  const genCall = parentOf(fn);
  if (genCall?.type !== "CallExpression" || genCall.arguments.at(-1) !== fn) return undefined;
  if (effectMember(context, genCall.callee, "Effect") !== "gen") return undefined;
  const passed = outermostPipe(genCall);
  const owner = parentOf(passed);
  if (owner?.type !== "CallExpression" || owner.arguments.at(-1) !== passed) return undefined;
  const declaration = runtimeDeclaration(context, owner);
  return declaration?.init === passed ? declaration : undefined;
}

/**
 * The init generator that returns `node` directly, and its declaration: for
 * `return Effect.gen(...)` or `return Effect.fn(...)` inside an init.
 */
export function returningInit(
  context: Context,
  node: ESTree.Node,
): { readonly generator: FunctionNode; readonly declaration: RuntimeDeclaration } | undefined {
  const passed = outermostPipe(node);
  const statement = parentOf(passed);
  if (statement?.type !== "ReturnStatement" || statement.argument !== passed) return undefined;
  const generator = nearestFunction(statement);
  if (generator === undefined) return undefined;
  const declaration = declarationOfInitGenerator(context, generator);
  return declaration === undefined ? undefined : { generator, declaration };
}

/**
 * True when `node` sits in the arguments of a call accepted by `matches`,
 * found on the way up from `node` to (excluding) `stop`.
 */
export function insideCallArguments(
  node: ESTree.Node,
  stop: ESTree.Node,
  matches: (call: ESTree.CallExpression) => boolean,
): boolean {
  let child: ESTree.Node = node;
  let current = parentOf(node);
  while (current !== undefined && current !== stop) {
    if (current.type === "CallExpression" && current.callee !== child && matches(current)) return true;
    child = current;
    current = parentOf(current);
  }
  return false;
}

/** True when `inner` lies inside `outer` (inclusive), by source range. */
export function isWithin(inner: ESTree.Node, outer: ESTree.Node): boolean {
  return inner.range[0] >= outer.range[0] && inner.range[1] <= outer.range[1];
}

const configConstructors: ReadonlySet<string> = new Set([
  "Array",
  "Boolean",
  "ByteSize",
  "Date",
  "Duration",
  "Finite",
  "Int",
  "Literal",
  "Literals",
  "LogLevel",
  "NonEmptyString",
  "Number",
  "Port",
  "Record",
  "Redacted",
  "String",
  "URL",
  "schema",
  // Effect 3 spellings, still common in migrated code.
  "boolean",
  "date",
  "duration",
  "integer",
  "literal",
  "logLevel",
  "nonEmptyString",
  "number",
  "port",
  "redacted",
  "secret",
  "string",
  "url",
]);

/** Environment key read by a `Config.<constructor>(..., "KEY")` call written with a literal key. */
export function configKey(context: Context, node: ESTree.Node): string | undefined {
  if (node.type !== "CallExpression") return undefined;
  const constructor = effectMember(context, node.callee, "Config");
  if (constructor === undefined || !configConstructors.has(constructor)) return undefined;
  // `Config.Literal("prod", "STAGE")`: the first argument is the expected value, never the key.
  const candidates = constructor.toLowerCase() === "literal" ? node.arguments.slice(1) : node.arguments;
  for (const argument of candidates.toReversed()) {
    const key = stringLiteralValue(argument as ESTree.Node);
    if (key !== undefined) return key;
  }
  return undefined;
}
