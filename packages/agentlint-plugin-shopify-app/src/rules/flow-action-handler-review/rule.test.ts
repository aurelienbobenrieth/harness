import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineFlowActionHandlerReview, flowActionHandlerReview } from "./rule.js";

it("reports an authenticate.flow route once, even with several signals", async () => {
  const findings = await testRuleOnSource({
    rule: flowActionHandlerReview,
    source: `
export const action = async ({ request }) => {
  const { payload } = await shopify.authenticate.flow(request);
  const { action_run_id, properties } = payload;
  await placeBid(payload.action_run_id, properties);
  return new Response();
};
`,
    file: "app/routes/api.flow.actions.place-bid.tsx",
  });
  expect(findings.map((finding) => [finding.line, finding.message])).toEqual([
    [3, expect.stringContaining("authenticate.flow call")],
  ]);
});

it.each([
  ["a destructured key", "const { action_run_id: runId } = body;"],
  ["a member access", "await runs.insert(body.action_run_id);"],
  ["a computed member", 'const runId = body["action_definition_id"];'],
  ["an object key string", 'const record = { "action_run_id": id };'],
])("reports custom-server handlers through %s", async (_label, source) => {
  const findings = await testRuleOnSource({ rule: flowActionHandlerReview, source, file: "server/flow.ts" });
  expect(findings.map((finding) => finding.message)).toEqual([
    expect.stringMatching(/action_(?:run|definition)_id payload key/),
  ]);
});

it("stays silent on webhooks, preview and validation endpoints, and look-alike text", async () => {
  const findings = await testRuleOnSource({
    rule: flowActionHandlerReview,
    source: `
export const action = async ({ request }) => {
  await authenticate.webhook(request);
  const { step_reference, properties, handle } = await request.json();
  log("action_run_id is missing");
  track("action_run_id");
  const actionRunId = properties.id;
  return Response.json({ label_text: handle, flow: authenticate.flowchart });
};
`,
    file: "app/routes/api.flow.preview.tsx",
  });
  expect(findings).toEqual([]);
});

it("reviews configured handler paths without a payload signal", async () => {
  const rule = defineFlowActionHandlerReview({ handlerPathPattern: /^app\/routes\/api\.flow\./g });
  const source = "export const action = ({ request }) => handleFlowAction(request);";
  const file = "app/routes/api.flow.place-bid.ts";
  expect(await testRuleOnSource({ rule, source, file })).toHaveLength(1);
  expect(await testRuleOnSource({ rule, source, file })).toHaveLength(1);
  expect(await testRuleOnSource({ rule, source, file: "app/routes/app._index.ts" })).toEqual([]);
  expect(await testRuleOnSource({ rule: flowActionHandlerReview, source, file })).toEqual([]);
});
