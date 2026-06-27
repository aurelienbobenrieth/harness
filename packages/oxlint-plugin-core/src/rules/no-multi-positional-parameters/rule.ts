import type { ESTree, Rule } from "@oxlint/plugins";

const message = "Use one object input instead of multiple positional parameters.";

type ParentNode = ESTree.Node & { readonly parent?: ParentNode };
type FunctionLike = ParentNode & { readonly params?: readonly ESTree.Node[] };

function hasMultipleParameters(node: FunctionLike): boolean {
  return (node.params?.length ?? 0) > 1;
}

function isExportedFunctionDeclaration(node: ParentNode): boolean {
  return node.type === "FunctionDeclaration" && node.parent?.type === "ExportNamedDeclaration";
}

function isExportedFunctionConstant(node: ParentNode): boolean {
  const parent = node.parent;
  if (parent?.type !== "VariableDeclarator") return false;

  const declaration = parent.parent;
  return declaration?.type === "VariableDeclaration" && declaration.parent?.type === "ExportNamedDeclaration";
}

function shouldReport(node: ParentNode): node is FunctionLike {
  return (
    hasMultipleParameters(node as FunctionLike) &&
    (isExportedFunctionDeclaration(node) || isExportedFunctionConstant(node))
  );
}

export const noMultiPositionalParameters: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require object inputs instead of multiple positional parameters for exported functions.",
    },
    messages: {
      objectInput: message,
    },
  },
  createOnce(context) {
    return {
      ArrowFunctionExpression(node) {
        if (!shouldReport(node)) return;
        context.report({ node, messageId: "objectInput" });
      },
      FunctionDeclaration(node) {
        if (!shouldReport(node)) return;
        context.report({ node, messageId: "objectInput" });
      },
      FunctionExpression(node) {
        if (!shouldReport(node)) return;
        context.report({ node, messageId: "objectInput" });
      },
    };
  },
};
