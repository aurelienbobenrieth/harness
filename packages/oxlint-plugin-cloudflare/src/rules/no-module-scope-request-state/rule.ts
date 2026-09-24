/**
 * Forbid per-request state at module scope in a Worker: TCP database clients
 * built at module scope, and module-scope bindings written from inside a function.
 *
 * @attribution https://developers.cloudflare.com/workers/best-practices/workers-best-practices/ (inspiration; independently implemented)
 * @attribution https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/node-postgres/ (inspiration; independently implemented)
 */
import {
  binding,
  enclosingClass,
  importedNameFrom,
  isWorkerModule,
  memberPropertyName,
  nearestFunction,
  unwrapExpression,
} from "../ast.js";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const clientMessage =
  "A database client built at module scope is reused by every request this isolate serves, and its socket fails with 'Cannot perform I/O on behalf of a different request'. Create the client inside the handler for each request; Hyperdrive already pools the connections.";

const stateMessage =
  "This writes to a module-scope binding from inside a function, so the value survives into the next request served by the same isolate and leaks across requests. Keep request data in handler locals, and create per-request clients inside the handler.";

type ClientFactory = { readonly sources: readonly string[]; readonly names: readonly string[] };

/** Driver entry points that open a TCP connection or pool. */
const clientFactories: readonly ClientFactory[] = [
  { sources: ["pg"], names: ["Client", "Pool"] },
  { sources: ["postgres"], names: ["default"] },
  { sources: ["mysql2", "mysql2/promise"], names: ["createConnection", "createPool", "createPoolCluster"] },
  {
    sources: ["drizzle-orm/node-postgres", "drizzle-orm/postgres-js", "drizzle-orm/mysql2"],
    names: ["drizzle"],
  },
];

const mutatingMethods: ReadonlySet<string> = new Set([
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "fill",
  "copyWithin",
  "set",
  "add",
  "delete",
  "clear",
]);

function isClientFactoryCall(context: Context, node: ESTree.CallExpression | ESTree.NewExpression): boolean {
  const callee = unwrapExpression(node.callee);
  return clientFactories.some((factory) => {
    const imported = importedNameFrom(context, callee, factory.sources);
    if (imported === undefined) return false;
    return factory.names.includes(imported);
  });
}

/** Root identifier of a member chain such as `state.user.name`. */
function rootIdentifier(node: ESTree.Node): ESTree.Node | undefined {
  let current = unwrapExpression(node);
  while (current.type === "MemberExpression") current = unwrapExpression(current.object);
  return current.type === "Identifier" ? current : undefined;
}

function isModuleScopeVariable(context: Context, node: ESTree.Node | undefined): boolean {
  if (node?.type !== "Identifier") return false;
  const variable = binding(context, node, node.name);
  if (variable === undefined) return false;
  if (variable.scope.type !== "module" && variable.scope.type !== "global") return false;
  return variable.defs.some((definition) => definition.type === "Variable");
}

export const noModuleScopeRequestState: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid per-request state at Worker module scope: TCP database clients (pg, postgres, mysql2, their Drizzle drivers) built at module scope, and module-scope variables assigned or mutated from inside a function.",
    },
    messages: {
      moduleScopeClient: clientMessage,
      moduleScopeState: stateMessage,
    },
    schema: [],
  },
  createOnce(context) {
    let enabled = false;

    function checkClient(node: ESTree.CallExpression | ESTree.NewExpression): void {
      if (!enabled || nearestFunction(node) !== undefined || enclosingClass(node) !== undefined) return;
      if (!isClientFactoryCall(context, node)) return;
      context.report({ node, messageId: "moduleScopeClient" });
    }

    function checkWrite(node: ESTree.Node, target: ESTree.Node): void {
      if (!enabled || nearestFunction(node) === undefined) return;
      if (!isModuleScopeVariable(context, rootIdentifier(target))) return;
      context.report({ node, messageId: "moduleScopeState" });
    }

    return {
      Program(node) {
        enabled = isWorkerModule(context, node);
      },
      NewExpression(node) {
        checkClient(node);
      },
      CallExpression(node) {
        checkClient(node);
        const callee = unwrapExpression(node.callee);
        const method = memberPropertyName(callee);
        if (method === undefined || !mutatingMethods.has(method) || callee.type !== "MemberExpression") return;
        checkWrite(node, callee.object);
      },
      AssignmentExpression(node) {
        checkWrite(node, node.left);
      },
      UpdateExpression(node) {
        checkWrite(node, node.argument);
      },
      UnaryExpression(node) {
        if (node.operator === "delete") checkWrite(node, node.argument);
      },
    };
  },
};
