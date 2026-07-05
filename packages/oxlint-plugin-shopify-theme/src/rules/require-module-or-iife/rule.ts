import type { ESTree, Rule } from "@oxlint/plugins";

const message =
  "Classic theme scripts share the global scope: wrap the file in an IIFE or convert it to a module to avoid collisions.";

const moduleStatementTypes = new Set([
  "ImportDeclaration",
  "ExportNamedDeclaration",
  "ExportDefaultDeclaration",
  "ExportAllDeclaration",
]);

const globalDeclarationTypes = new Set(["VariableDeclaration", "FunctionDeclaration", "ClassDeclaration"]);

function isIifeStatement(statement: ESTree.Statement | ESTree.Directive | ESTree.ModuleDeclaration): boolean {
  if (statement.type !== "ExpressionStatement") return false;
  const expression = statement.expression;
  if (expression.type !== "CallExpression") return false;
  const callee = expression.callee;
  return callee.type === "FunctionExpression" || callee.type === "ArrowFunctionExpression";
}

export const requireModuleOrIife: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require classic theme scripts to scope declarations inside an IIFE or module.",
    },
    messages: {
      requireModuleOrIife: message,
    },
  },
  createOnce(context) {
    return {
      Program(node) {
        const statements = node.body;
        if (statements.some((statement) => moduleStatementTypes.has(statement.type))) return;

        const globalDeclaration = statements.find(
          (statement) => globalDeclarationTypes.has(statement.type) && !isIifeStatement(statement),
        );
        if (globalDeclaration === undefined) return;

        context.report({ node: globalDeclaration, messageId: "requireModuleOrIife" });
      },
    };
  },
};
