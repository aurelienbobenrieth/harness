import type { ESTree, Rule } from "@oxlint/plugins";
import { isMemberExpression } from "../ast.js";

const message = "Use typed Effect failures instead of converting failures to defects with Effect.orDie.";
const defaultAllow: readonly string[] = [];
const defaultAllowedCalls: readonly string[] = [];

type RuleOptions = {
  readonly allow?: readonly string[];
  readonly allowedCalls?: readonly string[];
};

type RuleContextWithOptions = {
  readonly filename?: string;
  readonly getFilename?: () => string;
  readonly options?: readonly unknown[];
};

function getFilename(context: RuleContextWithOptions): string {
  return context.filename ?? context.getFilename?.() ?? "";
}

function getOptions(context: RuleContextWithOptions): RuleOptions {
  const candidate = context.options?.[0];
  if (typeof candidate !== "object" || candidate === null) return {};

  const allow = (candidate as { readonly allow?: unknown }).allow;
  const allowedCalls = (candidate as { readonly allowedCalls?: unknown }).allowedCalls;

  return {
    allow: Array.isArray(allow) && allow.every((entry) => typeof entry === "string") ? allow : undefined,
    allowedCalls:
      Array.isArray(allowedCalls) && allowedCalls.every((entry) => typeof entry === "string")
        ? allowedCalls
        : undefined,
  };
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(glob: string): RegExp {
  let pattern = "";
  const normalized = normalizePath(glob);

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized.charAt(index);
    const next = normalized.charAt(index + 1);
    const afterNext = normalized.charAt(index + 2);

    if (character === "*" && next === "*" && afterNext === "/") {
      pattern += "(?:.*/)?";
      index += 2;
      continue;
    }

    if (character === "*" && next === "*") {
      pattern += ".*";
      index += 1;
      continue;
    }

    if (character === "*") {
      pattern += "[^/]*";
      continue;
    }

    pattern += escapeRegExp(character);
  }

  return new RegExp(`^${pattern}$`, "u");
}

function isAllowedFile(filename: string, patterns: readonly string[]): boolean {
  const normalized = normalizePath(filename);
  return patterns.some((pattern) => globToRegExp(pattern).test(normalized));
}

function isOrDieReference(node: ESTree.Node): node is ESTree.MemberExpression {
  return isMemberExpression(node, "Effect", "orDie") || isMemberExpression(node, "Effect", "orDieWith");
}

function getEffectCallName(node: ESTree.Node): "orDie" | "orDieWith" | undefined {
  if (isMemberExpression(node, "Effect", "orDie")) return "orDie";
  if (isMemberExpression(node, "Effect", "orDieWith")) return "orDieWith";
  return undefined;
}

export const noEffectOrDie: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Effect.orDie and Effect.orDieWith outside configured escape hatches.",
    },
    messages: {
      noEffectOrDie: message,
    },
    schema: [
      {
        type: "object",
        properties: {
          allow: {
            type: "array",
            items: { type: "string" },
          },
          allowedCalls: {
            type: "array",
            items: { enum: ["orDie", "orDieWith"] },
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: defaultAllow, allowedCalls: defaultAllowedCalls }],
  },
  createOnce(context) {
    return {
      MemberExpression(node) {
        if (!isOrDieReference(node)) return;

        const options = getOptions(context as RuleContextWithOptions);
        const allow = options.allow ?? defaultAllow;
        const allowedCalls = options.allowedCalls ?? defaultAllowedCalls;
        if (isAllowedFile(getFilename(context as RuleContextWithOptions), allow)) return;

        const callName = getEffectCallName(node);
        if (callName !== undefined && allowedCalls.includes(callName)) return;

        context.report({
          node,
          messageId: "noEffectOrDie",
        });
      },
    };
  },
};
