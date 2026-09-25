import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { destructuredFrom, isAuthenticateCall, memberPath } from "../ast-support.js";
import { firstOption, stringArrayOption } from "../option-support.js";

const defaultLoggerObjects = ["console", "logger", "log"];
const defaultSensitiveNames = ["session", "accessToken", "access_token", "sessionToken", "idToken"];
const defaultWebhookPayloadNames = ["payload"];
const webhookOnly = new Set(["webhook"]);

/**
 * Domain-neutral detector: which logger arguments expose a value whose terminal name is sensitive.
 * `isSensitiveBinding` is the only extension point, so the detector can move to a core
 * secrets-in-logs rule with a different name list and no Shopify knowledge.
 */
type SensitiveLookup = {
  readonly names: ReadonlySet<string>;
  readonly isSensitiveBinding: (identifier: Extract<ESTree.Node, { type: "Identifier" }>) => boolean;
};

function exposedName(node: ESTree.Node | null | undefined, lookup: SensitiveLookup, depth = 0): string | undefined {
  if (node == null || depth > 4) return undefined;
  switch (node.type) {
    case "Identifier":
      return lookup.names.has(node.name) || lookup.isSensitiveBinding(node) ? node.name : undefined;
    case "MemberExpression": {
      if (node.computed) {
        const key = node.property;
        return key.type === "Literal" && typeof key.value === "string" && lookup.names.has(key.value)
          ? key.value
          : undefined;
      }
      return node.property.type === "Identifier" && lookup.names.has(node.property.name)
        ? node.property.name
        : undefined;
    }
    case "ObjectExpression":
      for (const property of node.properties) {
        const found = exposedName(
          property.type === "SpreadElement" ? property.argument : property.value,
          lookup,
          depth + 1,
        );
        if (found !== undefined) return found;
      }
      return undefined;
    case "ArrayExpression":
      for (const element of node.elements) {
        const found = exposedName(element?.type === "SpreadElement" ? element.argument : element, lookup, depth + 1);
        if (found !== undefined) return found;
      }
      return undefined;
    case "TemplateLiteral":
      for (const expression of node.expressions) {
        const found = exposedName(expression, lookup, depth + 1);
        if (found !== undefined) return found;
      }
      return undefined;
    case "CallExpression": {
      if (memberPath(node.callee)?.join(".") !== "JSON.stringify") return undefined;
      const first = node.arguments[0];
      return first?.type === "SpreadElement" ? undefined : exposedName(first, lookup, depth + 1);
    }
    case "ChainExpression":
      return exposedName(node.expression, lookup, depth + 1);
    case "AwaitExpression":
    case "TSNonNullExpression":
    case "TSAsExpression":
      return exposedName(node.type === "AwaitExpression" ? node.argument : node.expression, lookup, depth + 1);
    default:
      return undefined;
  }
}

function isLoggerCall(node: ESTree.CallExpression, loggerObjects: ReadonlySet<string>): boolean {
  const path = memberPath(node.callee);
  return path !== undefined && path.length >= 2 && loggerObjects.has(path.at(-2) ?? "");
}

function lookupFor(context: Context): {
  readonly lookup: SensitiveLookup;
  readonly loggers: ReadonlySet<string>;
} {
  const option = firstOption(context);
  const payloadNames = new Set(stringArrayOption(option, "webhookPayloadNames", defaultWebhookPayloadNames));
  return {
    loggers: new Set(stringArrayOption(option, "loggerObjects", defaultLoggerObjects)),
    lookup: {
      names: new Set(stringArrayOption(option, "sensitiveNames", defaultSensitiveNames)),
      isSensitiveBinding: (identifier) =>
        payloadNames.has(identifier.name) &&
        destructuredFrom(context, identifier, (init) => isAuthenticateCall(init, webhookOnly)),
    },
  };
}

/**
 * @attribution https://shopify.dev/docs/apps/launch/protected-customer-data (inspiration; independently implemented)
 */
export const noSessionOrTokenLogging: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow passing session objects, access or session tokens, or an authenticate.webhook payload to console/logger calls. Options `loggerObjects`, `sensitiveNames` and `webhookPayloadNames` override the matched names.",
    },
    messages: {
      noSessionOrTokenLogging:
        "This log call writes `{{name}}`, which carries access tokens or protected customer data, to the log stream. Log a non-sensitive identifier such as the shop domain or the webhook id.",
    },
    schema: [
      {
        type: "object",
        properties: {
          loggerObjects: { type: "array", items: { type: "string" } },
          sensitiveNames: { type: "array", items: { type: "string" } },
          webhookPayloadNames: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const { lookup, loggers } = lookupFor(context);
        if (!isLoggerCall(node, loggers)) return;
        for (const argument of node.arguments) {
          const name = exposedName(argument.type === "SpreadElement" ? argument.argument : argument, lookup);
          if (name === undefined) continue;
          context.report({ node: argument, messageId: "noSessionOrTokenLogging", data: { name } });
          return;
        }
      },
    };
  },
};
