import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { binding, effectMethod } from "../binding-support.js";
import { isEffectBody, moduleMethod, nearestFunction, unwrapExpression } from "../sota-support.js";

const message =
  "Write `return yield*` when raising a failure: without the return, TypeScript keeps type-checking the unreachable code below as if execution continued.";

const failingConstructors: ReadonlySet<string> = new Set(["fail", "failSync", "failCause", "failCauseSync", "die"]);
const failingValues: ReadonlySet<string> = new Set(["interrupt", "never"]);
const errorFactories: Readonly<Record<string, readonly string[]>> = {
  Data: ["Error", "TaggedError"],
  Schema: ["Error", "TaggedError"],
};
const importedErrorName = /(?:Error|Exception)$/u;

function isErrorFactory(context: Context, superClass: ESTree.Node | null): boolean {
  let root = superClass;
  while (root?.type === "CallExpression") root = root.callee;
  if (root === null || root === undefined) return false;
  return Object.entries(errorFactories).some(([moduleName, members]) => {
    const member = moduleMethod(context, root, moduleName);
    return member !== undefined && members.includes(member);
  });
}

function isYieldableErrorClass(context: Context, callee: ESTree.Node): boolean {
  if (callee.type !== "Identifier") return false;
  const definitions = binding(context, callee, callee.name)?.defs ?? [];
  return definitions.some((definition) => {
    if (definition.node.type === "ClassDeclaration" || definition.node.type === "ClassExpression") {
      return isErrorFactory(context, definition.node.superClass);
    }
    return definition.parent?.type === "ImportDeclaration" && importedErrorName.test(callee.name);
  });
}

function neverCompletes(context: Context, argument: ESTree.Node): boolean {
  const value = unwrapExpression(argument);
  if (value.type === "NewExpression") return isYieldableErrorClass(context, value.callee);
  if (value.type === "CallExpression") {
    const method = effectMethod(context, value.callee);
    return method !== undefined && failingConstructors.has(method);
  }
  const member = effectMethod(context, value);
  return member !== undefined && failingValues.has(member);
}

/**
 * Require `return` in front of a `yield*` that can only fail.
 *
 * @attribution @effect/language-service missingReturnYieldStar diagnostic (concept)
 * @attribution Effect bundled AGENTS.md "Always return when raising an error" (concept)
 */
export const requireReturnOnFailureYield: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require `return yield*` when an Effect generator statement yields Effect.fail, Effect.die, Effect.interrupt, Effect.never, or a yieldable error instance.",
    },
    fixable: "code",
    messages: { requireReturn: message },
  },
  createOnce(context) {
    return {
      ExpressionStatement(node) {
        const expression = node.expression;
        if (expression.type !== "YieldExpression" || !expression.delegate || expression.argument === null) return;
        if (!neverCompletes(context, expression.argument)) return;
        const owner = nearestFunction(node);
        if (owner === undefined || !isEffectBody(owner, context)) return;

        context.report({
          node: expression,
          messageId: "requireReturn",
          fix: (fixer) => fixer.insertTextBefore(expression, "return "),
        });
      },
    };
  },
};
