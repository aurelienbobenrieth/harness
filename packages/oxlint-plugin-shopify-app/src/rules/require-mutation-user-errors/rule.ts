import type { ESTree, Rule } from "@oxlint/plugins";
import { fieldHasHole, graphqlSource, mutationDocument, selectionNames } from "../graphql-support.js";
import { firstOption, stringArrayOption } from "../option-support.js";

const message =
  "Mutation `{{mutation}}` never selects `userErrors`: the Admin API answers 200 OK on business failures, so the write can fail unnoticed. Select `userErrors { field message }` and handle it.";

const userErrorsField = /^userErrors$|UserErrors$/;

/**
 * Admin GraphQL mutations report business failures through the payload's user-error list, which is
 * only returned when the operation selects it.
 *
 * @attribution https://shopify.dev/docs/api/admin-graphql/latest (inspiration; independently implemented)
 */
export const requireMutationUserErrors: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every GraphQL mutation field to select userErrors (or a *UserErrors field). Option `ignoreMutations` lists mutation names without such a payload field.",
    },
    messages: {
      requireMutationUserErrors: message,
    },
    schema: [
      {
        type: "object",
        properties: { ignoreMutations: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    const check = (node: ESTree.Node): void => {
      const source = graphqlSource(node);
      if (source === undefined) return;
      const { fields, fragments } = mutationDocument(source.text);
      if (fields.length === 0) return;
      const ignored = new Set(stringArrayOption(firstOption(context), "ignoreMutations", []));
      for (const field of fields) {
        if (ignored.has(field.name.value) || field.selectionSet === undefined) continue;
        if (fieldHasHole(field, source.holes)) continue;
        const selection = selectionNames(field, fragments);
        if (selection.unresolved) continue;
        if ([...selection.names].some((name) => userErrorsField.test(name))) continue;
        context.report({
          node,
          messageId: "requireMutationUserErrors",
          data: { mutation: field.name.value },
        });
      }
    };
    return { TemplateLiteral: check, Literal: check };
  },
};
