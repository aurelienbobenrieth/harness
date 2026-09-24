/**
 * Require invoked and spawned actors to be referenced by their `setup({ actors })` key.
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
import { findProperty, importsFrom, isInsideMachineConfig } from "../ast.js";
import { importedName } from "../binding-support.js";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const actorMessage =
  "Inline actor logic cannot be persisted, mocked with machine.provide(), or typed by setup(): declare it under setup({ actors }) and reference it by its string key.";

const guardMessage =
  "Inline guard functions cannot be reused, mocked with machine.provide(), or typed by setup(): declare the guard under setup({ guards }) and reference it by its string key.";

type RuleOptions = { readonly checkSpawn?: boolean; readonly guards?: boolean };

function option(context: Context, name: keyof RuleOptions): boolean {
  const first = context.options[0];
  return typeof first === "object" && first !== null && (first as RuleOptions)[name] === true;
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

/** Actor logic written inline: a call, a function, or an identifier that is not a string constant. */
function inlineLogic(context: Context, node: ESTree.Node | undefined): ESTree.Node | undefined {
  if (node === undefined || node.type === "SpreadElement") return undefined;
  const value = unwrapExpressionKeepingChain(node);
  if (value.type === "CallExpression" || value.type === "NewExpression" || isFunctionNode(value)) return value;
  if (value.type === "Identifier" && value.name !== "undefined" && !isStringConstant(context, value)) return value;
  return undefined;
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

export const namedActorSrc: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require invoke.src and spawnChild() to reference actors declared in setup({ actors }) by string key instead of inline actor logic.",
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
    return {
      Program(node) {
        enabled = importsFrom(node, ["xstate"]);
      },
      Property(node) {
        if (!enabled || parentOf(node)?.type !== "ObjectExpression") return;
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
          const source = findProperty(unwrapExpressionKeepingChain(invocation), "src");
          const inline = inlineLogic(context, source?.value);
          if (inline !== undefined) context.report({ node: inline, messageId: "namedActorSrc" });
        }
      },
      CallExpression(node) {
        if (!enabled) return;
        const isSpawnChild =
          importedName(context, node.callee) === "spawnChild" ||
          (node.callee.type === "MemberExpression" &&
            node.callee.object.type === "Identifier" &&
            memberPropertyName(node.callee) === "spawnChild");
        if (!isSpawnChild && !(option(context, "checkSpawn") && isSpawnerParameter(context, node.callee))) return;
        const inline = inlineLogic(context, node.arguments[0]);
        if (inline !== undefined) context.report({ node: inline, messageId: "namedActorSrc" });
      },
    };
  },
};
