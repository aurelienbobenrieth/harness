import { defineRule, type AgentlintRule } from "@aurelienbbn/agentlint";

const defaultMotionCallPattern = /\.animate\s*\(|scroll(?:IntoView|To|By)\s*\(\s*\{[^}]*(?:'|")smooth(?:'|")/;
const defaultMotionGuardPattern = /prefers-reduced-motion|prefersReducedMotion|reducedMotion/;

export type RespectReducedMotionOptions = {
  /** Pattern matching JavaScript-driven motion calls. */
  readonly motionCallPattern?: RegExp;
  /**
   * Pattern that proves a reduced-motion guard within the call text. Extend it
   * with the name of your shared motion helper so gated calls stop triggering.
   */
  readonly motionGuardPattern?: RegExp;
};

export function defineRespectReducedMotion(options: RespectReducedMotionOptions = {}): AgentlintRule {
  const motionCallPattern = options.motionCallPattern ?? defaultMotionCallPattern;
  const motionGuardPattern = options.motionGuardPattern ?? defaultMotionGuardPattern;

  return defineRule({
    id: "shopify-theme/respect-reduced-motion",
    description: "Flags JavaScript-driven animation that needs a reduced-motion check.",
    guidance: {
      standard:
        "JavaScript-driven animation and smooth scrolling must respect prefers-reduced-motion: reduce, falling back to instant transitions.",
      checks: [
        "The animation path checks matchMedia('(prefers-reduced-motion: reduce)') or an equivalent shared helper.",
        "Smooth scrolling falls back to behavior: 'instant' (or auto) when reduced motion is preferred.",
        "Purely functional motion with no vestibular impact (for example a progress value change) does not need gating.",
      ],
      refs: [{ type: "url", href: "https://shopify.dev/docs/storefronts/themes/best-practices/accessibility" }],
    },
    createOnce(context) {
      return {
        call_expression(node) {
          if (!motionCallPattern.test(node.text)) return;
          if (motionGuardPattern.test(node.text)) return;
          context.report({
            node,
            message: "JavaScript-driven motion: verify a prefers-reduced-motion fallback covers this path.",
          });
        },
      };
    },
  });
}

export const respectReducedMotion = defineRespectReducedMotion();
