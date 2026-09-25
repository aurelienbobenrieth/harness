import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { correlatedOptionalState, defineCorrelatedOptionalState } from "./rule.js";

const body = '{ status: "idle" | "uploading" | "done" | "failed"; progress?: number; url?: string; error?: Error }';

async function messages(source: string, rule = correlatedOptionalState, file = "src/upload.ts") {
  return (await testRuleOnSource({ rule: rule, source: source, file: file })).map((finding) => finding.message);
}

it("reports a status union next to optional fields, naming the fields", async () => {
  expect(await messages(`type Upload = ${body};`)).toEqual([
    "`Upload` pairs the `status` union with optional fields (error, progress, url); if their presence depends on `status`, model one union member per value.",
  ]);
});

it("reports the interface form and counts nullable fields as optional", async () => {
  expect(
    await messages(
      'export interface Job { readonly kind: "queued" | "running" | "failed"; startedAt: Date | undefined; error: Error | null; id: string }',
    ),
  ).toEqual([expect.stringContaining("`Job` pairs the `kind` union with optional fields (error, startedAt)")]);
});

it("stays silent on a discriminated union and on a free-form status", async () => {
  expect(
    await messages(
      'type Upload = { status: "idle" } | { status: "done"; url?: string; etag?: string; size?: number };',
    ),
  ).toEqual([]);
  expect(await messages("type Upload = { status: string; url?: string; error?: Error };")).toEqual([]);
  expect(await messages("type Upload = { status: Status; url?: string; error?: Error };")).toEqual([]);
  expect(await messages('type Flag = { mode: "on" | 1; url?: string; error?: Error };')).toEqual([]);
});

it("stays silent on conventional option bags, a single optional, an optional discriminant and intersections", async () => {
  expect(await messages(`type UploadProps = ${body};`)).toEqual([]);
  expect(await messages(`interface UploadOptions ${body}`)).toEqual([]);
  expect(await messages('type Upload = { status: "idle" | "done"; url?: string; id: string };')).toEqual([]);
  expect(await messages('type Upload = { status?: "idle" | "done"; url?: string; error?: Error };')).toEqual([]);
  expect(await messages(`type Upload = Base & ${body};`)).toEqual([]);
  expect(await messages('type Row = { label: "a" | "b"; url?: string; error?: Error };')).toEqual([]);
});

it("keeps test files out of the binding", () => {
  expect(correlatedOptionalState.binding.exclude).toEqual(["**/*.d.ts", "**/*.{test,spec}.*", "**/__tests__/**"]);
});

it("honours options and mirrors them into the binding", async () => {
  const rule = defineCorrelatedOptionalState({
    discriminantNames: ["label"],
    minOptionalSiblings: 1,
    skipNamePattern: /Draft$/g,
  });
  expect(await messages('type Row = { label: "a" | "b"; url?: string };', rule)).toHaveLength(1);
  expect(await messages('type RowDraft = { label: "a" | "b"; url?: string };', rule)).toEqual([]);
  expect(await messages('type RowDraft = { label: "a" | "b"; url?: string };', rule)).toEqual([]);
  expect(await messages(`type UploadProps = ${body.replace("status", "label")};`, rule)).toHaveLength(1);
  expect(await messages(`type Upload = ${body};`, rule)).toEqual([]);
  expect(rule.binding.options).toEqual({
    discriminantNames: ["label"],
    minOptionalSiblings: 1,
    skipNamePattern: { source: "Draft$", flags: "g" },
  });
  expect(() => defineCorrelatedOptionalState({ minOptionalSiblings: 0 })).toThrow("must be a positive integer");
});
