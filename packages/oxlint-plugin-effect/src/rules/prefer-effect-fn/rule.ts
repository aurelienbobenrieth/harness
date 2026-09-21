import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { effectMethod } from "../binding-support.js";
import { isFunctionNode, parentOf, unwrapExpression, walk, type FunctionNode } from "../sota-support.js";

const message =
  'Define this function with Effect.fn("name")(function* (...) { ... }) instead of wrapping Effect.gen: the wrapper has no span and no call-site stack frame. Use Effect.fnUntraced on hot paths.';

function soleResult(fn: FunctionNode): ESTree.Node | undefined {
  const body = fn.body;
  if (body === null) return undefined;
  if (body.type !== "BlockStatement") return unwrapExpression(body);
  const [only, ...rest] = body.body;
  if (only?.type !== "ReturnStatement" || rest.length > 0 || only.argument === null) return undefined;
  return unwrapExpression(only.argument);
}

function stripPipes(node: ESTree.Node): ESTree.Node {
  let current = node;
  while (
    current.type === "CallExpression" &&
    current.callee.type === "MemberExpression" &&
    !current.callee.computed &&
    current.callee.property.type === "Identifier" &&
    current.callee.property.name === "pipe"
  ) {
    current = unwrapExpression(current.callee.object);
  }
  return current;
}

function wrappedGenerator(context: Context, fn: FunctionNode): FunctionNode | undefined {
  const result = soleResult(fn);
  if (result === undefined) return undefined;
  const call = stripPipes(result);
  if (call.type !== "CallExpression" || effectMethod(context, call.callee) !== "gen") return undefined;
  const [generator, ...rest] = call.arguments;
  return rest.length === 0 && isFunctionNode(generator) && generator.generator === true ? generator : undefined;
}

function usesThis(node: ESTree.Node): boolean {
  let found = false;
  walk(node, (child) => {
    if (child.type === "ThisExpression") found = true;
    return !found;
  });
  return found;
}

function isExempt(fn: FunctionNode): boolean {
  const shape = fn as FunctionNode & {
    readonly async?: boolean;
    readonly typeParameters?: unknown;
  };
  if (fn.params.length === 0 || fn.generator === true || shape.async === true) return true;
  if (shape.typeParameters !== null && shape.typeParameters !== undefined) return true;

  return !isNameable(fn);
}

/** Only functions with a stable name can become a named `Effect.fn`; inline callbacks stay as they are. */
function isNameable(fn: FunctionNode): boolean {
  if (fn.type === "FunctionDeclaration") return true;
  const parent = parentOf(fn);
  if (parent?.type === "VariableDeclarator") return parent.init === fn;
  if (parent?.type === "Property" || parent?.type === "PropertyDefinition") return parent.value === fn;
  return false;
}

/**
 * Prefer `Effect.fn` over parameterised functions whose whole body is an `Effect.gen`.
 *
 * @attribution Effect bundled AGENTS.md "Avoid creating functions that only wrap and return an Effect.gen" (concept)
 * @attribution @effect/language-service effectFnOpportunity diagnostic (concept)
 */
export const preferEffectFn: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer Effect.fn over functions with parameters whose entire body returns Effect.gen, optionally piped.",
    },
    messages: { preferEffectFn: message },
  },
  createOnce(context) {
    function check(node: ESTree.Node): void {
      if (!isFunctionNode(node) || isExempt(node)) return;
      const generator = wrappedGenerator(context, node);
      if (generator === undefined || usesThis(generator)) return;
      context.report({ node, messageId: "preferEffectFn" });
    }

    return {
      ArrowFunctionExpression: check,
      FunctionDeclaration: check,
      FunctionExpression: check,
    };
  },
};
