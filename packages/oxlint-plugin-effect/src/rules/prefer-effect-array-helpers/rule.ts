import type { ESTree, Rule, Context, Scope } from "@oxlint/plugins";
import { isIdentifier } from "../ast.js";
import { getFilename, isAllowedFile, type RuleContextWithOptions } from "../runtime-support.js";

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

function getOptions(context: RuleContextWithOptions): Options {
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

function isNativeArrayHelperCall(
  node: ESTree.Node,
  ignoredObjects: readonly string[],
  context: Context,
): node is ESTree.CallExpression {
  if (node.type !== "CallExpression" || node.callee.type !== "MemberExpression") return false;
  const property = node.callee.property;
  if (!isIdentifier(property) || !helperNames.has(property.name)) return false;
  const object = node.callee.object;
  if (object.type === "ArrayExpression") return true;
  if (!isIdentifier(object) || ignoredObjects.includes(object.name)) return false;
  let scope: Scope | null = context.sourceCode.getScope(object);
  while (scope !== null) {
    const binding = scope.set.get(object.name);
    if (binding !== undefined)
      return binding.defs.some((definition) => {
        if (definition.node.type === "VariableDeclarator" && definition.node.init?.type === "ArrayExpression")
          return true;
        const annotation = "typeAnnotation" in definition.name ? definition.name.typeAnnotation : undefined;
        return annotation?.typeAnnotation.type === "TSArrayType";
      });
    scope = scope.upper;
  }
  return false;
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
      before() {
        const allow = getOptions(context as RuleContextWithOptions).allow ?? defaultAllow;
        return !isAllowedFile(getFilename(context as RuleContextWithOptions), allow);
      },
      CallExpression(node) {
        const options = getOptions(context as RuleContextWithOptions);
        if (!isNativeArrayHelperCall(node, options.ignoredObjects ?? defaultIgnoredObjects, context)) return;
        context.report({ node, messageId: "preferEffectArray" });
      },
    };
  },
};
