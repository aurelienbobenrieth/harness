import { type AgentlintNode, defineRule, type StateRule } from "@aurelienbbn/agentlint";

/** Modules whose `mapError` and `catch` act on a failure channel. */
const failureModules = new Set(["Channel", "Effect", "Layer", "Micro", "Sink", "STM", "Stream"]);
const mappers = new Set(["mapError", "orElseFail"]);
const catchers = new Set(["catch", "catchAll"]);
const thunkRunners = new Set(["try", "tryPromise"]);
/** Steps that see the failure before it is replaced: whoever wrote one has kept it somewhere. */
const observers = new Set(["onError", "tapCause", "tapError", "tapErrorCause", "tapErrorTag"]);
/** Steps that cannot fail, so the origin of the pipe is still the origin of the failure. */
const pureSteps = new Set(["as", "asVoid", "map"]);
/** Effects whose failure says only that a value was absent. */
const absenceOrigins = new Set(["fromNullable", "fromNullishOr", "fromOption"]);

const importPattern = /import\s+(?:type\s+)?(?:\*\s+as\s+(\w+)|\{([^}]*)\})\s+from\s+["']([^"']+)["']/gu;
const decodePattern = /^decode/iu;
const functionTypes = new Set(["arrow_function", "function_expression", "generator_function"]);

const moduleOf = (specifier: string): string | undefined => {
  if (specifier === "effect") return "effect";
  if (specifier.startsWith("effect/")) return specifier.slice("effect/".length);
  return specifier.startsWith("@effect/") ? "@effect" : undefined;
};

/** Local names bound to an Effect module with a failure channel, and every name the file imports from Effect. */
const effectNamesOf = (source: string): { readonly failure: Set<string>; readonly all: Set<string> } => {
  const failure = new Set<string>();
  const all = new Set<string>();
  for (const [, namespace, named, specifier] of source.matchAll(importPattern)) {
    const module = specifier === undefined ? undefined : moduleOf(specifier);
    if (module === undefined) continue;
    if (namespace !== undefined) {
      all.add(namespace);
      if (failureModules.has(module)) failure.add(namespace);
    }
    for (const entry of (named ?? "").split(",")) {
      const [imported, local] = entry
        .replace(/^\s*type\s+/u, "")
        .split(/\s+as\s+/u)
        .map((part) => part.trim());
      if (!imported) continue;
      all.add(local ?? imported);
      if (module === "effect" && failureModules.has(imported)) failure.add(local ?? imported);
    }
  }
  return { all, failure };
};

const named = (node: AgentlintNode | null | undefined): readonly AgentlintNode[] =>
  (node?.children ?? []).filter((child) => child.isNamed && child.type !== "comment");

/** `Effect.mapError` read as its module and member; undefined for anything else. */
const memberOf = (callee: AgentlintNode | null): { readonly module: string; readonly name: string } | undefined => {
  if (callee?.type !== "member_expression") return undefined;
  const object = callee.childByFieldName("object");
  const property = callee.childByFieldName("property");
  if (object?.type !== "identifier" || !property) return undefined;
  return { module: object.text, name: property.text };
};

const isFunction = (node: AgentlintNode | undefined): node is AgentlintNode =>
  node !== undefined && functionTypes.has(node.type);

const identifiersIn = (node: AgentlintNode, types: readonly string[]): readonly string[] => [
  ...(types.includes(node.type) ? [node.text] : []),
  ...types.flatMap((type) => node.descendantsOfType(type).map((found) => found.text)),
];

/** Whether a handler never reads what it was given: no parameter, or one its body does not name. */
const ignoresFailure = (handler: AgentlintNode): boolean => {
  const parameters = handler.childByFieldName("parameter") ?? handler.childByFieldName("parameters");
  const body = handler.childByFieldName("body");
  if (!parameters || !body) return parameters === null;
  const bound = new Set(identifiersIn(parameters, ["identifier", "shorthand_property_identifier_pattern"]));
  if (bound.size === 0) return true;
  return !identifiersIn(body, ["identifier", "shorthand_property_identifier"]).some((name) => bound.has(name));
};

/** What a handler answers with: its expression body, or every `return` of its block. */
const answersOf = (handler: AgentlintNode): readonly AgentlintNode[] => {
  const body = handler.childByFieldName("body");
  if (!body) return [];
  if (body.type !== "statement_block") return [body];
  return body.descendantsOfType("return_statement").flatMap((statement) => named(statement).slice(0, 1));
};

/** A handler that fails again rather than recovering: `new X()`, `X.make()`, `Effect.fail(…)`. */
const answersWithFailure = (handler: AgentlintNode, effectNames: ReadonlySet<string>): boolean =>
  answersOf(handler).some((answer) => {
    if (answer.type === "new_expression") return true;
    if (answer.type !== "call_expression") return false;
    const member = memberOf(answer.childByFieldName("function"));
    if (!member) return false;
    if (member.name === "make") return !effectNames.has(member.module);
    return effectNames.has(member.module) && (member.name === "fail" || member.name === "failSync");
  });

interface Lineage {
  /** The expression the failure comes from, when the call sits in a pipe that starts from one. */
  readonly origin: AgentlintNode | undefined;
  /** Pipe steps between the origin and the call. */
  readonly steps: readonly AgentlintNode[];
}

const pipedInto = (pipe: AgentlintNode, inner: Lineage, before: readonly AgentlintNode[]): Lineage => {
  const callee = pipe.childByFieldName("function");
  if (callee?.type === "identifier" && callee.text === "pipe") {
    const [origin, ...steps] = before;
    return { origin, steps: [...steps, ...inner.steps] };
  }
  if (callee?.type === "member_expression" && callee.childByFieldName("property")?.text === "pipe") {
    const receiver = callee.childByFieldName("object");
    const outer = receiver ? lineageOfValue(receiver) : { origin: undefined, steps: [] };
    return { origin: outer.origin, steps: [...outer.steps, ...before, ...inner.steps] };
  }
  return { origin: undefined, steps: before };
};

/** A value that may itself be `x.pipe(step)`: its origin is `x`. */
function lineageOfValue(value: AgentlintNode): Lineage {
  if (value.type === "call_expression" && value.childByFieldName("function")?.type === "member_expression") {
    const callee = value.childByFieldName("function");
    if (callee?.childByFieldName("property")?.text === "pipe") {
      return pipedInto(value, { origin: undefined, steps: [] }, named(value.childByFieldName("arguments")));
    }
  }
  return { origin: value, steps: [] };
}

const lineageOf = (call: AgentlintNode, handler: AgentlintNode): Lineage => {
  const own = named(call.childByFieldName("arguments"));
  if (own.length > 1 && own[0] !== undefined && own[0].text !== handler.text) return lineageOfValue(own[0]);
  const holder = call.parent;
  if (holder?.type !== "arguments" || holder.parent === null) return { origin: undefined, steps: [] };
  const siblings = named(holder);
  const position = siblings.findIndex((node) => node.text === call.text);
  return pipedInto(holder.parent, { origin: undefined, steps: [] }, siblings.slice(0, Math.max(position, 0)));
};

const stepName = (step: AgentlintNode): string | undefined => {
  const callee = step.type === "call_expression" ? step.childByFieldName("function") : step;
  return callee?.type === "member_expression" ? callee.childByFieldName("property")?.text : undefined;
};

/** The name a possibly curried call answers to: `Schema.decodeEffect(X)(input)` is `decodeEffect`. */
const originName = (origin: AgentlintNode): string | undefined => {
  let current: AgentlintNode | null = origin;
  while (current?.type === "call_expression") current = current.childByFieldName("function");
  if (current?.type === "identifier") return current.text;
  return current?.type === "member_expression" ? current.childByFieldName("property")?.text : undefined;
};

/** Nothing is lost: the failure was observed first, or it could only say a value was absent or input did not decode. */
const keepsNothingWorthKeeping = ({ origin, steps }: Lineage): boolean => {
  if (steps.some((step) => observers.has(stepName(step) ?? ""))) return true;
  if (!origin || !steps.every((step) => pureSteps.has(stepName(step) ?? ""))) return false;
  const name = originName(origin);
  return name !== undefined && (absenceOrigins.has(name) || decodePattern.test(name));
};

const handlerOf = (call: AgentlintNode, operator: string): AgentlintNode | undefined => {
  const args = named(call.childByFieldName("arguments"));
  if (!thunkRunners.has(operator)) return args.findLast(isFunction);
  const options = args[0];
  if (options?.type !== "object") return undefined;
  const pair = options.childrenByType("pair").find((entry) => entry.childByFieldName("key")?.text === "catch");
  const value = pair?.childByFieldName("value") ?? undefined;
  return isFunction(value) ? value : undefined;
};

const oneLine = (text: string, limit: number): string => text.replaceAll(/\s+/gu, " ").slice(0, limit);

/** Reviews conversions that replace a failure without reading it. */
export const conversionKeepsFailure: StateRule = defineRule({
  lifecycle: "state",
  standard: {
    id: "effect/conversion-keeps-failure",
    revision: 1,
    title: "A conversion keeps the failure it replaces",
    summary:
      "Flags a mapError, catch or tryPromise handler that replaces a failure without reading it, so an outage does not leave only an empty error behind.",
    guidance: {
      standard:
        "Converting a failure into another error decides what survives. A handler that ignores what it received erases the only record of why the work failed: the store outage, the provider's answer, the bug. The error a client receives may stay opaque, but the failure behind it is logged or reported first, or carried as a cause.",
      checks: [
        "Read what the converted effect can fail with, not the error it becomes.",
        "Fails when the failure says something an operator needs and nothing records it: an unavailable store, a provider answer, an unexpected state. Carry it as a cause, or log it before answering.",
        "An opaque error for a client is fine. Fails only when the failure behind it is recorded nowhere; check the edge that answers before concluding.",
        "Passes when the failure carries nothing beyond its type: a tagged not-found turned into a refusal, a domain outcome the new error states fully.",
        "Passes when dropping it is the point: it could hold a secret or personal data, or telling a caller more would leak. Name why.",
      ],
      examples: [
        {
          label: "FAIL",
          description: "A Postgres outage leaves no trace: the client gets an empty error and nothing is logged.",
          code: "store.revisionOf(merchantId).pipe(\n  Effect.mapError(() => AdminUnavailableError.make({})),\n);",
        },
        {
          label: "PASS",
          description: "The client still gets the empty error, and the failure is on record.",
          code: 'store.revisionOf(merchantId).pipe(\n  Effect.tapError((failure) => Effect.logError("admin.unavailable", failure)),\n  Effect.mapError(() => AdminUnavailableError.make({})),\n);',
        },
        {
          label: "PASS",
          description: "An absent value has nothing to keep.",
          code: 'Effect.fromOption(found).pipe(\n  Effect.mapError(() => NotInstalledError.make({ message: "the merchant is not installed" })),\n);',
        },
      ],
      refs: [{ type: "url", href: "https://effect.website/docs/error-management/error-channel-operations/" }],
    },
  },
  binding: {
    id: "effect/conversion-keeps-failure",
    authority: "agent",
    include: ["**/*.{ts,tsx,mts,cts}"],
    exclude: [
      "**/*.d.ts",
      "**/*.{test,spec}.{ts,tsx}",
      "**/{test,tests,__tests__,testing,fixtures}/**",
      "**/testing.{ts,tsx}",
    ],
  },
  detector: {
    id: "effect/conversion-keeps-failure",
    version: 1,
    scan: "file",
    fixtures: {
      mustReport: [
        {
          label: "a store failure replaced by an empty error",
          files: {
            "src/rpc.ts":
              'import { Effect } from "effect";\nexport const read = store.read().pipe(Effect.mapError(() => UnavailableError.make({})));\n',
          },
        },
        {
          label: "a thrown value dropped by tryPromise",
          files: {
            "src/client.ts":
              'import * as Effect from "effect/Effect";\nexport const load = Effect.tryPromise({ try: () => api.load(), catch: () => new LoadError() });\n',
          },
        },
      ],
      mustStaySilent: [
        {
          label: "the failure kept as a cause",
          files: {
            "src/rpc.ts":
              'import { Effect } from "effect";\nexport const read = store.read().pipe(Effect.mapError((cause) => StoreError.make({ cause })));\n',
          },
        },
        {
          label: "an absent value, which has nothing to keep",
          files: {
            "src/rpc.ts":
              'import { Effect } from "effect";\nexport const read = Effect.fromOption(found).pipe(Effect.mapError(() => NotFoundError.make({})));\n',
          },
        },
        {
          label: "input that did not decode",
          files: {
            "src/rpc.ts":
              'import { Effect, Schema } from "effect";\nexport const read = Schema.decodeEffect(Cursor)(raw).pipe(Effect.mapError(() => RefusedError.make({ reason: "invalid_cursor" })));\n',
          },
        },
        {
          label: "a failure logged before it is replaced",
          files: {
            "src/rpc.ts":
              'import { Effect } from "effect";\nexport const read = store.read().pipe(Effect.tapError(Effect.logError), Effect.mapError(() => UnavailableError.make({})));\n',
          },
        },
        {
          label: "a promise, not an Effect",
          files: {
            "src/rpc.ts":
              'import { Effect } from "effect";\nexport const read = load().catch(() => new LoadError());\n',
          },
        },
      ],
    },
    createOnce({ context }) {
      const names: { failure: ReadonlySet<string>; all: ReadonlySet<string> } = { all: new Set(), failure: new Set() };

      return {
        before(): boolean {
          if (!/\b(?:mapError|orElseFail|catch|catchAll)\b/u.test(context.source)) return false;
          const found = effectNamesOf(context.source);
          names.all = found.all;
          names.failure = found.failure;
          return found.failure.size > 0;
        },
        call_expression(node) {
          const member = memberOf(node.childByFieldName("function"));
          if (!member || !names.failure.has(member.module)) return;
          const operator = member.name;
          const isCatcher = catchers.has(operator);
          if (!mappers.has(operator) && !isCatcher && !thunkRunners.has(operator)) return;
          const handler = handlerOf(node, operator);
          if (!handler || !ignoresFailure(handler)) return;
          if (isCatcher && !answersWithFailure(handler, names.all)) return;
          const lineage = thunkRunners.has(operator) ? { origin: undefined, steps: [] } : lineageOf(node, handler);
          if (keepsNothingWorthKeeping(lineage)) return;
          const answer = oneLine(handler.childByFieldName("body")?.text ?? "", 120);
          context.report({
            evidence: { answer, operator, origin: oneLine(lineage.origin?.text ?? "", 200) },
            message: `${member.module}.${operator} replaces a failure without reading it, so ${answer} is all that survives. Carry the failure as a cause or log it first; if it holds nothing an operator needs, say why.`,
            node,
          });
        },
      };
    },
  },
});
