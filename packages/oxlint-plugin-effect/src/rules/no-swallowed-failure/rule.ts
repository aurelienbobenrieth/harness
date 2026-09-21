import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { effectMethod } from "../binding-support.js";
import {
  booleanOption,
  ignoresFirstParameter,
  isFunctionNode,
  optionsObject,
  parentOf,
  propertyNamed,
  unwrapExpression,
  type FunctionNode,
} from "../sota-support.js";

function returnedExpression(fn: FunctionNode): ESTree.Node | undefined {
  const body = fn.body;
  if (body === null) return undefined;
  if (body.type !== "BlockStatement") return unwrapExpression(body);
  const [only, ...rest] = body.body;
  if (only?.type !== "ReturnStatement" || rest.length > 0 || only.argument === null) return undefined;
  return unwrapExpression(only.argument);
}

function isPlaceholderValue(node: ESTree.Node | undefined): boolean {
  if (node === undefined) return true;
  const value = unwrapExpression(node);
  if (value.type === "Literal") return true;
  if (value.type === "Identifier") return value.name === "undefined";
  if (value.type === "UnaryExpression") return value.operator === "void";
  if (value.type === "ArrayExpression") return value.elements.length === 0;
  if (value.type === "ObjectExpression") return value.properties.length === 0;
  return false;
}

function isSilentSuccess(context: Context, node: ESTree.Node | undefined): boolean {
  if (node === undefined) return false;
  if (node.type === "MemberExpression") {
    const member = effectMethod(context, node);
    return member === "void" || member === "succeedNone";
  }
  if (node.type !== "CallExpression" || effectMethod(context, node.callee) !== "succeed") return false;
  return node.arguments.length <= 1 && isPlaceholderValue(node.arguments[0]);
}

function isInsideFinalizer(context: Context, node: ESTree.Node): boolean {
  let child: ESTree.Node = node;
  let current = parentOf(node);
  while (current !== undefined) {
    if (current.type === "CallExpression") {
      const method = effectMethod(context, current.callee);
      const index = current.arguments.indexOf(child as ESTree.Expression);
      if (method === "addFinalizer" && index >= 0) return true;
      if (method === "acquireRelease" && index >= 1) return true;
      if (method === "acquireUseRelease" && index >= 2) return true;
    }
    child = current;
    current = parentOf(current);
  }
  return false;
}

/** Disallow erasing the typed error channel without leaving a trace. */
export const noSwallowedFailure: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Effect.ignore without a log option and Effect.catch handlers that discard the error and succeed with a placeholder.",
    },
    hasSuggestions: true,
    messages: {
      ignore:
        "Make the discarded failure observable: pass { log: true } (or a severity and message) to Effect.ignore, or handle the error.",
      catch:
        "Handle, map, or log the failure: this Effect.catch handler discards every error and succeeds with a placeholder. Name the condition with catchTag/catchIf when a fallback is intended.",
      addLog: "Log the ignored failure with { log: true }.",
    },
    schema: [
      {
        type: "object",
        properties: { allowInFinalizers: { type: "boolean" } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allowInFinalizers: true }],
  },
  createOnce(context) {
    function allowedAsFinalizer(node: ESTree.Node): boolean {
      return booleanOption(optionsObject(context), "allowInFinalizers", true) && isInsideFinalizer(context, node);
    }

    return {
      MemberExpression(node) {
        if (effectMethod(context, node) !== "ignore") return;

        const parent = parentOf(node);
        const call = parent?.type === "CallExpression" && parent.callee === node ? parent : undefined;
        if (call?.arguments.some((argument) => propertyNamed(argument, "log") !== undefined) === true) return;
        if (allowedAsFinalizer(node)) return;

        const source = context.sourceCode.getText(node);
        const onlyArgument = call?.arguments.length === 1 ? call.arguments[0] : undefined;
        context.report({
          node: call ?? node,
          messageId: "ignore",
          suggest:
            call === undefined
              ? [
                  {
                    messageId: "addLog",
                    fix: (fixer) => fixer.replaceText(node, `${source}({ log: true })`),
                  },
                ]
              : onlyArgument !== undefined && onlyArgument.type !== "ObjectExpression"
                ? [
                    {
                      messageId: "addLog",
                      fix: (fixer) => fixer.insertTextAfter(onlyArgument, ", { log: true }"),
                    },
                  ]
                : [],
        });
      },
      CallExpression(node) {
        if (effectMethod(context, node.callee) !== "catch") return;
        const handler = node.arguments.at(-1);
        if (!isFunctionNode(handler) || !ignoresFirstParameter(context, handler)) return;
        if (!isSilentSuccess(context, returnedExpression(handler))) return;
        if (allowedAsFinalizer(node)) return;

        context.report({ node: handler, messageId: "catch" });
      },
    };
  },
};
