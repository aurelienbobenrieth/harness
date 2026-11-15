/**
 * @attribution ai-automation by Sandro Maglione (inspiration, independently re-implemented)
 */
import { optionsObject } from "@aurelienbbn/oxlint-kit/ast";
import type { ESTree, Rule } from "@oxlint/plugins";
import { moduleMethod } from "../binding-support.js";

const message =
  "Do not use Effect.serviceOption. Require the service directly and provide it in the layer; list an ambient service in `allowedServices` (it adds to `ParentSpan`) when its absence is a normal state.";

/** Services Effect itself provides only inside a scope: a span exists only under a parent span. */
const defaultAllowedServices: readonly string[] = ["ParentSpan"];

/** The last identifier of the service operand: `ParentSpan` for `Tracer.ParentSpan`, `Mailer` for `Mailer`. */
function serviceName(node: ESTree.Node | undefined): string | undefined {
  if (node?.type === "Identifier") return node.name;
  if (node?.type === "MemberExpression" && !node.computed && node.property.type === "Identifier")
    return node.property.name;
  return undefined;
}

function allowedServices(options: Readonly<Record<string, unknown>>): readonly string[] {
  const value = options["allowedServices"];
  const configured = Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
  return [...defaultAllowedServices, ...configured];
}

export const noServiceOption: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Effect.serviceOption in favor of required services provided by layers, except for `ParentSpan` and the ambient services named in `allowedServices`.",
    },
    messages: {
      noServiceOption: message,
    },
    schema: [
      {
        type: "object",
        properties: { allowedServices: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allowedServices: [] }],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (moduleMethod(context, node.callee, "Effect") !== "serviceOption") return;
        const service = serviceName(node.arguments[0]);
        if (service !== undefined && allowedServices(optionsObject(context)).includes(service)) return;

        context.report({ node, messageId: "noServiceOption" });
      },
    };
  },
};
