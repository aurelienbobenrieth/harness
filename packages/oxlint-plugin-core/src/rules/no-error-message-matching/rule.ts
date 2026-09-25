import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { isCaughtErrorBinding, outermostWrapper, unwrapExpression } from "../ast-support.js";
import { isTestFile, type RuleContextWithFilename } from "../filename-support.js";

const errorNamePattern = /^(?:e|err|error|cause|reason|ex|exception)$/i;
const errorSuffixPattern = /(?:Error|Err|Exception)$/;
const matchingMethods = new Set(["includes", "startsWith", "endsWith", "match", "search", "indexOf"]);
const textPreservingMethods = new Set([
  "toLowerCase",
  "toUpperCase",
  "toLocaleLowerCase",
  "toLocaleUpperCase",
  "trim",
  "trimStart",
  "trimEnd",
  "normalize",
]);
const equalityOperators = new Set(["===", "!==", "==", "!="]);

function propertyName(node: ESTree.MemberExpression): string | undefined {
  return !node.computed && node.property.type === "Identifier" ? node.property.name : undefined;
}

function isErrorShapedName(name: string): boolean {
  return errorNamePattern.test(name) || errorSuffixPattern.test(name);
}

function isErrorValue(context: Context, node: ESTree.Node): boolean {
  const value = unwrapExpression(node);
  if (value.type === "Identifier") return isErrorShapedName(value.name) || isCaughtErrorBinding(context, value);
  if (value.type !== "MemberExpression") return false;
  const name = propertyName(value);
  return name !== undefined && isErrorShapedName(name);
}

function isStringLiteral(node: ESTree.Node): boolean {
  const value = unwrapExpression(node);
  return value.type === "TemplateLiteral" || (value.type === "Literal" && typeof value.value === "string");
}

/** Decides whether the error text flows into a comparison, a substring/regex test, or a switch. */
function isMatchedAgainst(text: ESTree.Node): boolean {
  let current = outermostWrapper(text);
  for (;;) {
    const parent = current.parent;
    if (parent === null || parent === undefined) return false;

    if (parent.type === "MemberExpression" && parent.object === current) {
      const method = propertyName(parent);
      const access = outermostWrapper(parent);
      const call = access.parent;
      if (method === undefined || call?.type !== "CallExpression" || call.callee !== access) return false;
      if (matchingMethods.has(method)) return true;
      if (!textPreservingMethods.has(method)) return false;
      current = outermostWrapper(call);
      continue;
    }
    if (parent.type === "CallExpression") {
      const callee = unwrapExpression(parent.callee);
      return (
        parent.arguments.length === 1 &&
        parent.arguments[0] === current &&
        callee.type === "MemberExpression" &&
        propertyName(callee) === "test"
      );
    }
    if (parent.type === "BinaryExpression") {
      if (!equalityOperators.has(parent.operator)) return false;
      return isStringLiteral(parent.left === current ? parent.right : parent.left);
    }
    return parent.type === "SwitchStatement" && parent.discriminant === current;
  }
}

export const noErrorMessageMatching: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow branching on the text of an error message through string comparison, substring or regex matching, or a switch.",
    },
    messages: {
      errorMessageMatching:
        "Error message text is not a contract: it changes across dependency versions, locales, and copy edits. Branch on an error class with instanceof, a tagged error, or a stable error.code instead.",
    },
  },
  create(context) {
    if (isTestFile(context as RuleContextWithFilename)) return {};

    const report = (node: ESTree.Node): void => {
      if (isMatchedAgainst(node)) context.report({ node, messageId: "errorMessageMatching" });
    };

    return {
      MemberExpression(node) {
        if (propertyName(node) === "message" && isErrorValue(context as Context, node.object)) report(node);
      },
      CallExpression(node) {
        const callee = unwrapExpression(node.callee);
        const stringified =
          callee.type === "Identifier" && callee.name === "String" && node.arguments.length === 1
            ? node.arguments[0]
            : callee.type === "MemberExpression" && propertyName(callee) === "toString" && node.arguments.length === 0
              ? callee.object
              : undefined;
        if (stringified === undefined) return;
        const value = unwrapExpression(stringified);
        if (value.type === "Identifier" && isCaughtErrorBinding(context as Context, value)) report(node);
      },
      TemplateLiteral(node) {
        if (node.expressions.length !== 1 || node.quasis.some((quasi) => quasi.value.raw !== "")) return;
        const value = unwrapExpression(node.expressions[0] as ESTree.Node);
        if (value.type === "Identifier" && isCaughtErrorBinding(context as Context, value)) report(node);
      },
    };
  },
};
