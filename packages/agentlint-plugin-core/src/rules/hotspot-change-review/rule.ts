/**
 * Turns repository-owned maintenance hotspots into explicit human review gates.
 *
 * @attribution https://alexn.org/blog/2026/09/22/ai-has-no-wisdom-and-neither-will-you/ (inspiration; independently implemented)
 */
import { defineRule, type ChangeRule } from "@aurelienbbn/agentlint";
import { matches, serializePattern, type SerializedPattern } from "../judgment-support-b.js";

export type MaintenanceHotspot = {
  /** Stable identifier retained across path changes. */
  readonly id: string;
  /** Paths supported by actual repository history: repeated correction, rollback, incident or co-change. */
  readonly pathPattern: RegExp;
  /** Concrete historical reason this surface deserves extra attention. */
  readonly evidence: string;
};

export type HotspotChangeReviewOptions = {
  readonly hotspots?: readonly MaintenanceHotspot[];
};

type CompiledHotspot = MaintenanceHotspot & { readonly pathOption: SerializedPattern };

function compile(options: HotspotChangeReviewOptions): readonly CompiledHotspot[] {
  const ids = new Set<string>();
  return (options.hotspots ?? []).map((hotspot) => {
    if (!hotspot.id.trim() || !hotspot.evidence.trim())
      throw new Error("hotspot-change-review: id and evidence must not be empty.");
    if (ids.has(hotspot.id)) throw new Error(`hotspot-change-review: duplicate id ${hotspot.id}.`);
    ids.add(hotspot.id);
    return { ...hotspot, pathOption: serializePattern(hotspot.pathPattern) };
  });
}

export function defineHotspotChangeReview(options: HotspotChangeReviewOptions = {}): ChangeRule {
  options = structuredClone(options);
  const hotspots = compile(options);
  return defineRule({
    lifecycle: "change",
    standard: {
      id: "core/hotspot-change-review",
      revision: 1,
      title: "Known maintenance hotspots receive focused review",
      summary:
        "Flags changes to paths a repository has identified from real corrective history instead of treating generic complexity scores as defects.",
      guidance: {
        standard:
          "A known hotspot change addresses the historical failure mode recorded by the repository and does not add another owner, hidden dependency or synchronized edit obligation.",
        checks: [
          "Read the recorded hotspot evidence and verify that it still applies to this path.",
          "Trace the change through the failure, rollback or co-change pattern that made the path a hotspot.",
          "PASS when the change contains or reduces that risk with relevant evidence.",
          "Remove a hotspot binding when repository history no longer justifies the review cost.",
        ],
        examples: [
          {
            label: "REVIEW",
            code: "{ id: 'order-reconciliation', pathPattern: /^src\\/orders\\/reconcile/, evidence: 'Three partial-failure fixes in Q3' }",
            description: "The trigger is backed by local history rather than a universal complexity threshold.",
          },
        ],
        refs: [{ type: "url", href: "https://alexn.org/blog/2026/09/22/ai-has-no-wisdom-and-neither-will-you/" }],
      },
    },
    binding: {
      id: "core/hotspot-change-review",
      authority: "human",
      include: ["**/*"],
      options: {
        hotspots: hotspots.map((hotspot) => ({
          id: hotspot.id,
          pathPattern: hotspot.pathOption,
          evidence: hotspot.evidence,
        })),
      },
    },
    detector: {
      id: "core/hotspot-change-review",
      version: 1,
      fixtures: {
        mustReport: [],
        mustStaySilent: [{ before: {}, after: { "src/module.ts": "export const value = 1;\n" } }],
      },
      detect({ context }) {
        for (const hotspot of hotspots) {
          const files = context.change.files.filter((file) => matches(hotspot.pathPattern, file.path));
          const first = files.toSorted((left, right) => left.path.localeCompare(right.path))[0];
          if (!first) continue;
          const paths = files.map((file) => file.path).toSorted();
          context.report({
            key: hotspot.id,
            file: first.path,
            lineageKey: hotspot.id,
            message: `Known hotspot \`${hotspot.id}\` changed; review it against this repository evidence: ${hotspot.evidence}`,
            evidence: { id: hotspot.id, history: hotspot.evidence, files: paths },
            relatedFiles: paths.filter((path) => path !== first.path),
            excerpt: hotspot.evidence,
            startLine: Math.max(1, first.hunks[0]?.newStart ?? first.hunks[0]?.oldStart ?? 1),
            endLine: Math.max(1, first.hunks[0]?.newStart ?? first.hunks[0]?.oldStart ?? 1),
          });
        }
      },
    },
  });
}

export const hotspotChangeReview = defineHotspotChangeReview();
