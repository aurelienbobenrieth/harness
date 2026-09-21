import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { isTestFile } from "../ast-support.js";
import { firstOption } from "../option-support.js";

const stableVersion = /^20\d{2}-(?:01|04|07|10)$/;
const versionInPath = /(?:^|[/:])api\/(20\d{2}-(?:01|04|07|10)|unstable)(?:\/|$)/g;
const enumMember = /^(January|April|July|October)(\d{2})$/;
const quarterMonth: Readonly<Record<string, string>> = {
  January: "01",
  April: "04",
  July: "07",
  October: "10",
};

type Bounds = { readonly minimum: string | undefined; readonly maximum: string | undefined };

function bounds(context: Context): Bounds {
  const option = firstOption(context);
  const read = (key: string): string | undefined => {
    const value = option[key];
    return typeof value === "string" && stableVersion.test(value) ? value : undefined;
  };
  return { minimum: read("minimumApiVersion"), maximum: read("maximumApiVersion") };
}

function propertyName(node: ESTree.Node): string | undefined {
  if (node.type === "Identifier") return node.name;
  return node.type === "Literal" && typeof node.value === "string" ? node.value : undefined;
}

/**
 * @attribution https://shopify.dev/docs/api/usage/versioning (inspiration; independently implemented)
 */
export const noStaleApiVersionInSource: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Shopify API versions in URLs, `apiVersion` properties and `ApiVersion.*` members that are `unstable` or outside the configured `minimumApiVersion`/`maximumApiVersion` bounds.",
    },
    messages: {
      unstableVersion:
        "Shopify API version `unstable` changes without notice and is not for production. Pin a stable quarterly version.",
      belowMinimum:
        "Shopify API version `{{version}}` is older than the reviewed minimum `{{minimum}}`; unsupported versions silently fall forward to a different schema. Update this call to a supported version.",
      aboveMaximum:
        "Shopify API version `{{version}}` is newer than the reviewed maximum `{{maximum}}`. Review the release notes, then raise `maximumApiVersion`.",
    },
    schema: [
      {
        type: "object",
        properties: {
          minimumApiVersion: { type: "string", pattern: "^20\\d{2}-(?:01|04|07|10)$" },
          maximumApiVersion: { type: "string", pattern: "^20\\d{2}-(?:01|04|07|10)$" },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    const check = (node: ESTree.Node, version: string): void => {
      if (version === "unstable") {
        if (!isTestFile(context)) context.report({ node, messageId: "unstableVersion" });
        return;
      }
      const { minimum, maximum } = bounds(context);
      if (minimum !== undefined && version < minimum)
        context.report({ node, messageId: "belowMinimum", data: { version, minimum } });
      else if (maximum !== undefined && version > maximum)
        context.report({ node, messageId: "aboveMaximum", data: { version, maximum } });
    };
    const checkText = (node: ESTree.Node, text: string): void => {
      for (const match of text.matchAll(versionInPath)) check(node, match[1] ?? "");
    };
    return {
      Literal(node) {
        if (typeof node.value === "string") checkText(node, node.value);
      },
      TemplateLiteral(node) {
        checkText(node, node.quasis.map((quasi) => quasi.value.cooked ?? "").join("${}"));
      },
      Property(node) {
        if (node.computed || propertyName(node.key) !== "apiVersion") return;
        const value = node.value;
        if (value.type !== "Literal" || typeof value.value !== "string") return;
        if (stableVersion.test(value.value) || value.value === "unstable") check(value, value.value);
      },
      MemberExpression(node) {
        if (node.computed || node.object.type !== "Identifier" || node.object.name !== "ApiVersion") return;
        if (node.property.type !== "Identifier") return;
        if (node.property.name === "Unstable") return check(node, "unstable");
        const match = enumMember.exec(node.property.name);
        if (match !== null) check(node, `20${match[2]}-${quarterMonth[match[1] ?? ""]}`);
      },
    };
  },
};
