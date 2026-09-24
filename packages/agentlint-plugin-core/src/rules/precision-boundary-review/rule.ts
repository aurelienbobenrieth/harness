/**
 * Schedules review for raw arithmetic that combines values carrying different unit suffixes.
 *
 * @attribution https://alexn.org/blog/2026/09/22/ai-has-no-wisdom-and-neither-will-you/#isso-thread (inspiration; independently implemented)
 */
import { type AgentlintNode, defineRule, type StateRule } from "@aurelienbbn/agentlint";
import { matches, nonTestExcludes, serializePattern, sourceGlobs } from "../judgment-support-b.js";

const defaultConversionCalleePattern = /(?:convert|toPixels?|toMillimeters?|mmToPx|pxToMm)/i;

export type PrecisionBoundaryReviewOptions = {
  /** Callees that explicitly own a conversion and therefore make call-site arithmetic review unnecessary. */
  readonly conversionCalleePattern?: RegExp;
};

function unit(name: string): string | undefined {
  const lower = name.toLowerCase();
  if (/(?:millimeters?|mm)$/.test(lower)) return "millimetres";
  if (/(?:pixels?|px)$/.test(lower)) return "pixels";
  if (/(?:dotsperinch|dpi)$/.test(lower)) return "dpi";
  if (/(?:inches|inch)$/.test(lower)) return "inches";
  if (/(?:centimeters?|cm)$/.test(lower)) return "centimetres";
  if (/(?:degrees?|deg)$/.test(lower)) return "degrees";
  if (/(?:radians?|rad)$/.test(lower)) return "radians";
  if (/(?:milliseconds?|millis|ms)$/.test(lower)) return "milliseconds";
  if (/(?:seconds?|secs?)$/.test(lower)) return "seconds";
  return undefined;
}

function containingCall(node: AgentlintNode): AgentlintNode | undefined {
  let current = node.parent;
  while (current !== null && current.type !== "statement_block" && current.type !== "program") {
    if (current.type === "call_expression") return current;
    current = current.parent;
  }
  return undefined;
}

function hasBinaryParent(node: AgentlintNode): boolean {
  let current = node.parent;
  while (current !== null && ["parenthesized_expression", "binary_expression"].includes(current.type)) {
    if (current.type === "binary_expression") return true;
    current = current.parent;
  }
  return false;
}

export function definePrecisionBoundaryReview(options: PrecisionBoundaryReviewOptions = {}): StateRule {
  options = structuredClone(options);
  const conversionCalleePattern = options.conversionCalleePattern ?? defaultConversionCalleePattern;

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "core/precision-boundary-review",
      revision: 1,
      title: "Unit conversions preserve an explicit physical contract",
      summary:
        "Flags raw arithmetic across different unit-bearing identifiers so a reader checks units, tolerances, rounding and independent test evidence.",
      guidance: {
        standard:
          "Arithmetic across physical or temporal units has one named conversion boundary, explicit rounding and tolerance policy, and tests whose expected values are independent of the implementation formula.",
        checks: [
          "Write the dimensional equation and identify the unit of every operand and result.",
          "Check rounding direction, precision loss, overflow, invalid values and physical tolerances.",
          "Prefer unit-bearing types or a named conversion boundary over repeated raw arithmetic.",
          "Use independently calculated examples or properties; repeating the implementation formula in the test is not evidence.",
        ],
        examples: [
          {
            label: "REVIEW",
            code: "const widthPx = widthMm * dpi / 25.4;",
            description: "Millimetres, DPI and pixels meet in raw arithmetic.",
          },
          {
            label: "PASS",
            code: "const widthPx = millimetersToPixels(widthMm, dpi);",
            description: "A named boundary can own rounding, validation and contract tests.",
          },
        ],
        refs: [
          { type: "url", href: "https://alexn.org/blog/2026/09/22/ai-has-no-wisdom-and-neither-will-you/#isso-thread" },
        ],
      },
    },
    binding: {
      id: "core/precision-boundary-review",
      authority: "human",
      include: sourceGlobs,
      exclude: nonTestExcludes,
      options: { conversionCalleePattern: serializePattern(options.conversionCalleePattern) },
    },
    detector: {
      id: "core/precision-boundary-review",
      version: 1,
      scan: "file",
      fixtures: {
        mustReport: ["export const widthPx = widthMm * dpi / 25.4;"],
        mustStaySilent: [
          "export const widthPx = millimetersToPixels(widthMm, dpi);",
          "export const totalPx = widthPx + gutterPx;",
        ],
      },
      createOnce({ context }) {
        return {
          binary_expression(node) {
            if (hasBinaryParent(node)) return;
            const call = containingCall(node);
            const callee = call?.childByFieldName("function")?.text;
            if (callee && matches(conversionCalleePattern, callee)) return;
            const identifiers = node.descendantsOfType("identifier").map((identifier) => identifier.text);
            const units = [...new Set(identifiers.map(unit).filter((value): value is string => value !== undefined))];
            if (units.length < 2) return;
            context.report({
              node,
              key: `${units.toSorted().join("-")}:${node.startPosition.row}`,
              message: `Raw arithmetic combines ${units.toSorted().join(", ")}; move the conversion behind a named, tested unit boundary or document its precision contract.`,
              evidence: { identifiers: [...new Set(identifiers)].toSorted(), units: units.toSorted() },
            });
          },
        };
      },
    },
  });
}

export const precisionBoundaryReview = definePrecisionBoundaryReview();
