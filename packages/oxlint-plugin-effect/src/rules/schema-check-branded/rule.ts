import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { moduleMethod } from "../binding-support.js";
import { defaultAllow, isScopedFile, type RuleContextWithOptions } from "../runtime-support.js";

const defaultFiles = ["**/domain/**"];

// Calls a schema chain continues through: `X.pipe(...)`, `X.check(...)`, `X.annotate(...)`.
const chainMethods = new Set(["annotate", "check", "pipe"]);

function methodName(callee: ESTree.Node): string | undefined {
  if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return undefined;
  return callee.property.name;
}

function isSchemaCall(context: Context, node: ESTree.Node, name: string): boolean {
  return node.type === "CallExpression" && moduleMethod(context, node.callee, "Schema") === name;
}

// A check is `Schema.check(...)` as a pipe argument, or a `.check(...)` method call on a schema that is not the
// `Schema` namespace itself.
function isCheck(context: Context, node: ESTree.CallExpression): boolean {
  if (moduleMethod(context, node.callee, "Schema") === "check") return true;
  return (
    node.callee.type === "MemberExpression" &&
    methodName(node.callee) === "check" &&
    moduleMethod(context, node.callee, "Schema") === undefined
  );
}

// The outermost call of the chain a node sits in: a pipe argument climbs to its `.pipe(...)` call, a receiver to the
// call made on it.
function chainTop(node: ESTree.Node): ESTree.Node {
  let current = node;
  for (;;) {
    const parent = current.parent;
    if (
      parent?.type === "CallExpression" &&
      parent.arguments.includes(current as ESTree.Argument) &&
      methodName(parent.callee) === "pipe"
    ) {
      current = parent;
      continue;
    }
    if (
      parent?.type === "MemberExpression" &&
      parent.object === current &&
      parent.parent?.type === "CallExpression" &&
      parent.parent.callee === parent &&
      chainMethods.has(methodName(parent) ?? "")
    ) {
      current = parent.parent;
      continue;
    }
    return current;
  }
}

function chainHasBrand(context: Context, node: ESTree.Node): boolean {
  if (node.type !== "CallExpression") return false;
  if (isSchemaCall(context, node, "brand")) return true;
  const method = methodName(node.callee);
  if (method === undefined || !chainMethods.has(method) || node.callee.type !== "MemberExpression") return false;
  if (method === "pipe" && node.arguments.some((argument) => isSchemaCall(context, argument, "brand"))) return true;
  return chainHasBrand(context, node.callee.object);
}

export const schemaCheckBranded: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require a schema that adds a check in a domain folder to be branded, so code builds its values through make, which runs the check.",
    },
    messages: {
      schemaCheckBranded:
        'Brand this checked schema (`Schema.brand("...")`): without a brand its type is the unchecked one, so code can build a value the check refuses.',
    },
    schema: [
      {
        type: "object",
        properties: {
          allow: { type: "array", items: { type: "string" } },
          files: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: defaultAllow, files: defaultFiles }],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isCheck(context, node)) return;
        const top = chainTop(node);
        if (chainHasBrand(context, top)) return;
        if (!isScopedFile(context as RuleContextWithOptions, { allow: defaultAllow, files: defaultFiles })) return;
        context.report({ node, messageId: "schemaCheckBranded" });
      },
    };
  },
};
