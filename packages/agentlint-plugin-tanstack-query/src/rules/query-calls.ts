import type { AgentlintNode } from "@aurelienbbn/agentlint";

const calleeChainPattern = /^(?:[\w$]+\s*(?:\?\.|\.)\s*)*([\w$]+)$/;
const calleeEndPattern = /[<(]/;

/** Hooks whose pending and error states are rendered by the calling component. */
export const stateOwningQueryHooks: ReadonlySet<string> = new Set(["useQuery", "useQueries", "useInfiniteQuery"]);

/** Hooks that suspend and throw, delegating pending and error states to boundaries. */
export const suspenseQueryHooks: ReadonlySet<string> = new Set([
  "useSuspenseQuery",
  "useSuspenseQueries",
  "useSuspenseInfiniteQuery",
]);

/** Option-object factories that share the hook option shape. */
const queryOptionFactories: ReadonlySet<string> = new Set(["queryOptions", "infiniteQueryOptions"]);

function calleeSource(node: AgentlintNode): string {
  const callee = node.childByFieldName("function");
  if (callee) return callee.text;
  const end = node.text.search(calleeEndPattern);
  return end === -1 ? node.text : node.text.slice(0, end);
}

/**
 * Final segment of a call's callee when the callee is a bare identifier or a
 * plain member chain (`useQuery`, `trpc.todo.list.useQuery`). Explicit type
 * arguments are ignored. Computed, called, or parenthesized callees yield `null`.
 */
export function calleeName(node: AgentlintNode): string | null {
  return calleeChainPattern.exec(calleeSource(node).trim())?.[1] ?? null;
}

/** Whether the call is a TanStack Query hook or option factory that accepts query options. */
export function acceptsQueryOptions(name: string | null): boolean {
  if (name === null) return false;
  return stateOwningQueryHooks.has(name) || suspenseQueryHooks.has(name) || queryOptionFactories.has(name);
}

/** Key text of an object `pair`, with quotes removed from string keys. */
export function pairKey(pair: AgentlintNode): string | null {
  const key = pair.childByFieldName("key");
  if (!key) return null;
  if (key.type === "property_identifier") return key.text;
  if (key.type === "string") return key.text.slice(1, -1);
  return null;
}
