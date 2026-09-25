import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { enclosingFunction, memberPath, unshadowed } from "../ast-support.js";

const unavailableGlobals = new Set([
  "setTimeout",
  "setInterval",
  "fetch",
  "crypto",
  "URL",
  "URLSearchParams",
  "process",
  "Buffer",
  "require",
  "Promise",
]);
const nondeterministicCalls = new Set(["Date.now", "Math.random", "performance.now"]);
const globalOwners = new Set(["globalThis", "self", "window"]);
const nonReferenceParents = new Set([
  "ImportSpecifier",
  "ImportDefaultSpecifier",
  "ImportNamespaceSpecifier",
  "ExportSpecifier",
  "LabeledStatement",
  "BreakStatement",
  "ContinueStatement",
]);

type Identifier = Extract<ESTree.Node, { type: "Identifier" }>;

function isValueReference(node: Identifier): boolean {
  const parent = node.parent;
  if (parent === null || parent === undefined) return false;
  if (parent.type.startsWith("TS")) return parent.type === "TSAsExpression" || parent.type === "TSNonNullExpression";
  if (parent.type === "MemberExpression") return parent.object === node || parent.computed;
  if (parent.type === "Property") return parent.value === node || parent.computed;
  if (parent.type === "MethodDefinition" || parent.type === "PropertyDefinition") return parent.computed;
  return !nonReferenceParents.has(parent.type);
}

function rootedAtGlobal(context: Context, node: ESTree.Node): boolean {
  let root = node;
  while (root.type === "MemberExpression") root = root.object;
  return root.type === "Identifier" && unshadowed(context, root);
}

/**
 * @attribution https://shopify.dev/docs/apps/build/functions/programming-languages/javascript-for-functions (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/build/functions/input-output (inspiration; independently implemented)
 */
export const functionsNoUnavailableRuntimeApis: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow async code, timers, fetch, crypto, URL, process, Buffer, require, node: imports, and clock or random reads in Shopify Function source; scope it to Function directories with overrides.",
    },
    messages: {
      asyncUnavailable:
        "Shopify Functions run without an event loop: {{construct}} compiles but throws when the Function executes. Make the run target synchronous.",
      globalUnavailable:
        "`{{name}}` does not exist in the Shopify Functions runtime and fails when the Function executes. Read the data from the input query instead.",
      nodeImportUnavailable:
        "`{{module}}` cannot be imported in the Shopify Functions runtime. Remove the Node.js dependency from Function source.",
      nondeterministic:
        "`{{api}}` is clock or random access, which Shopify Functions forbid. Query `shop { localTime { ... } }` or pass the value through the input instead.",
    },
  },
  createOnce(context) {
    const reportFunction = (node: ESTree.Node): void => {
      if ("async" in node && node.async === true)
        context.report({
          node,
          messageId: "asyncUnavailable",
          data: { construct: "an async function" },
        });
    };
    return {
      FunctionDeclaration: reportFunction,
      FunctionExpression: reportFunction,
      ArrowFunctionExpression: reportFunction,
      AwaitExpression(node) {
        if (enclosingFunction(node) !== undefined) return;
        context.report({
          node,
          messageId: "asyncUnavailable",
          data: { construct: "top-level await" },
        });
      },
      ImportDeclaration(node) {
        const module = String(node.source.value);
        if (node.importKind === "type" || !module.startsWith("node:")) return;
        context.report({ node, messageId: "nodeImportUnavailable", data: { module } });
      },
      Identifier(node) {
        if (!unavailableGlobals.has(node.name) || !isValueReference(node) || !unshadowed(context, node)) return;
        context.report({ node, messageId: "globalUnavailable", data: { name: node.name } });
      },
      MemberExpression(node) {
        if (node.computed || node.property.type !== "Identifier" || node.object.type !== "Identifier") return;
        if (!globalOwners.has(node.object.name) || !unavailableGlobals.has(node.property.name)) return;
        if (!unshadowed(context, node.object)) return;
        context.report({
          node,
          messageId: "globalUnavailable",
          data: { name: node.property.name },
        });
      },
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier" &&
          callee.property.name === "then" &&
          callee.object.type === "CallExpression"
        ) {
          context.report({
            node,
            messageId: "asyncUnavailable",
            data: { construct: "a promise chain" },
          });
          return;
        }
        const path = memberPath(callee);
        if (path === undefined) return;
        const api = path.join(".");
        if (nondeterministicCalls.has(api) && rootedAtGlobal(context, node.callee)) {
          context.report({ node, messageId: "nondeterministic", data: { api: `${api}()` } });
          return;
        }
        if (api === "Date" && node.arguments.length === 0 && rootedAtGlobal(context, node.callee)) {
          context.report({ node, messageId: "nondeterministic", data: { api: "Date()" } });
        }
      },
      NewExpression(node) {
        if (node.callee.type !== "Identifier" || node.callee.name !== "Date" || node.arguments.length > 0) return;
        if (!unshadowed(context, node.callee)) return;
        context.report({ node, messageId: "nondeterministic", data: { api: "new Date()" } });
      },
    };
  },
};
