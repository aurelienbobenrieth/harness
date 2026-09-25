import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { definePrecisionBoundaryReview, precisionBoundaryReview } from "./rule.js";

it("reports raw arithmetic across distinct units once at the outer expression", async () => {
  const findings = await testRuleOnSource({
    rule: precisionBoundaryReview,
    source: "export const widthPx = (widthMm * dpi) / 25.4;",
  });
  expect(findings.map((finding) => [finding.authority, finding.message])).toEqual([
    [
      "human",
      "Raw arithmetic combines dpi, millimetres; move the conversion behind a named, tested unit boundary or document its precision contract.",
    ],
  ]);
});

it("stays silent for same-unit arithmetic and named conversion calls", async () => {
  const findings = await Promise.all(
    [
      "export const totalPx = widthPx + gutterPx;",
      "export const widthPx = millimetersToPixels(widthMm * dpi / 25.4);",
    ].map((source) => testRuleOnSource({ rule: precisionBoundaryReview, source })),
  );
  expect(findings).toEqual([[], []]);
});

it("supports repository conversion names", async () => {
  const rule = definePrecisionBoundaryReview({ conversionCalleePattern: /^physicalScale$/g });
  expect(
    await testRuleOnSource({ rule, source: "export const widthPx = physicalScale(widthMm * dpi / 25.4);" }),
  ).toEqual([]);
  expect(await testRuleOnSource({ rule, source: "export const widthPx = other(widthMm * dpi / 25.4);" })).toHaveLength(
    1,
  );
});
