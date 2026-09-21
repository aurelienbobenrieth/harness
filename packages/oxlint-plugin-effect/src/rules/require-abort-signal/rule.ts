import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { binding, effectMethod } from "../binding-support.js";
import {
  isFunctionNode,
  optionsObject,
  propertyNamed,
  stringArrayOption,
  unwrapExpression,
  walk,
  type FunctionNode,
} from "../sota-support.js";

const defaultAbortableCalls: readonly string[] = ["fetch"];

function calleePath(node: ESTree.Node): readonly string[] | undefined {
  if (node.type === "Identifier") return [node.name];
  if (node.type !== "MemberExpression" || node.computed || node.property.type !== "Identifier") return undefined;
  const object = calleePath(node.object);
  return object === undefined ? undefined : [...object, node.property.name];
}

function isAbortableCall(context: Context, node: ESTree.CallExpression, abortable: readonly string[]): boolean {
  const path = calleePath(node.callee);
  const root = path?.[0];
  if (path === undefined || root === undefined || !abortable.includes(path.join("."))) return false;
  if (path.length > 1) return true;
  const variable = binding(context, node.callee, root);
  return variable === undefined || variable.defs.length === 0 || variable.defs.some((d) => d.type === "ImportBinding");
}

function passesSignal(node: ESTree.CallExpression): boolean {
  return node.arguments.some((argument) => {
    if (argument.type !== "ObjectExpression") return false;
    return (
      propertyNamed(argument, "signal") !== undefined ||
      argument.properties.some((property) => property.type === "SpreadElement")
    );
  });
}

function uninterruptibleCalls(
  context: Context,
  thunk: FunctionNode,
  abortable: readonly string[],
): readonly ESTree.CallExpression[] {
  const calls: ESTree.CallExpression[] = [];
  walk(thunk, (node) => {
    if (node.type === "CallExpression" && isAbortableCall(context, node, abortable) && !passesSignal(node)) {
      calls.push(node);
    }
  });
  return calls;
}

function thunkOf(node: ESTree.CallExpression): FunctionNode | undefined {
  const first = node.arguments[0];
  if (isFunctionNode(first)) return first;
  const value = propertyNamed(first, "try")?.value;
  return isFunctionNode(value) ? value : undefined;
}

/** Require promise thunks that start abortable work to forward the interruption signal Effect hands them. */
export const requireAbortSignal: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require Effect.tryPromise and Effect.promise thunks that call fetch (or configured abortable calls) to accept the AbortSignal parameter and pass it on.",
    },
    hasSuggestions: true,
    messages: {
      missingSignal:
        "Accept the `signal` parameter of the thunk and pass it to {{callee}}: without it, interrupting this Effect (timeout, race, retry) leaves the request running.",
      forwardSignal: "Accept `signal` and pass it to {{callee}}.",
    },
    schema: [
      {
        type: "object",
        properties: { abortableCalls: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ abortableCalls: [...defaultAbortableCalls] }],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const method = effectMethod(context, node.callee);
        if (method !== "tryPromise" && method !== "promise") return;
        const thunk = thunkOf(node);
        if (thunk === undefined || thunk.params.length > 0) return;

        const abortable = stringArrayOption(optionsObject(context), "abortableCalls", defaultAbortableCalls);
        const [call] = uninterruptibleCalls(context, thunk, abortable);
        if (call === undefined) return;

        const callee = context.sourceCode.getText(call.callee);
        const body = thunk.body;
        const head = body === null ? "" : context.sourceCode.text.slice(thunk.range[0], body.range[0]);
        const parameterList = head.indexOf("()");
        const options = call.arguments[1];
        const simple =
          thunk.type === "ArrowFunctionExpression" &&
          body !== null &&
          unwrapExpression(body) === call &&
          parameterList >= 0 &&
          call.arguments.length >= 1 &&
          call.arguments.length <= 2 &&
          (options === undefined || options.type === "ObjectExpression");

        context.report({
          node: call,
          messageId: "missingSignal",
          data: { callee },
          suggest: simple
            ? [
                {
                  messageId: "forwardSignal",
                  data: { callee },
                  fix: (fixer) => {
                    const start = thunk.range[0] + parameterList;
                    const lastArgument = call.arguments.at(-1);
                    return [
                      fixer.replaceTextRange([start, start + 2], "(signal)"),
                      options !== undefined && options.type === "ObjectExpression"
                        ? fixer.insertTextAfterRange(
                            [options.range[0], options.range[0] + 1],
                            options.properties.length === 0 ? " signal " : " signal,",
                          )
                        : fixer.insertTextAfter(lastArgument ?? call.callee, ", { signal }"),
                    ];
                  },
                },
              ]
            : [],
        });
      },
    };
  },
};
