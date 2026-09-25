import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-app/require-mutation-user-errors";

it("reports a mutation field that never selects userErrors", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "await admin.graphql(`#graphql\n  mutation($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { node { id } } }`, { variables });\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports the unchecked field when a sibling field is checked", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'const document = "mutation { a: tagsAdd(id: 1, tags: []) { userErrors { message } } b: tagsRemove(id: 1, tags: []) { node { id } } }";\n',
    ),
  ).resolves.toBeUndefined();
});

it("does not accept userErrors nested under another payload field", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const document = `mutation { productCreate { product { userErrors { message } } } }`;\n",
    ),
  ).resolves.toBeUndefined();
});

it("accepts userErrors and domain-specific *UserErrors fields", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const a = `mutation { tagsAdd(id: 1, tags: []) { node { id } userErrors { field message } } }`;\nconst b = `mutation { customerCreate { customer { id } customerUserErrors { message } } }`;\n",
    ),
  ).resolves.toBeUndefined();
});

it("follows fragments defined in the same document", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const document = `mutation { tagsAdd(id: 1, tags: []) { ...Payload } } fragment Payload on TagsAddPayload { userErrors { message } }`;\n",
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      "const document = `mutation { tagsAdd(id: 1, tags: []) { ...Payload } } fragment Payload on TagsAddPayload { node { id } }`;\n",
    ),
  ).resolves.toBeUndefined();
});

it("stays silent on unknown fragments, interpolated selections, queries and prose", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "const a = `mutation { tagsAdd(id: 1, tags: []) { ...External } }`;",
        "const b = `mutation { tagsAdd(id: 1, tags: []) { node { id } ${errors} } }`;",
        "const c = `query { shop { name } }`;",
        'const d = "Run the mutation { again } later";',
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("honours ignoreMutations", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const a = `mutation { legacyWrite { ok } }`;\n", {
      ruleOptions: { ignoreMutations: ["legacyWrite"] },
    }),
  ).resolves.toBeUndefined();
});
