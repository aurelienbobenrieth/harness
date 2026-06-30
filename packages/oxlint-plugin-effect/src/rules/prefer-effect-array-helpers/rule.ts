import type { ESTree, Rule } from "@oxlint/plugins";
import { isIdentifier } from "../ast.js";

const message = "Use Effect array helpers instead of native array helper methods in Effect runtime code.";
const helperNames = new Set(["every", "filter", "find", "flatMap", "includes", "map", "reduce", "some", "sort"]);
const defaultAllow = ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx", "**/scripts/**"];
const defaultIgnoredObjects = [
  "Array",
  "Arr",
  "Effect",
  "HashMap",
  "HashSet",
  "Match",
  "Option",
  "Record",
  "Schedule",
  "Schema",
  "Stream",
];

type Options = { readonly allow?: readonly string[]; readonly ignoredObjects?: readonly string[] };
type ContextWithOptions = {
  readonly filename?: string;
  readonly getFilename?: () => string;
  readonly options?: readonly unknown[];
};

function getFilename(context: ContextWithOptions): string {
  return context.filename ?? context.getFilename?.() ?? "";
}
function getOptions(context: ContextWithOptions): Options {
  const candidate = context.options?.[0];
  if (typeof candidate !== "object" || candidate === null) return {};
  const record = candidate as { readonly allow?: unknown; readonly ignoredObjects?: unknown };
  return {
    ...(Array.isArray(record.allow) && record.allow.every((entry) => typeof entry === "string")
      ? { allow: record.allow }
      : {}),
    ...(Array.isArray(record.ignoredObjects) && record.ignoredObjects.every((entry) => typeof entry === "string")
      ? { ignoredObjects: record.ignoredObjects }
      : {}),
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

function isNativeArrayHelperCall(node: ESTree.Node, ignoredObjects: readonly string[]): node is ESTree.CallExpression {
  if (node.type !== "CallExpression" || node.callee.type !== "MemberExpression") return false;
  const property = node.callee.property;
  if (!isIdentifier(property) || !helperNames.has(property.name)) return false;
  const object = node.callee.object;
  return !(isIdentifier(object) && ignoredObjects.includes(object.name));
}

export const preferEffectArrayHelpers: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Prefer Effect array helpers over native array helper methods." },
    messages: { preferEffectArray: message },
    schema: [
      {
        type: "object",
        properties: {
          allow: { type: "array", items: { type: "string" } },
          ignoredObjects: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: defaultAllow, ignoredObjects: defaultIgnoredObjects }],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const options = getOptions(context as ContextWithOptions);
        if (isAllowedFile(getFilename(context as ContextWithOptions), options.allow ?? defaultAllow)) return;
        if (!isNativeArrayHelperCall(node, options.ignoredObjects ?? defaultIgnoredObjects)) return;
        context.report({ node, messageId: "preferEffectArray" });
      },
    };
  },
};
