import type { Rule } from "@oxlint/plugins";
import { firstOption, stringArrayOption } from "../option-support.js";

const message =
  'Modal action buttons must use the `slot="primary-action"` or `slot="secondary-actions"` slots (BFS 4.1.6).';

const defaultModalComponents = ["s-modal"] as const;
const defaultActionElements = ["s-button", "button"] as const;

type JsxName = { readonly type: string; readonly name?: string };
type JsxAttribute = {
  readonly type: string;
  readonly name?: JsxName;
  readonly value?: { readonly type: string; readonly value?: unknown } | null;
};
type JsxOpeningElement = {
  readonly name?: JsxName;
  readonly attributes?: readonly JsxAttribute[];
};
type JsxChild = {
  readonly type: string;
  readonly openingElement?: JsxOpeningElement;
};
type JsxElement = {
  readonly openingElement?: JsxOpeningElement;
  readonly children?: readonly JsxChild[];
};

function elementName(node: JsxOpeningElement | undefined): string {
  return node?.name?.type === "JSXIdentifier" ? (node.name.name ?? "") : "";
}

function hasAttribute(node: JsxOpeningElement | undefined, attributeName: string): boolean {
  return (node?.attributes ?? []).some(
    (attribute) =>
      attribute.type === "JSXAttribute" &&
      attribute.name?.name === attributeName &&
      attribute.value?.type === "Literal" &&
      ["primary-action", "secondary-actions"].includes(String(attribute.value.value)),
  );
}

export const sModalActionsUseSlots: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require modal action buttons to use the modal action slots. Options `components` and `actionElements` override the checked element names.",
    },
    messages: {
      sModalActionsUseSlots: message,
    },
    schema: [
      {
        type: "object",
        properties: {
          components: { type: "array", items: { type: "string" } },
          actionElements: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    return {
      JSXElement(node) {
        const option = firstOption(context);
        const components = stringArrayOption(option, "components", defaultModalComponents);
        const actionElements = stringArrayOption(option, "actionElements", defaultActionElements);

        const element = node as unknown as JsxElement;
        if (!components.includes(elementName(element.openingElement))) return;

        for (const child of element.children ?? []) {
          if (child.type !== "JSXElement") continue;
          if (!actionElements.includes(elementName(child.openingElement))) continue;
          if (hasAttribute(child.openingElement, "slot")) continue;
          context.report({
            node: child as unknown as NonNullable<Parameters<typeof context.report>[0]["node"]>,
            messageId: "sModalActionsUseSlots",
          });
        }
      },
    };
  },
};
