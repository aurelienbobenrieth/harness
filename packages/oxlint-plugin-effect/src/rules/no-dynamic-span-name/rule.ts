import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { binding, effectMethod, moduleMethod } from "../binding-support.js";
import { unwrapExpression } from "../sota-support.js";

const message =
  "Span names must stay low-cardinality: this name is built from runtime values, so every distinct value becomes a separate span name in the tracing backend. Use a fixed name and put the values in the span attributes.";

/** Effect span constructors whose name is the first argument. */
const leadingNameMethods: ReadonlySet<string> = new Set(["fn", "useSpan", "makeSpan", "makeSpanScoped"]);
/** Dual span wrappers: the name is the first argument data-last and the second argument data-first. */
const dualNameMethods: ReadonlySet<string> = new Set(["withSpan", "withSpanScoped"]);

function nameArguments(context: Context, node: ESTree.CallExpression): readonly ESTree.Node[] {
  const method = effectMethod(context, node.callee);
  const [first, second] = node.arguments;
  if (method !== undefined && leadingNameMethods.has(method)) return first === undefined ? [] : [first];
  const isDual =
    (method !== undefined && dualNameMethods.has(method)) ||
    moduleMethod(context, node.callee, "Layer") === "withSpan" ||
    moduleMethod(context, node.callee, "Stream") === "withSpan";
  if (!isDual) return [];
  return [first, second].filter((argument): argument is NonNullable<typeof argument> => argument !== undefined);
}

function isStaticString(context: Context, node: ESTree.Node, seen: Set<ESTree.Node> = new Set()): boolean {
  const value = unwrapExpression(node);
  if (seen.has(value)) return false;
  seen.add(value);
  if (value.type === "Literal") return typeof value.value === "string";
  if (value.type === "TemplateLiteral") return value.expressions.every((part) => isStaticString(context, part, seen));
  if (value.type === "BinaryExpression" && value.operator === "+")
    return isStaticString(context, value.left, seen) && isStaticString(context, value.right, seen);
  if (value.type !== "Identifier") return false;
  const definition = binding(context, value, value.name)?.defs[0];
  if (definition?.node.type !== "VariableDeclarator" || definition.parent?.type !== "VariableDeclaration") return false;
  if (definition.parent.kind !== "const" || definition.node.init === null) return false;
  return isStaticString(context, definition.node.init, seen);
}

/** A string built at runtime: a template with interpolations or a `+` concatenation involving a string. */
function isComposedString(node: ESTree.Node): boolean {
  const value = unwrapExpression(node);
  if (value.type === "TemplateLiteral") return value.expressions.length > 0;
  if (value.type !== "BinaryExpression" || value.operator !== "+") return false;
  return [value.left, value.right].some((side) => {
    const operand = unwrapExpression(side);
    return (
      (operand.type === "Literal" && typeof operand.value === "string") ||
      operand.type === "TemplateLiteral" ||
      isComposedString(operand)
    );
  });
}

/**
 * Reports span names assembled from runtime values in `Effect.fn`, `Effect.withSpan`, and the other span
 * constructors. Interpolating a `const` string stays silent: only values that vary per call explode cardinality.
 *
 * @attribution OpenTelemetry Tracing API specification, span name guidance "most general string ... low cardinality" (Apache-2.0, concept)
 */
export const noDynamicSpanName: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow template literals with runtime values and string concatenation as span names in Effect.fn, Effect.withSpan, withSpanScoped, useSpan, makeSpan, makeSpanScoped, Layer.withSpan, and Stream.withSpan.",
    },
    messages: { dynamicSpanName: message },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        for (const argument of nameArguments(context, node)) {
          if (!isComposedString(argument) || isStaticString(context, argument)) continue;
          context.report({ node: argument, messageId: "dynamicSpanName" });
        }
      },
    };
  },
};
