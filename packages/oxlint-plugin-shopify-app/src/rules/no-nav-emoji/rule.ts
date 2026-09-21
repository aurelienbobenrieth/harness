import type { Rule } from "@oxlint/plugins";
import { firstOption, stringArrayOption } from "../option-support.js";

const message = "Navigation labels must not contain emoji (BFS 4.1.4).";

// ui-nav-menu is the App Bridge React navigation web component; both nav
// surfaces carry the same BFS requirement.
const defaultNavComponents = ["s-app-nav", "ui-nav-menu"] as const;
const emojiPattern = /\p{Extended_Pictographic}/u;

type JsxName = { readonly type: string; readonly name?: string };
type JsxAttributeValue = { readonly type: string; readonly value?: unknown };
type JsxAttribute = {
  readonly type: string;
  readonly name?: JsxName;
  readonly value?: JsxAttributeValue | null;
};
type JsxOpeningElement = {
  readonly name?: JsxName;
  readonly attributes?: readonly JsxAttribute[];
};
type JsxNode = {
  readonly type: string;
  readonly openingElement?: JsxOpeningElement;
  readonly children?: readonly JsxNode[];
  readonly value?: unknown;
};

function elementName(node: JsxOpeningElement | undefined): string {
  return node?.name?.type === "JSXIdentifier" ? (node.name.name ?? "") : "";
}

function collectEmojiNodes(node: JsxNode, results: JsxNode[]): void {
  if (node.type === "JSXText" && typeof node.value === "string" && emojiPattern.test(node.value)) {
    results.push(node);
  }
  // Labels can also live in attributes such as label="📦 Orders".
  for (const attribute of node.openingElement?.attributes ?? []) {
    if (attribute.type !== "JSXAttribute") continue;
    const value = attribute.value;
    if (value?.type === "Literal" && typeof value.value === "string" && emojiPattern.test(value.value)) {
      results.push(value as unknown as JsxNode);
    }
  }
  for (const child of node.children ?? []) {
    collectEmojiNodes(child, results);
  }
}

export const noNavEmoji: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow emoji inside app navigation labels. Option `navComponents` overrides the checked element names.",
    },
    messages: {
      noNavEmoji: message,
    },
    schema: [
      {
        type: "object",
        properties: {
          navComponents: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    return {
      JSXElement(node) {
        const navComponents = stringArrayOption(firstOption(context), "navComponents", defaultNavComponents);
        const element = node as unknown as JsxNode;
        if (!navComponents.includes(elementName(element.openingElement))) return;

        const emojiNodes: JsxNode[] = [];
        for (const child of element.children ?? []) {
          collectEmojiNodes(child, emojiNodes);
        }
        for (const emojiNode of emojiNodes) {
          context.report({
            node: emojiNode as unknown as NonNullable<Parameters<typeof context.report>[0]["node"]>,
            messageId: "noNavEmoji",
          });
        }
      },
    };
  },
};
