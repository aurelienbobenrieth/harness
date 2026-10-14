/**
 * Require invoked and spawned actors to be referenced by their registered key
 * instead of inline actor logic.
 *
 * XState v5 files (any v5-only import such as `assign` or `fromPromise`, or a
 * `types` declaration) get the `invoke.src` and identifier checks; XState v6
 * persists inline invoked logic and recovers the key of registered logic values,
 * so v6 files only get the inline-logic check on `enq.spawn(...)` and `spawn(...)`.
 */
import {
  binding,
  isFunctionNode,
  memberPropertyName,
  parentOf,
  propertyKeyName,
  stringLiteralValue,
  unwrapExpressionKeepingChain,
} from "@aurelienbbn/oxlint-kit/ast";
import { findProperty, importsFrom, isEnqueuerParameter, isInsideMachineConfig } from "../ast.js";
import { importedName } from "../binding-support.js";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const actorMessage =
  "Inline actor logic cannot be persisted or replaced with machine.provide(): declare it under setup({ actors }) and reference it by its key.";

const guardMessage =
  "Inline guard functions cannot be reused, mocked with machine.provide(), or typed by setup(): declare the guard under setup({ guards }) and reference it by its string key.";

type RuleOptions = { readonly checkSpawn?: boolean; readonly guards?: boolean };

/** Runtime exports of XState v5 that v6 removed; importing one marks the file as v5. */
const v5OnlyExports: ReadonlySet<string> = new Set([
  "and",
  "assign",
  "cancel",
  "emit",
  "enqueueActions",
  "forwardTo",
  "fromCallback",
  "fromEventObservable",
  "fromObservable",
  "fromPromise",
  "fromTransition",
  "getInitialSnapshot",
  "getNextSnapshot",
  "interpret",
  "log",
  "not",
  "or",
  "raise",
  "sendParent",
  "sendTo",
  "spawnChild",
  "stateIn",
  "stop",
  "stopChild",
]);

const typedConfigCallees: ReadonlySet<string> = new Set(["setup", "createMachine"]);

function option(context: Context, name: keyof RuleOptions): boolean {
  const first = context.options[0];
  return typeof first === "object" && first !== null && (first as RuleOptions)[name] === true;
}

function importsV5Only(program: ESTree.Program): boolean {
  return program.body.some(
    (statement) =>
      statement.type === "ImportDeclaration" &&
      statement.source.value === "xstate" &&
      statement.specifiers.some(
        (specifier) =>
          specifier.type === "ImportSpecifier" &&
          v5OnlyExports.has(
            specifier.imported.type === "Identifier" ? specifier.imported.name : String(specifier.imported.value),
          ),
      ),
  );
}

/** `types` declared in the config of `setup(...)` or `createMachine(...)`: a v5-only key. */
function isTypesDeclaration(context: Context, node: ESTree.Node): boolean {
  if (propertyKeyName(node) !== "types") return false;
  const config = parentOf(node);
  const call = config === undefined ? undefined : parentOf(config);
  if (call?.type !== "CallExpression" || call.arguments[0] !== config) return false;
  const imported = importedName(context, call.callee);
  return imported !== undefined && typedConfigCallees.has(imported);
}

function isStringConstant(context: Context, node: ESTree.Node): boolean {
  if (node.type !== "Identifier") return false;
  const definitions = binding(context, node, node.name)?.defs ?? [];
  return (
    definitions.length > 0 &&
    definitions.every((definition) => {
      if (definition.node.type !== "VariableDeclarator") return false;
      const initial = definition.node.init;
      return (
        initial !== null &&
        initial !== undefined &&
        stringLiteralValue(unwrapExpressionKeepingChain(initial)) !== undefined
      );
    })
  );
}

/** Logic built at the use site: a call, a `new` expression, or a function. */
function builtInline(node: ESTree.Node | undefined): ESTree.Node | undefined {
  if (node === undefined || node.type === "SpreadElement") return undefined;
  const value = unwrapExpressionKeepingChain(node);
  return value.type === "CallExpression" || value.type === "NewExpression" || isFunctionNode(value) ? value : undefined;
}

/** An identifier that is not a string constant: unregistered logic for XState v5. */
function logicReference(context: Context, node: ESTree.Node | undefined): ESTree.Node | undefined {
  if (node === undefined || node.type === "SpreadElement") return undefined;
  const value = unwrapExpressionKeepingChain(node);
  return value.type === "Identifier" && value.name !== "undefined" && !isStringConstant(context, value)
    ? value
    : undefined;
}

function isSpawnerParameter(context: Context, node: ESTree.Node): boolean {
  if (node.type !== "Identifier" || node.name !== "spawn") return false;
  return (binding(context, node, node.name)?.defs ?? []).some((definition) => {
    if (definition.type !== "Parameter" || !isFunctionNode(definition.node)) return false;
    const first = definition.node.params[0];
    return (
      first?.type === "ObjectPattern" &&
      first.properties.some((property) => property.type === "Property" && propertyKeyName(property) === "spawn")
    );
  });
}

function isSpawnChild(context: Context, callee: ESTree.Node): boolean {
  return (
    importedName(context, callee) === "spawnChild" ||
    (callee.type === "MemberExpression" &&
      callee.object.type === "Identifier" &&
      memberPropertyName(callee) === "spawnChild")
  );
}

function isEnqueuerSpawn(context: Context, callee: ESTree.Node): boolean {
  return (
    callee.type === "MemberExpression" &&
    memberPropertyName(callee) === "spawn" &&
    isEnqueuerParameter(context, callee.object)
  );
}

export const namedActorSrc: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require invoke.src and spawnChild() (XState v5) and enq.spawn() (XState v6) to reference actors declared in setup({ actors }) by key instead of inline actor logic.",
    },
    messages: {
      namedActorSrc: actorMessage,
      namedGuard: guardMessage,
    },
    schema: [
      {
        type: "object",
        properties: {
          checkSpawn: { type: "boolean" },
          guards: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    let enabled = false;
    let v5File = false;
    let v5Only: ESTree.Node[] = [];

    function report(node: ESTree.Node): void {
      context.report({ node, messageId: "namedActorSrc" });
    }

    return {
      Program(node) {
        enabled = importsFrom(node, ["xstate", "@xstate/effect"]);
        v5File = importsV5Only(node);
        v5Only = [];
      },
      Property(node) {
        if (!enabled || parentOf(node)?.type !== "ObjectExpression") return;
        if (isTypesDeclaration(context, node)) v5File = true;
        const key = propertyKeyName(node);
        if (key === "guard") {
          if (!option(context, "guards") || !isFunctionNode(unwrapExpressionKeepingChain(node.value))) return;
          if (!isInsideMachineConfig(context, node)) return;
          context.report({ node: node.value, messageId: "namedGuard" });
          return;
        }
        if (key !== "invoke" || !isInsideMachineConfig(context, node)) return;
        const value = unwrapExpressionKeepingChain(node.value);
        const invocations = value.type === "ArrayExpression" ? value.elements : [value];
        for (const invocation of invocations) {
          if (invocation === null) continue;
          const source = findProperty(unwrapExpressionKeepingChain(invocation), "src")?.value;
          const inline = builtInline(source) ?? logicReference(context, source);
          if (inline !== undefined) v5Only.push(inline);
        }
      },
      CallExpression(node) {
        if (!enabled) return;
        const first = node.arguments[0];
        if (isSpawnChild(context, node.callee)) {
          const inline = builtInline(first) ?? logicReference(context, first);
          if (inline !== undefined) report(inline);
          return;
        }
        const spawner = option(context, "checkSpawn") && isSpawnerParameter(context, node.callee);
        if (!spawner && !isEnqueuerSpawn(context, node.callee)) return;
        const inline = builtInline(first);
        if (inline !== undefined) {
          report(inline);
          return;
        }
        const reference = spawner ? logicReference(context, first) : undefined;
        if (reference !== undefined) v5Only.push(reference);
      },
      "Program:exit"() {
        if (v5File) for (const node of v5Only) report(node);
        v5Only = [];
      },
    };
  },
};
