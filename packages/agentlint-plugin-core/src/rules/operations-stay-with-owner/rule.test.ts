import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineOperationsStayWithOwner, operationsStayWithOwner } from "./rule.js";

const story = [
  'import { requestComposed, requestSent as sent, requestBounced } from "../../takedown/api.ts";',
  'import { requestReplied, type TakedownRequest } from "../../takedown/api.ts";',
  "export const story = (request: TakedownRequest) => [requestComposed, sent, requestBounced, requestReplied];",
].join("\n");

it("reports a file that calls several operations of another module's entry", async () => {
  const findings = await testRuleOnSource({
    rule: operationsStayWithOwner,
    source: story,
    file: "src/qa/seed/story.ts",
  });
  expect(findings.map((finding) => [finding.authority, finding.file, finding.message])).toEqual([
    [
      "agent",
      "src/qa/seed/story.ts",
      "This file calls 4 operations of `src/takedown/api.ts` (requestBounced, requestComposed, requestReplied, requestSent); code that drives another module's model belongs to that module: move it there, or have the owner offer the one outcome this file needs.",
    ],
  ]);
});

it("stays silent on vocabulary, type-only imports, few operations and imports that are not an entry", async () => {
  const sources = [
    'import { TakedownSource, TakedownRequest, TakedownMerchant, TakedownReply } from "../takedown/api.ts";',
    'import type { requestComposed, requestSent, requestBounced, requestReplied } from "../takedown/api.ts";',
    'import { type requestComposed, type requestSent, type requestBounced, requestReplied } from "../takedown/api.ts";',
    'import { merchantsStart, sourceChange, TakedownSource } from "../takedown/api.ts";',
    'import { requestComposed, requestSent, requestBounced, requestReplied } from "./domain/request.ts";',
    'import { jobsEnqueue, jobsDefine, jobsQueueFamily, jobsWake } from "@acme/jobs";',
  ];
  const findings = await Promise.all(
    sources.map((source) => testRuleOnSource({ rule: operationsStayWithOwner, source, file: "src/ops/views.ts" })),
  );
  expect(findings).toEqual([[], [], [], [], [], []]);
});

it("counts operations per module, so two owners called a little each stay silent", async () => {
  const source = [
    'import { a1, a2 } from "../alpha/api.ts";',
    'import { b1, b2 } from "../beta/api.ts";',
    "export const all = [a1, a2, b1, b2];",
  ].join("\n");
  expect(await testRuleOnSource({ rule: operationsStayWithOwner, source, file: "src/ops/views.ts" })).toEqual([]);
});

it("treats the packages a configuration names as modules, and takes a calibrated threshold", async () => {
  const rule = defineOperationsStayWithOwner({ minOperations: 2, packages: ["@acme/*"] });
  const findings = await testRuleOnSource({
    rule,
    source:
      'import { invoiceIssue, invoiceVoid } from "@acme/billing";\nexport const run = [invoiceIssue, invoiceVoid];',
    file: "src/orders/close.ts",
  });
  expect(findings.map((finding) => finding.message)).toEqual([
    "This file calls 2 operations of `@acme/billing` (invoiceIssue, invoiceVoid); code that drives another module's model belongs to that module: move it there, or have the owner offer the one outcome this file needs.",
  ]);
  expect(() => defineOperationsStayWithOwner({ minOperations: 0 })).toThrow("must be a positive integer");
});

it("reads another entry file name when the configuration says how modules expose themselves", async () => {
  const rule = defineOperationsStayWithOwner({ entryPattern: String.raw`(^|/)public\.ts$` });
  const source = 'import { a, b, c, d } from "../billing/public.ts";\nexport const all = [a, b, c, d];';
  expect(await testRuleOnSource({ rule, source, file: "src/orders/close.ts" })).toHaveLength(1);
  expect(await testRuleOnSource({ rule: operationsStayWithOwner, source, file: "src/orders/close.ts" })).toEqual([]);
});
