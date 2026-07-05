import type { ESTree, Rule } from "@oxlint/plugins";

const message =
  "Machine ids share one observable namespace across the app: follow the configured naming pattern so actors stay traceable and never collide with third-party machines.";

type RuleOptions = { readonly pattern?: string };

const defaultPattern = "^oio\\.[a-z0-9-]+$";

function machineIdPattern(context: unknown): RegExp {
  const options = (context as { readonly options?: readonly unknown[] }).options;
  const first = options?.[0];
  if (typeof first === "object" && first !== null) {
    const pattern = (first as RuleOptions).pattern;
    if (typeof pattern === "string" && pattern.length > 0) return new RegExp(pattern);
  }
  return new RegExp(defaultPattern);
}

function isCreateMachineCallee(callee: ESTree.Expression | ESTree.Super): boolean {
  if (callee.type === "Identifier") return callee.name === "createMachine";
  if (callee.type === "MemberExpression" && !callee.computed) {
    return callee.property.type === "Identifier" && callee.property.name === "createMachine";
  }
  return false;
}

function machineIdProperty(argument: ESTree.Expression | ESTree.SpreadElement | undefined): ESTree.Literal | undefined {
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
      description: "Require XState machine ids to follow the configured naming convention.",
    },
    messages: {
      machineNaming: message,
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
    return {
      CallExpression(node) {
        if (!isCreateMachineCallee(node.callee)) return;
        const idLiteral = machineIdProperty(node.arguments[0]);
        if (idLiteral === undefined) return;
        if (machineIdPattern(context).test(String(idLiteral.value))) return;
        context.report({ node: idLiteral, messageId: "machineNaming" });
      },
    };
  },
};
