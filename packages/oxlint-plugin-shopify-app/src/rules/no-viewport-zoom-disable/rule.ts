import type { Rule } from "@oxlint/plugins";

const message =
  "Viewport meta tags must not block zoom: allow at least 5x scaling and remove `user-scalable=no` or `0` (Shopify accessibility requirements).";

function blocksZoom(content: string): boolean {
  return content.split(/[,;]/).some((token) => {
    const [key, value] = token
      .trim()
      .toLowerCase()
      .split(/\s*=\s*/);
    return (
      (key === "user-scalable" && (value === "no" || value === "0")) ||
      (key === "maximum-scale" && value !== undefined && Number.isFinite(Number(value)) && Number(value) < 5)
    );
  });
}

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

function elementName(node: JsxOpeningElement): string {
  return node.name?.type === "JSXIdentifier" ? (node.name.name ?? "") : "";
}

function attributeStringValue(node: JsxOpeningElement, attributeName: string): string | undefined {
  for (const attribute of node.attributes ?? []) {
    if (attribute.type !== "JSXAttribute" || attribute.name?.name !== attributeName) continue;
    if (attribute.value?.type === "Literal" && typeof attribute.value.value === "string") {
      return attribute.value.value;
    }
  }
  return undefined;
}

export const noViewportZoomDisable: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow viewport meta tags that block pinch zoom.",
    },
    messages: {
      noViewportZoomDisable: message,
    },
  },
  createOnce(context) {
    return {
      JSXOpeningElement(node) {
        const opening = node as unknown as JsxOpeningElement;
        if (elementName(opening) !== "meta") return;
        if (attributeStringValue(opening, "name") !== "viewport") return;

        const content = attributeStringValue(opening, "content");
        if (content === undefined || !blocksZoom(content)) return;
        context.report({ node, messageId: "noViewportZoomDisable" });
      },
    };
  },
};
