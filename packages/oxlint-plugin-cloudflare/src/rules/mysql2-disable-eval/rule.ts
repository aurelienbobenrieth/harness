/**
 * Require `disableEval: true` on mysql2 connection and pool options in Workers,
 * where the runtime forbids the code generation mysql2 uses by default.
 *
 * @attribution https://developers.cloudflare.com/hyperdrive/examples/connect-to-mysql/mysql-drivers-and-libraries/mysql2/ (inspiration; independently implemented)
 */
import {
  importedNameFrom,
  isWorkerModule,
  memberPropertyName,
  propertyKeyName,
  unwrapExpression,
  walk,
} from "../ast.js";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const missingMessage =
  "mysql2 compiles row parsers with eval by default, which Workers refuse at runtime. Add `disableEval: true` to these connection options.";

const disabledMessage =
  "`disableEval` must be the literal `true` in a Worker: mysql2 otherwise compiles row parsers with eval, which Workers refuse at runtime.";

const factories: ReadonlySet<string> = new Set(["createConnection", "createPool", "createPoolCluster"]);

/** True when an options object reads a Worker env: `env.X`, `this.env.X`, `c.env.X` (not Node's `process.env`). */
function readsEnv(node: ESTree.Node): boolean {
  let found = false;
  walk(node, (child) => {
    if (found || child.type !== "MemberExpression") return !found;
    const owner = unwrapExpression(child.object);
    if (owner.type === "Identifier" && owner.name === "env") found = true;
    else if (owner.type === "MemberExpression" && memberPropertyName(owner) === "env") {
      const root = unwrapExpression(owner.object);
      found = !(root.type === "Identifier" && root.name === "process");
    }
    return !found;
  });
  return found;
}

function isMysql2Factory(context: Context, callee: ESTree.Node): boolean {
  const imported = importedNameFrom(context, callee, ["mysql2", "mysql2/promise"]);
  return imported !== undefined && factories.has(imported);
}

export const mysql2DisableEval: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require disableEval: true in object-literal options passed to mysql2 createConnection / createPool / createPoolCluster in Worker code.",
    },
    fixable: "code",
    messages: {
      missingDisableEval: missingMessage,
      disableEvalNotTrue: disabledMessage,
    },
    schema: [],
  },
  createOnce(context) {
    let worker = false;
    return {
      Program(node) {
        worker = isWorkerModule(context, node);
      },
      CallExpression(node) {
        if (!isMysql2Factory(context, node.callee)) return;
        const first = node.arguments[0];
        if (first === undefined || first.type === "SpreadElement") return;
        const options = unwrapExpression(first);
        if (options.type !== "ObjectExpression") return;
        if (!worker && !readsEnv(options)) return;
        // A spread may already carry the flag; without seeing it there is no single safe rewrite.
        if (options.properties.some((property) => property.type === "SpreadElement")) return;
        const flag = options.properties.find(
          (property) => property.type === "Property" && propertyKeyName(property) === "disableEval",
        );
        if (flag !== undefined) {
          const value = flag.type === "Property" ? unwrapExpression(flag.value) : undefined;
          if (value?.type === "Literal" && value.value === true) return;
          context.report({ node: flag, messageId: "disableEvalNotTrue" });
          return;
        }
        const last = options.properties.at(-1);
        context.report({
          node: options,
          messageId: "missingDisableEval",
          fix: (fixer) =>
            last === undefined
              ? fixer.replaceText(options, "{ disableEval: true }")
              : fixer.insertTextAfter(last, ", disableEval: true"),
        });
      },
    };
  },
};
