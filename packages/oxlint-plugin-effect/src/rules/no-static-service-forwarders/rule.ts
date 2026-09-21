/**
 * @attribution ai-automation by Sandro Maglione (inspiration, independently re-implemented)
 */
import type { ESTree, Rule } from "@oxlint/plugins";

const message =
  "Do not expose an Effect service method through a static forwarder. Yield the service at the usage site and call the method directly.";

type ForwarderFunction = {
  readonly params: readonly ESTree.Node[];
  readonly body: ESTree.Node | null;
};

function unwrapParentheses(node: ESTree.Node): ESTree.Node {
  let current = node;
  while (current.type === "ParenthesizedExpression") current = current.expression;
  return current;
}

function getForwarderFunction(value: ESTree.Node | null): ForwarderFunction | undefined {
  if (value === null) return undefined;

  const candidate = unwrapParentheses(value);
  if (candidate.type !== "ArrowFunctionExpression" && candidate.type !== "FunctionExpression") return undefined;

  return { params: candidate.params, body: candidate.body };
}

function getParameterNames(params: readonly ESTree.Node[]): ReadonlySet<string> {
  const names = new Set<string>();
  params.forEach((param) => {
    if (param.type !== "Identifier" || !param.typeAnnotation) return;
    const type = param.typeAnnotation.typeAnnotation;
    const projection =
      type.type === "TSTypeReference" &&
      type.typeName.type === "TSQualifiedName" &&
      type.typeName.right.name === "Service";
    const indexed =
      type.type === "TSIndexedAccessType" &&
      type.indexType.type === "TSLiteralType" &&
      type.indexType.literal.type === "Literal" &&
      type.indexType.literal.value === "Service";
    if (projection || indexed) names.add(param.name);
  });

  return names;
}

function getReturnedExpression(body: ESTree.Node | null): ESTree.Node | undefined {
  if (body === null) return undefined;
  if (body.type !== "BlockStatement") return unwrapParentheses(body);

  const statements = body.body;
  if (statements.length !== 1) return undefined;

  const [statement] = statements;
  if (statement?.type !== "ReturnStatement" || statement.argument === null) return undefined;

  return unwrapParentheses(statement.argument);
}

function isParameterMethodCall(node: ESTree.Node, parameterNames: ReadonlySet<string>): boolean {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    node.callee.object.type === "Identifier" &&
    "name" in node.callee.object &&
    parameterNames.has(node.callee.object.name)
  );
}

function isForwardedCall(node: ESTree.Node, parameterNames: ReadonlySet<string>): boolean {
  if (isParameterMethodCall(node, parameterNames)) return true;
  if (node.type !== "CallExpression") return false;

  const callArguments = node.arguments.map((argument) => unwrapParentheses(argument));
  const parameterCalls = callArguments.filter((argument) => isParameterMethodCall(argument, parameterNames));
  const otherCalls = callArguments.filter(
    (argument) => argument.type === "CallExpression" && !isParameterMethodCall(argument, parameterNames),
  );

  return parameterCalls.length === 1 && otherCalls.length === 0;
}

export const noStaticServiceForwarders: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow static class properties that only forward to an Effect service method.",
    },
    messages: {
      noStaticForwarder: message,
    },
  },
  createOnce(context) {
    return {
      PropertyDefinition(node) {
        if (!node.static) return;

        const forwarder = getForwarderFunction(node.value);
        if (forwarder === undefined) return;

        const parameterNames = getParameterNames(forwarder.params);
        if (parameterNames.size === 0) return;

        const returned = getReturnedExpression(forwarder.body);
        if (returned === undefined || !isForwardedCall(returned, parameterNames)) return;

        context.report({ node, messageId: "noStaticForwarder" });
      },
    };
  },
};
