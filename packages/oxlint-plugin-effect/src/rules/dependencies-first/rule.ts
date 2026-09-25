import type { ESTree, Rule } from "@oxlint/plugins";
import { effectBodyMethod, isServiceDependency } from "../binding-support.js";

export const dependenciesFirst: Rule = {
  meta: {
    type: "suggestion",
    docs: { description: "Yield service dependencies before runtime logic in Effect bodies." },
    messages: { order: "Yield Effect service dependencies before runtime logic." },
  },
  createOnce(context) {
    const check = (node: ESTree.Function): void => {
      if (!node.generator || node.body === null || effectBodyMethod(context, node) === undefined) return;
      let logic = false;
      for (const statement of node.body.body) {
        const dependency = isServiceDependency(context, statement);
        if (dependency && logic) context.report({ node: statement, messageId: "order" });
        if (!dependency) logic = true;
      }
    };

    return { FunctionDeclaration: check, FunctionExpression: check };
  },
};
