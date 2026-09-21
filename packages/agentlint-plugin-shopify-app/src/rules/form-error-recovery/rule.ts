import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";
import { elementName, hasPossibleAttributeValue, matchesPattern } from "../jsx-support.js";

export type FormErrorRecoveryOptions = {
  /** Form control names to review. Defaults to Polaris App Home input controls. */
  readonly elementNamePattern?: RegExp;
  /** Error-bearing prop on the control. Defaults to error. */
  readonly errorAttribute?: string;
};

/**
 * Reviews error wiring without deciding whether a dynamic value currently renders.
 * @attribution https://shopify.dev/docs/apps/design/user-experience/alerts (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-field (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/api/app-home/latest/web-components/forms/switch (inspiration; independently implemented)
 */
export function defineFormErrorRecovery(options: FormErrorRecoveryOptions = {}): StateRule {
  options = structuredClone(options);
  const pattern =
    options.elementNamePattern ??
    /^s-(?:(?:text|email|url|password|number|money|search|date|color)-field|text-area|select|checkbox|switch|choice-list|drop-zone)$/;
  const errorAttribute = options.errorAttribute ?? "error";
  return defineRule({
    lifecycle: "state",
    standard: {
      id: "shopify-app/form-error-recovery",
      revision: 1,
      title: "Form Error Recovery",
      summary: "Reviews Polaris form controls with error wiring for understandable, persistent recovery feedback.",
      guidance: {
        standard: "Validation feedback must help a merchant correct the affected value and keep their work intact.",
        checks: [
          "Exercise untouched, typing, blur, submit, server failure, and corrected states; errors must not appear before merchant interaction.",
          "Keep field-specific feedback with its field until resolved. Explain the correction in merchant language, including required units or formats.",
          "Retain entered values on failure, expose the error to assistive technology, and verify successful retry clears it.",
          "Do not rely on a disappearing toast or color alone. Validate business constraints on the server as well as the client.",
          "The field reference encourages feedback while typing, while the Alerts guide prefers errors after blur. Record the chosen timing and demonstrate it does not interrupt incomplete input.",
        ],
        refs: [
          { type: "url", href: "https://shopify.dev/docs/apps/design/user-experience/alerts" },
          {
            type: "url",
            href: "https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-field",
          },
          {
            type: "url",
            href: "https://shopify.dev/docs/api/app-home/latest/web-components/forms/switch",
          },
          {
            type: "url",
            href: "https://shopify.dev/docs/apps/launch/built-for-shopify/requirements#helpful-error-messages",
          },
        ],
      },
    },
    binding: {
      id: "shopify-app/form-error-recovery",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx}", "**/locales/**/*.json"],
      exclude: ["**/*.d.ts"],
      options: {
        elementNamePattern: options.elementNamePattern
          ? { source: options.elementNamePattern.source, flags: options.elementNamePattern.flags }
          : null,
        errorAttribute: options.errorAttribute ?? null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [{ file: "src/view.tsx", source: "const ui=<s-text-field error={error}/>;" }],
        mustStaySilent: [{ file: "src/view.tsx", source: 'const ui=<s-text-field error=""/>;' }],
      },
      id: "shopify-app/form-error-recovery",
      version: 1,
      scan: "file",
      createOnce(context) {
        const check = (node: AgentlintNode): void => {
          if (!matchesPattern(pattern, elementName(node) ?? "") || !hasPossibleAttributeValue(node, errorAttribute))
            return;
          context.report({
            node,
            message:
              "Form control has error wiring: verify validation timing, correction guidance, and recovery states.",
          });
        };
        return { jsx_opening_element: check, jsx_self_closing_element: check };
      },
    },
  });
}

export const formErrorRecovery = defineFormErrorRecovery();
