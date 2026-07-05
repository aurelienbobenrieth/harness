import type { ESTree, Rule } from "@oxlint/plugins";

const message =
  "Theme components render into light DOM: define createRenderRoot() { return this; } so Liquid-rendered markup, theme CSS tokens, and native form participation keep working.";

type RuleOptions = {
  readonly baseClasses?: readonly string[];
  readonly lightDomBaseClasses?: readonly string[];
};

const defaultBaseClasses = ["LitElement"];

function stringArray(value: unknown, fallback: readonly string[]): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : fallback;
}

function ruleOptions(context: unknown): Required<RuleOptions> {
  const options = (context as { readonly options?: readonly unknown[] }).options;
  const first = options?.[0];
  const parsed: RuleOptions = typeof first === "object" && first !== null ? (first as RuleOptions) : {};
  return {
    baseClasses: stringArray(parsed.baseClasses, defaultBaseClasses),
    lightDomBaseClasses: stringArray(parsed.lightDomBaseClasses, []),
  };
}

function superClassName(node: ESTree.Class): string | undefined {
  const superClass = node.superClass;
  if (superClass == null) return undefined;
  if (superClass.type === "Identifier") return superClass.name;
  if (superClass.type === "CallExpression" && superClass.callee.type === "Identifier") {
    const mixinArgument = superClass.arguments.at(-1);
    return mixinArgument !== undefined && mixinArgument.type === "Identifier" ? mixinArgument.name : undefined;
  }
  return undefined;
}

function returnsThis(method: ESTree.MethodDefinition): boolean {
  const body = method.value.body;
  if (body == null) return false;
  return body.body.some(
    (statement) =>
      statement.type === "ReturnStatement" &&
      statement.argument != null &&
      statement.argument.type === "ThisExpression",
  );
}

function fixesRenderRoot(node: ESTree.Class): boolean {
  return node.body.body.some(
    (member) =>
      member.type === "MethodDefinition" &&
      !member.computed &&
      member.key.type === "Identifier" &&
      member.key.name === "createRenderRoot" &&
      returnsThis(member),
  );
}

function checkClass(context: Parameters<Rule["createOnce"]>[0], node: ESTree.Class): void {
  const { baseClasses, lightDomBaseClasses } = ruleOptions(context);
  const superName = superClassName(node);
  if (superName === undefined) return;
  if (lightDomBaseClasses.includes(superName)) return;
  if (!baseClasses.includes(superName)) return;
  if (fixesRenderRoot(node)) return;
  context.report({ node, messageId: "noShadowDom" });
}

export const noShadowDom: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require Lit components to opt into light DOM by returning this from createRenderRoot.",
    },
    messages: {
      noShadowDom: message,
    },
    schema: [
      {
        type: "object",
        properties: {
          baseClasses: { type: "array", items: { type: "string" } },
          lightDomBaseClasses: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    return {
      ClassDeclaration(node) {
        checkClass(context, node);
      },
      ClassExpression(node) {
        checkClass(context, node);
      },
    };
  },
};
