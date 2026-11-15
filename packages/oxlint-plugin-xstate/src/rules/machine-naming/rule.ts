import type { ESTree, Rule } from "@oxlint/plugins";

const message =
  "Machine ids share one observable namespace across the app: follow the configured naming pattern so actors stay traceable and never collide with third-party machines.";
const unconfiguredMessage =
  "xstate/machine-naming has no default convention, so it cannot check this machine. Set the rule's `pattern` option to a regular expression for your machine ids, or turn the rule off.";

type RuleOptions = { readonly pattern?: string };

function machineIdPattern(context: unknown): RegExp | undefined {
  const options = (context as { readonly options?: readonly unknown[] }).options;
  const first = options?.[0];
  if (typeof first === "object" && first !== null) {
    const pattern = (first as RuleOptions).pattern;
    if (typeof pattern === "string" && pattern.length > 0) return new RegExp(pattern);
  }
  return undefined;
}

function isCreateMachineCallee(callee: ESTree.Expression | ESTree.Super): boolean {
  if (callee.type === "Identifier") return callee.name === "createMachine";
  if (callee.type === "MemberExpression" && !callee.computed) {
    return callee.property.type === "Identifier" && callee.property.name === "createMachine";
  }
  return false;
}

function machineIdProperty(
  argument: ESTree.Expression | ESTree.SpreadElement | undefined,
): ESTree.StringLiteral | undefined {
  if (argument === undefined || argument.type !== "ObjectExpression") return undefined;
  for (const property of argument.properties) {
    if (property.type !== "Property" || property.computed) continue;
    const key = property.key;
    const isIdKey = (key.type === "Identifier" && key.name === "id") || (key.type === "Literal" && key.value === "id");
    if (!isIdKey) continue;
    if (property.value.type === "Literal" && typeof property.value.value === "string") return property.value;
    return undefined;
  }
  return undefined;
}

export const machineNaming: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require XState machine ids to follow an explicitly configured `pattern`; without one the rule reports that it needs configuring.",
    },
    messages: {
      machineNaming: message,
      patternRequired: unconfiguredMessage,
    },
    schema: [
      {
        type: "object",
        properties: {
          pattern: { type: "string" },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    let announced = false;
    return {
      Program() {
        announced = false;
      },
      CallExpression(node) {
        if (!isCreateMachineCallee(node.callee)) return;
        const pattern = machineIdPattern(context);
        if (pattern === undefined) {
          if (announced) return;
          announced = true;
          context.report({ node: node.callee, messageId: "patternRequired" });
          return;
        }
        const idLiteral = machineIdProperty(node.arguments[0]);
        if (idLiteral === undefined) return;
        if (pattern.test(String(idLiteral.value))) return;
        context.report({ node: idLiteral, messageId: "machineNaming" });
      },
    };
  },
};
