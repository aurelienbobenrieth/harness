import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";

const retryCallPattern = /^Effect\.retry(?:OrElse)?\s*\(/u;
const defaultOutboundCallPattern =
  /^(?:Effect\.tryPromise|HttpClient\.(?:get|post|put|patch|del|head|options|execute))\s*\(/u;
const retryBoundPattern = /\b(?:times|recurs|upTo|during)\b/u;
const namedPolicyPattern = /^Effect\.retry\s*\((?:[\s\S]*,)?\s*(?!Schedule\.)[A-Za-z_$][\w$.]*\s*\)$/u;
const visiblePolicyPattern = /\b(?:timeout\w*|retry)\b/u;

const policyScopeTypes = new Set([
  "arrow_function",
  "function_expression",
  "function_declaration",
  "generator_function",
  "generator_function_declaration",
  "method_definition",
  "lexical_declaration",
  "variable_declaration",
  "expression_statement",
  "return_statement",
  "public_field_definition",
]);

export type ResiliencePolicyOptions = {
  /** Pattern matching the start of an outbound Effect call expression that needs a visible timeout. */
  readonly outboundCallPattern?: RegExp;
};

function policyScopeText(node: AgentlintNode): string {
  let current: AgentlintNode | null = node.parent;

  while (current) {
    if (policyScopeTypes.has(current.type)) return current.text;
    current = current.parent;
  }

  return node.text;
}

/**
 * Schedules review of Effect retry policies and outbound calls that show no timeout.
 *
 * The Effect-dialect sibling of `core/boundary-resilience`, whose network-call pattern never matches Effect code.
 */
export function defineResiliencePolicy(options: ResiliencePolicyOptions = {}): StateRule {
  options = structuredClone(options);
  const outboundCallPattern = options.outboundCallPattern ?? defaultOutboundCallPattern;

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "effect/resilience-policy",
      revision: 1,
      title: "Resilience Policy",
      summary:
        "Flags Effect.retry policies and outbound Effect calls that show no timeout so the bound, jitter, retryable-only predicate and idempotency get reviewed.",
      guidance: {
        standard:
          'Outbound effects at a service boundary (`Effect.tryPromise`, `HttpClient.*`, SQL clients, SDK calls) carry a deliberate policy: a timeout (`Effect.timeout`, `Effect.timeoutOption`, `Effect.timeoutOrElse`), a bounded and jittered retry restricted to retryable failures, and idempotency for any retried mutation. `Effect.retry` retries typed failures only and, given an unbounded schedule such as `Schedule.exponential` or `Schedule.spaced` alone, retries forever. Sources: `effect/ai-docs/src/06_schedule/10_schedules.ts` ("capped exponential backoff with jitter and max attempts"), the `retry` and `timeout` JSDoc in `effect/src/Effect.ts`, and `effect/src/Schedule.ts`.',
        checks: [
          "Pass: the retry is bounded by `times`, `Schedule.recurs`, `Schedule.upTo` or `Schedule.during`, at the call site or in the named shared schedule the call references (open that definition before accepting).",
          "Pass: a schedule used against a shared upstream applies `Schedule.jittered`, or the finding records why synchronized retries are harmless here.",
          "Pass: the retry excludes non-retryable failures (validation, 4xx, bad credentials) through `while`/`until` in the retry options or `Schedule.while`.",
          "Pass: a timeout applies per attempt, inside the retried effect; a timeout only outside the retry bounds the total and lets one hung attempt consume it.",
          "Pass: every retried mutation is idempotent (upsert, idempotency key, or a read-only call).",
          "Pass for an outbound call without retry: a timeout is applied in the same pipeline, by the enclosing `Effect.fn` pipeline, or by the client layer it runs on.",
          "Fail: `Effect.retry` with only `Schedule.exponential`, `Schedule.spaced`, `Schedule.fixed` or `Schedule.forever`, or no policy argument at all.",
        ],
        examples: [
          {
            label: "bounded, jittered, retryable-only, per-attempt timeout",
            code: 'request.pipe(\n  Effect.timeout("2 seconds"),\n  Effect.retry({\n    times: 3,\n    schedule: Schedule.exponential("100 millis").pipe(Schedule.jittered),\n    while: (error) => error._tag === "UpstreamUnavailable",\n  }),\n)',
          },
        ],
      },
    },
    binding: {
      id: "effect/resilience-policy",
      authority: "agent",
      include: ["**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts", "**/*.{test,spec}.{ts,tsx}", "**/test/**", "**/tests/**", "**/__tests__/**"],
      options: {
        outboundCallPattern: options.outboundCallPattern
          ? { source: options.outboundCallPattern.source, flags: options.outboundCallPattern.flags }
          : null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            file: "src/module.ts",
            source: 'const resilient = request.pipe(Effect.retry(Schedule.exponential("100 millis")));',
          },
          {
            file: "src/module.ts",
            source: "const load = (url: string) => Effect.tryPromise({ try: () => fetch(url), catch: toError });",
          },
        ],
        mustStaySilent: [
          {
            file: "src/module.ts",
            source:
              'const load = (url: string) => Effect.tryPromise({ try: () => fetch(url), catch: toError }).pipe(Effect.timeout("2 seconds"));',
          },
          {
            file: "src/module.ts",
            source: "const parsed = Effect.try(parse); const retried = retryQueue(job);",
          },
        ],
      },
      id: "effect/resilience-policy",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        return {
          call_expression(node) {
            if (retryCallPattern.test(node.text)) {
              const showsPolicy = retryBoundPattern.test(node.text) || namedPolicyPattern.test(node.text);

              context.report({
                node,
                message: showsPolicy
                  ? "Retry policy: confirm the bound, jitter, retryable-only predicate, per-attempt timeout and idempotency of the retried effect."
                  : "Retry shows no attempt or time bound; add `times`, `Schedule.recurs`, `Schedule.upTo` or `Schedule.during` and restrict it to retryable failures.",
              });
              return;
            }

            outboundCallPattern.lastIndex = 0;
            if (!outboundCallPattern.test(node.text)) return;
            if (visiblePolicyPattern.test(policyScopeText(node))) return;

            context.report({
              node,
              message:
                "Outbound effect shows no timeout; apply `Effect.timeout` in its pipeline or confirm the client enforces one.",
            });
          },
        };
      },
    },
  });
}

export const resiliencePolicy = defineResiliencePolicy();
