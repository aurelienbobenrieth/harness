import type { ESTree, Rule } from "@oxlint/plugins";
import { elementName } from "../jsx-support.js";
import { firstOption, stringArrayOption } from "../option-support.js";
import { lookupManifest, type ManifestLookup } from "./manifest.js";

/** App Bridge owns these `s-*` elements; `@shopify/polaris-types` does not describe them. */
const defaultAllowElements = ["s-app-nav", "s-app-window"];
/** JSX framework props and the global `id`, accepted on every element. */
const frameworkAttributes = new Set(["key", "ref", "slot", "children", "id"]);

/** Children of an allowed element (App Bridge nav links) follow that element's contract, not the manifest's. */
function ownedByAllowedParent(node: ESTree.JSXOpeningElement, allowElements: ReadonlySet<string>): boolean {
  let parent: ESTree.Node | null | undefined = node.parent?.parent;
  while (parent?.type === "JSXFragment") parent = parent.parent;
  if (parent?.type !== "JSXElement") return false;
  const name = elementName(parent.openingElement);
  return name !== undefined && allowElements.has(name);
}

function isAllowedAttribute(name: string, allowAttributes: ReadonlySet<string>): boolean {
  return frameworkAttributes.has(name) || allowAttributes.has(name) || name.startsWith("data-");
}

/**
 * @attribution https://shopify.dev/docs/api/app-home/latest/web-components (inspiration; independently implemented)
 * @attribution https://github.com/webcomponents/custom-elements-manifest (inspiration; independently implemented)
 */
export const sKnownComponents: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `s-*` elements and attributes that the project's installed `@shopify/polaris-types` Custom Elements Manifest does not declare; silent when no manifest resolves. Options `manifestPath`, `allowElements` and `allowAttributes`.",
    },
    messages: {
      unknownElement:
        "`<{{name}}>` is not a Polaris web component in the installed @shopify/polaris-types manifest. Use a documented component, or add it to `allowElements` if another library defines it.",
      unknownAttribute:
        "`{{attribute}}` is not a property, attribute or event of `<{{name}}>` in the installed @shopify/polaris-types manifest. Use the documented name, or remove it.",
      manifestUnreadable:
        "The Polaris Custom Elements Manifest at {{file}} is missing or declares no elements. Fix the `manifestPath` option or reinstall @shopify/polaris-types.",
    },
    schema: [
      {
        type: "object",
        properties: {
          manifestPath: { type: "string" },
          allowElements: { type: "array", items: { type: "string" } },
          allowAttributes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    let lookup: ManifestLookup = { kind: "absent" };
    let allowElements: ReadonlySet<string> = new Set();
    let allowAttributes: ReadonlySet<string> = new Set();

    return {
      before() {
        const option = firstOption(context);
        const manifestPath = typeof option.manifestPath === "string" ? option.manifestPath : undefined;
        lookup = lookupManifest(context.filename, context.cwd, manifestPath);
        allowElements = new Set(stringArrayOption(option, "allowElements", defaultAllowElements));
        allowAttributes = new Set(stringArrayOption(option, "allowAttributes", []));
        return lookup.kind !== "absent";
      },
      Program(node: ESTree.Program) {
        if (lookup.kind !== "unreadable") return;
        context.report({ node, messageId: "manifestUnreadable", data: { file: lookup.file } });
      },
      JSXOpeningElement(node) {
        if (lookup.kind !== "loaded") return;
        const name = elementName(node);
        if (name === undefined || !name.startsWith("s-") || allowElements.has(name)) return;
        const element = lookup.vocabulary.get(name);
        if (element === undefined) {
          context.report({ node: node.name, messageId: "unknownElement", data: { name } });
          return;
        }
        if (ownedByAllowedParent(node, allowElements)) return;
        for (const entry of node.attributes) {
          if (entry.type !== "JSXAttribute" || entry.name.type !== "JSXIdentifier") continue;
          const attribute = entry.name.name;
          if (isAllowedAttribute(attribute, allowAttributes) || element.attributes.has(attribute)) continue;
          if (attribute.startsWith("on") && element.handlers.has(attribute.toLowerCase())) continue;
          context.report({ node: entry, messageId: "unknownAttribute", data: { attribute, name } });
        }
      },
    };
  },
};
