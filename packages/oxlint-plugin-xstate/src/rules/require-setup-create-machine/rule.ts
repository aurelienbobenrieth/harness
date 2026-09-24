/**
 * Require machines to be defined via setup().createMachine().
 *
 * @attribution ai-automation by Sandro Maglione (inspiration, independently re-implemented)
 */
import { unwrapExpressionKeepingChain } from "@aurelienbbn/oxlint-kit/ast";
import { findProperty } from "../ast.js";
import { importedName } from "../binding-support.js";
import type { ESTree, Rule } from "@oxlint/plugins";

const message = "Define machines with setup().createMachine() so actions, guards, actors, and types are declared.";

const typesMessage =
  "setup() without a types declaration leaves context, events and implementations untyped: declare setup({ types: { context, events }, actions, guards, actors }).";

/** True when the setup() argument is statically known to declare no `types`. */
function lacksTypes(argument: ESTree.Expression | ESTree.SpreadElement | undefined): boolean {
  if (argument === undefined) return true;
  if (argument.type === "SpreadElement") return false;
  const config = unwrapExpressionKeepingChain(argument);
  if (config.type !== "ObjectExpression") return false;
  if (config.properties.some((property) => property.type !== "Property" || property.computed)) return false;
  return findProperty(config, "types") === undefined;
}

export const requireSetupCreateMachine: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require XState machines to be defined via setup().createMachine() with types declared in setup({ types }).",
    },
    messages: {
      requireSetupCreateMachine: message,
      requireSetupTypes: typesMessage,
    },
    schema: [],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const imported = importedName(context, node.callee);
        if (imported === "createMachine") {
          context.report({ node, messageId: "requireSetupCreateMachine" });
          return;
        }
        if (imported !== "setup" || !lacksTypes(node.arguments[0])) return;
        context.report({ node, messageId: "requireSetupTypes" });
      },
    };
  },
};
