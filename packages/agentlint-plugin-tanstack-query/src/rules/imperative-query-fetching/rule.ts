/**
 * Schedules review of queries that are fetched by command instead of by key.
 *
 * @attribution TkDodo's blog, "React Query FAQs" by Dominik Dorfmeister (concept: inputs belong in the query key, not in refetch; independently worded)
 */
import { defineRule, type AgentlintNode } from "@aurelienbbn/agentlint";
import { acceptsQueryOptions, calleeName, pairKey } from "../query-calls.js";

const effectHooks: ReadonlySet<string> = new Set(["useEffect", "useLayoutEffect"]);
const functionNodeTypes: ReadonlySet<string> = new Set(["arrow_function", "function_expression"]);
const queryOptionKeys: ReadonlySet<string> = new Set(["queryKey", "queryFn"]);
const refetchNamePattern = /^refetch(?:[A-Z]\w*)?$/;
const queryHookSourcePattern = /@tanstack\/|\buse(?:Suspense)?(?:Infinite)?Quer(?:y|ies)\s*[<(]/;
const foreignQueryClientPattern = /["']@apollo\/client["']/;
const tanstackImportPattern = /@tanstack\//;

const disabledQueryMessage =
  "Query is permanently disabled and can only run through refetch(): put its inputs in the queryKey and derive enabled (or skipToken) from them, or model the command as a mutation.";
const effectRefetchMessage =
  "refetch() is called from an effect: put the changing input in the queryKey so the query refetches declaratively, and delete the effect.";

function isQueryOptionsObject(object: AgentlintNode): boolean {
  for (const child of object.children) {
    if (child.type === "pair" && queryOptionKeys.has(pairKey(child) ?? "")) return true;
    if (child.type === "shorthand_property_identifier" && queryOptionKeys.has(child.text)) return true;
  }
  const argumentList = object.parent;
  const call = argumentList?.type === "arguments" ? argumentList.parent : null;
  return call?.type === "call_expression" && acceptsQueryOptions(calleeName(call));
}

function isEffectCallback(node: AgentlintNode): boolean {
  if (!functionNodeTypes.has(node.type)) return false;
  const argumentList = node.parent;
  if (argumentList?.type !== "arguments") return false;
  const call = argumentList.parent;
  if (call?.type !== "call_expression" || !effectHooks.has(calleeName(call) ?? "")) return false;
  const first = argumentList.children.find((child) => child.isNamed && child.type !== "comment");
  return (
    first?.startPosition.row === node.startPosition.row && first.startPosition.column === node.startPosition.column
  );
}

function runsInsideEffect(node: AgentlintNode): boolean {
  for (let current = node.parent; current; current = current.parent) {
    if (isEffectCallback(current)) return true;
  }
  return false;
}

function usesTanstackQuery(source: string): boolean {
  if (!queryHookSourcePattern.test(source)) return false;
  return tanstackImportPattern.test(source) || !foreignQueryClientPattern.test(source);
}

export const imperativeQueryFetching = defineRule({
  lifecycle: "state",
  standard: {
    id: "tanstack-query/imperative-query-fetching",
    revision: 1,
    title: "Imperative Query Fetching",
    summary:
      "Flags queries fetched by command: a literal `enabled: false` in query options, or `refetch()` called from an effect.",
    guidance: {
      standard:
        "A query is a declarative subscription: every input the queryFn reads is part of the queryKey, and changing the input is what triggers the fetch. refetch() takes no parameters, so a permanently disabled query driven by refetch() shares one cache entry across all inputs, races between them, and caches nothing per input.",
      checks: [
        "Pass: a genuine user-triggered one-shot with no varying inputs (export now, download now) may keep enabled: false with refetch(); consider useMutation when it is really a command.",
        "Pass: the inputs are in the queryKey and enabled is a derived condition or the queryFn is skipToken.",
        "Fail: the queryFn reads an input through closure (search term, id, filters) while the fetch is triggered by refetch().",
        "Fail: an effect calls refetch() when an input changes; lift the input into state or the URL, add it to the queryKey, and delete the effect.",
        "Fix direction: enabled: Boolean(input) or skipToken for not-ready inputs; one cache entry per input.",
      ],
      refs: [
        {
          type: "url",
          href: "https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries",
        },
        { type: "url", href: "https://tkdodo.eu/blog/react-query-fa-qs" },
      ],
    },
  },
  binding: {
    id: "tanstack-query/imperative-query-fetching",
    authority: "agent",
    include: ["**/*.{ts,tsx,js,jsx}"],
    exclude: ["**/*.d.ts", "**/*.{test,spec}.*"],
  },
  detector: {
    fixtures: {
      mustReport: [
        {
          label: "permanently disabled hook",
          file: "src/search.tsx",
          source: 'const q = useQuery({ queryKey: ["search"], queryFn: () => search(term), enabled: false });',
        },
        {
          label: "disabled shared options",
          file: "src/options.ts",
          source: "export const o = queryOptions({ queryKey, queryFn, enabled: false });",
        },
        {
          label: "disabled member-call options",
          file: "src/user.tsx",
          source: "const q = trpc.user.byId.useQuery(id, { enabled: false });",
        },
        {
          label: "refetch from effect",
          file: "src/search.tsx",
          source:
            'const { refetch } = useQuery({ queryKey: ["search"], queryFn });\nuseEffect(() => { void refetch(); }, [term]);',
        },
        {
          label: "member refetch from effect",
          file: "src/search.tsx",
          source: "const todos = useQuery(todosOptions);\nReact.useEffect(() => { todos.refetch(); }, [filter]);",
        },
      ],
      mustStaySilent: [
        {
          label: "derived enabled",
          file: "src/user.tsx",
          source: 'const q = useQuery({ queryKey: ["user", id], queryFn, enabled: Boolean(id) });',
        },
        {
          label: "unrelated enabled flag",
          file: "src/flags.ts",
          source: 'export const flag = { name: "beta", enabled: false };',
        },
        {
          label: "refetch from an event handler",
          file: "src/search.tsx",
          source: "const { refetch } = useQuery(todosOptions);\nconst onClick = () => { void refetch(); };",
        },
        {
          label: "refetch as a dependency only",
          file: "src/search.tsx",
          source: "const { refetch } = useQuery(todosOptions);\nuseEffect(() => { track(term); }, [term, refetch]);",
        },
        {
          label: "another client's refetch",
          file: "src/search.tsx",
          source:
            'import { useQuery } from "@apollo/client";\nconst { refetch } = useQuery(DOC);\nuseEffect(() => { void refetch(); }, [term]);',
        },
      ],
    },
    id: "tanstack-query/imperative-query-fetching",
    version: 1,
    scan: "file",
    createOnce(context) {
      return {
        pair(node) {
          if (pairKey(node) !== "enabled") return;
          if (node.childByFieldName("value")?.type !== "false") return;
          const object = node.parent;
          if (object?.type !== "object" || !isQueryOptionsObject(object)) return;

          context.report({
            node,
            message: disabledQueryMessage,
            evidence: { trigger: "enabled-false" },
          });
        },
        call_expression(node) {
          if (!refetchNamePattern.test(calleeName(node) ?? "")) return;
          if (!runsInsideEffect(node)) return;
          if (!usesTanstackQuery(context.source)) return;

          context.report({
            node,
            message: effectRefetchMessage,
            evidence: { trigger: "effect-refetch" },
          });
        },
      };
    },
  },
});
