import { Kind } from "graphql";
import type { ESTree, Rule } from "@oxlint/plugins";
import { isTestFile, memberPath } from "../ast-support.js";
import { fieldHasHole, graphqlSource, mutationDocument } from "../graphql-support.js";

const billingMethods = new Set(["require", "request", "check", "cancel", "createUsageRecord"]);
const chargeMutations = new Set(["appSubscriptionCreate", "appPurchaseOneTimeCreate"]);

function hardcodedTestProperty(argument: ESTree.Node | undefined): ESTree.Node | undefined {
  if (argument?.type !== "ObjectExpression") return undefined;
  for (const property of argument.properties) {
    if (property.type !== "Property" || property.computed) continue;
    const key =
      property.key.type === "Identifier"
        ? property.key.name
        : property.key.type === "Literal"
          ? property.key.value
          : undefined;
    if (key === "isTest" && property.value.type === "Literal" && property.value.value === true) return property;
  }
  return undefined;
}

/**
 * @attribution https://shopify.dev/docs/api/shopify-app-react-router/latest/apis/billing (inspiration; independently implemented)
 */
export const noHardcodedBillingTestMode: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow literal `isTest: true` in billing.* calls and literal `test: true` on appSubscriptionCreate/appPurchaseOneTimeCreate outside test files, because test charges never bill the merchant.",
    },
    messages: {
      hardcodedIsTest:
        "`billing.{{method}}` hardcodes `isTest: true`, so production merchants are never charged. Derive the flag from the environment or the shop plan.",
      hardcodedTestArgument:
        "Mutation `{{mutation}}` hardcodes `test: true`, so production merchants are never charged. Pass the flag as a variable derived from the environment or the shop plan.",
    },
  },
  createOnce(context) {
    const checkDocument = (node: ESTree.Node): void => {
      const source = graphqlSource(node);
      if (source === undefined || isTestFile(context)) return;
      for (const field of mutationDocument(source.text).fields) {
        if (!chargeMutations.has(field.name.value) || fieldHasHole(field, source.holes)) continue;
        const test = field.arguments?.find((argument) => argument.name.value === "test");
        if (test?.value.kind === Kind.BOOLEAN && test.value.value)
          context.report({
            node,
            messageId: "hardcodedTestArgument",
            data: { mutation: field.name.value },
          });
      }
    };
    return {
      CallExpression(node) {
        const path = memberPath(node.callee);
        if (path === undefined || path.length < 2 || path.at(-2) !== "billing") return;
        const method = path.at(-1) ?? "";
        if (!billingMethods.has(method)) return;
        const property = hardcodedTestProperty(node.arguments[0]);
        if (property === undefined || isTestFile(context)) return;
        context.report({ node: property, messageId: "hardcodedIsTest", data: { method } });
      },
      TemplateLiteral: checkDocument,
      Literal: checkDocument,
    };
  },
};
