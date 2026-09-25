import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { adminApiLoopReview, defineAdminApiLoopReview } from "./rule.js";

const file = "app/routes/app.sync.ts";

it("reports a per-item Admin call in a for…of body", async () => {
  const findings = await testRuleOnSource({
    rule: adminApiLoopReview,
    source: "for (const id of ids) {\n  await admin.graphql(QUERY, { variables: { id } });\n}",
    file: file,
  });
  expect(findings.map((finding) => [finding.line, finding.message])).toEqual([
    [2, expect.stringContaining("admin.graphql() runs inside a loop")],
  ]);
});

it("reports cursor pagination in while and do loops", async () => {
  const findings = await testRuleOnSource({
    rule: adminApiLoopReview,
    source: `
while (hasNextPage) { page = await context.admin.graphql(QUERY, { variables: { cursor } }); }
do { page = await client.request(QUERY); } while (page.hasNextPage);
`,
    file: file,
  });
  expect(findings).toHaveLength(2);
});

it("reports bursts through map, forEach, and flatMap callbacks", async () => {
  const findings = await testRuleOnSource({
    rule: adminApiLoopReview,
    source: `
await Promise.all(ids.map((id) => admin.graphql(QUERY, { variables: { id } })));
ids.forEach(async function (id) { await admin.graphql(QUERY); });
ids.flatMap((id) => [client.query({ data: QUERY })]);
`,
    file: file,
  });
  expect(findings.map((finding) => finding.message)).toEqual([
    expect.stringContaining("iteration callback"),
    expect.stringContaining("iteration callback"),
    expect.stringContaining("iteration callback"),
  ]);
});

it("stays silent on a single call and on calls evaluated once by a loop header", async () => {
  const findings = await testRuleOnSource({
    rule: adminApiLoopReview,
    source: `
const response = await admin.graphql(QUERY);
for (const edge of (await admin.graphql(QUERY)).edges) { total += edge.node.count; }
for (let page = await admin.graphql(QUERY); page; page = undefined) { use(page); }
`,
    file: file,
  });
  expect(findings).toEqual([]);
});

it("stays silent on unrelated calls in loops and on handlers merely defined in a loop", async () => {
  const findings = await testRuleOnSource({
    rule: adminApiLoopReview,
    source: `
for (const plan of plans) { await billing.request({ plan }); await http.request(plan); }
for (const route of routes) { handlers[route] = async () => admin.graphql(QUERY); }
ids.filter((id) => seen.has(id));
`,
    file: file,
  });
  expect(findings).toEqual([]);
});

it("accepts a project wrapper pattern without alternating on stateful flags", async () => {
  const rule = defineAdminApiLoopReview({ graphqlCalleePattern: /^shopifyGraphql$/g });
  const findings = await testRuleOnSource({
    rule: rule,
    source: "for (const id of ids) { await shopifyGraphql(A); await shopifyGraphql(B); await admin.graphql(C); }",
    file: file,
  });
  expect(findings).toHaveLength(2);
});
