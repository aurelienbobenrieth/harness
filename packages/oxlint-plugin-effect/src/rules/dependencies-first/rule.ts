import type { Rule } from "@oxlint/plugins";
import { effectBodyMethod, effectMethod } from "../binding-support.js";

export const dependenciesFirst: Rule = {
  meta: {
    type: "suggestion",
    docs: { description: "Yield service dependencies before runtime logic in Effect bodies." },
    messages: { order: "Yield Effect service dependencies before runtime logic." },
  },
  createOnce(context) {
    return {
      FunctionExpression(node) {
        if (!node.generator || node.body === null || effectBodyMethod(context, node) === undefined) return;
        let logic = false;
        for (const statement of node.body.body) {
          const initial =
            statement.type === "VariableDeclaration" && statement.declarations.length === 1
              ? statement.declarations[0]?.init
              : undefined;
          const argument = initial?.type === "YieldExpression" && initial.delegate ? initial.argument : undefined;
          const dependency =
            (argument?.type === "Identifier" && /^[A-Z]/.test(argument.name)) ||
            (argument?.type === "CallExpression" && effectMethod(context, argument.callee) === "service");
          if (dependency && logic) context.report({ node: statement, messageId: "order" });
          if (!dependency) logic = true;
        }
      },
    };
  },
};
