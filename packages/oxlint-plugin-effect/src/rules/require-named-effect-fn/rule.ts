import { binding } from "@aurelienbbn/oxlint-kit/ast";
import { effectMethod } from "../binding-support.js";
import {
  defaultAllow,
  getFilename,
  getOptions,
  isAllowedFile,
  type RuleContextWithOptions,
} from "../runtime-support.js";
import type { ESTree, Rule } from "@oxlint/plugins";

const message =
  'Name Effect.fn calls for tracing, for example Effect.fn("service.method")(...), or use Effect.fnUntraced when the function needs no span.';

function isNonEmptyStringLiteral(node: ESTree.Node | undefined): boolean {
  return node?.type === "Literal" && typeof node.value === "string" && node.value.trim().length > 0;
}

export const requireNamedEffectFn: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require Effect.fn calls to include a non-empty name, except in test files and `allow` globs.",
    },
    messages: { namedEffectFn: message },
    schema: [
      {
        type: "object",
        properties: { allow: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: defaultAllow }],
  },
  createOnce(context) {
    return {
      before() {
        const allow = getOptions(context as RuleContextWithOptions).allow ?? defaultAllow;
        return !isAllowedFile(getFilename(context as RuleContextWithOptions), allow);
      },
      CallExpression(node) {
        if (effectMethod(context, node.callee) !== "fn") return;
        const name = node.arguments[0];
        if (isNonEmptyStringLiteral(name)) return;
        if (
          name?.type === "Identifier" &&
          binding(context, name, name.name)?.defs.some(
            (definition) =>
              definition.node.type === "VariableDeclarator" &&
              definition.parent?.type === "VariableDeclaration" &&
              definition.parent.kind === "const" &&
              isNonEmptyStringLiteral(definition.node.init ?? undefined),
          )
        )
          return;
        context.report({ node, messageId: "namedEffectFn" });
      },
    };
  },
};
