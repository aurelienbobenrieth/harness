import type { ESTree, Rule } from "@oxlint/plugins";

const message =
  "Cart, Storefront API, and Section Rendering calls go through the cart actor wrapper (which may delegate to Shopify.actions.*), never direct fetch: one choke point keeps optimistic state, feedback, and events consistent.";

type RuleOptions = { readonly allowIn?: readonly string[] };

const cartEndpointPattern = /\/cart(\.js|\/(add|change|update|clear)(\.js)?)/;
const storefrontApiPattern = /graphql\.json/;
const sectionRenderingPattern = /[?&](sections|section_id)=/;

function allowedPathFragments(context: unknown): readonly string[] {
  const options = (context as { readonly options?: readonly unknown[] }).options;
  const first = options?.[0];
  if (typeof first === "object" && first !== null) {
    const allowIn = (first as RuleOptions).allowIn;
    if (Array.isArray(allowIn)) {
      return allowIn.filter((entry): entry is string => typeof entry === "string");
    }
  }
  return [];
}

function filenameOf(context: unknown): string {
  const holder = context as { readonly filename?: unknown; readonly getFilename?: () => unknown };
  const direct = holder.filename;
  if (typeof direct === "string") return direct;
  const fromGetter = holder.getFilename?.();
  return typeof fromGetter === "string" ? fromGetter : "";
}

function isFetchCallee(callee: ESTree.Expression | ESTree.Super): boolean {
  if (callee.type === "Identifier") return callee.name === "fetch";
  if (callee.type !== "MemberExpression" || callee.computed) return false;
  if (callee.property.type !== "Identifier" || callee.property.name !== "fetch") return false;
  return callee.object.type === "Identifier" && ["window", "globalThis", "self"].includes(callee.object.name);
}

function urlText(argument: ESTree.Expression | ESTree.SpreadElement | undefined): string | undefined {
  if (argument === undefined) return undefined;
  if (argument.type === "Literal") {
    return typeof argument.value === "string" ? argument.value : undefined;
  }
  if (argument.type === "TemplateLiteral") {
    return argument.quasis.map((quasi) => quasi.value.cooked ?? "").join("");
  }
  return undefined;
}

function targetsCommerceApi(url: string): boolean {
  return cartEndpointPattern.test(url) || storefrontApiPattern.test(url) || sectionRenderingPattern.test(url);
}

export const noDirectCartFetch: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow direct fetch calls to the Cart Ajax, Storefront, and Section Rendering APIs.",
    },
    messages: {
      noDirectCartFetch: message,
    },
    schema: [
      {
        type: "object",
        properties: {
          allowIn: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isFetchCallee(node.callee)) return;
        const url = urlText(node.arguments[0]);
        if (url === undefined || !targetsCommerceApi(url)) return;

        const filename = filenameOf(context).replaceAll("\\", "/");
        if (allowedPathFragments(context).some((fragment) => filename.includes(fragment))) return;

        context.report({ node, messageId: "noDirectCartFetch" });
      },
    };
  },
};
