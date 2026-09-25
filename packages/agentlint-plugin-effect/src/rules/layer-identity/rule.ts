import { defineRule, type AgentlintNode } from "@aurelienbbn/agentlint";

const layerExpressionPattern = /^Layer\.(?!succeed\b|empty\b|fresh\b)\w+/u;
const layerMapCallPattern = /^LayerMap\./u;

function returnedExpression(fn: AgentlintNode): AgentlintNode | null {
  const body = fn.childByFieldName("body");
  if (!body) return null;
  if (body.type !== "statement_block") return body;

  for (const statement of body.children) {
    if (statement.type !== "return_statement") continue;
    return statement.children.find((child) => child.isNamed) ?? null;
  }

  return null;
}

function isLayerMapLookup(fn: AgentlintNode): boolean {
  const parent = fn.parent;
  if (!parent) return false;
  if (parent.type === "pair") return parent.childByFieldName("key")?.text === "lookup";
  if (parent.type !== "arguments") return false;

  return layerMapCallPattern.test(parent.parent?.text ?? "");
}

const message =
  "Layer factory: every call builds a new layer identity and a new resource; apply it once and reuse the result, or make the duplication explicit with `Layer.fresh` or a `LayerMap`.";

/**
 * Schedules review of functions that return a freshly built Layer.
 *
 * Layers are memoized by reference, so whether a factory is safe depends on its call sites across the repository.
 */
export const layerIdentity = defineRule({
  lifecycle: "state",
  standard: {
    id: "effect/layer-identity",
    revision: 1,
    title: "Layer Identity",
    summary:
      "Flags functions that return a newly built Layer so call sites get reviewed for duplicate resource construction.",
    guidance: {
      standard:
        "Layers are memoized by reference equality: a layer produced by calling a function must come from a single call whose result is reused. Effect 4 shares the MemoMap across `Effect.provide` calls but still keys it by layer identity, so a factory applied at two composition sites builds two pools, runs migrations twice or starts two consumers, and a factory applied inside a request handler or loop builds the resource per invocation. `Layer.fresh` and `Effect.provide(layer, { local: true })` are the explicit opt-outs. Sources: `effect/src/Layer.ts` (MemoMap, `fresh`), `effect/src/LayerMap.ts`, and the references below.",
      checks: [
        "Evidence: list every call site of the factory across the repository (search the binding name, including re-exports).",
        "Pass: the factory is applied once and the result is bound to a module-level `const` or a static class member that every composition site reuses.",
        "Pass: several applications are intentional and visible: distinct arguments per tenant or key behind a `LayerMap`, a `Layer.fresh` wrapper, or test-only construction.",
        "Pass: the factory only parameterizes a value layer with no acquisition, background fiber or mutable state, so a second instance costs nothing.",
        "Fail: the same factory call appears at two or more composition sites that end up in one runtime.",
        "Fail: the factory is applied inside a request handler, loop, `Effect.fn` body or other per-invocation path instead of at composition time.",
      ],
      examples: [
        {
          label: "apply once, reuse the binding",
          code: "const makeDbLayer = (config: DbConfig) => Layer.effect(Db, connect(config));\nexport const DbLive = makeDbLayer(productionConfig);",
        },
      ],
      refs: [
        {
          type: "url",
          href: "https://effect.website/docs/requirements-management/layer-memoization/",
        },
        {
          type: "url",
          href: "https://github.com/Effect-TS/effect-smol/blob/main/migration/layer-memoization.md",
        },
      ],
    },
  },
  binding: {
    id: "effect/layer-identity",
    authority: "agent",
    include: ["**/*.{ts,tsx}"],
    exclude: ["**/*.d.ts", "**/*.{test,spec}.{ts,tsx}", "**/test/**", "**/tests/**", "**/__tests__/**"],
  },
  detector: {
    fixtures: {
      mustReport: [
        {
          file: "src/module.ts",
          source: "const makeDbLayer = (config: DbConfig) => Layer.effect(Db, connect(config));",
        },
        {
          file: "src/module.ts",
          source: "function makeDbLayer(config: DbConfig) { return Layer.effect(Db, connect(config)); }",
        },
      ],
      mustStaySilent: [
        {
          file: "src/module.ts",
          source: "export const DbLive = Layer.effect(Db, connect(productionConfig));",
        },
        {
          file: "src/module.ts",
          source: "const tenants = LayerMap.make((tenant: string) => Layer.effect(Db, connect(tenant)));",
        },
        {
          file: "src/module.ts",
          source: "const makeConfigLayer = (config: DbConfig) => Layer.succeed(Config, config);",
        },
      ],
    },
    id: "effect/layer-identity",
    version: 1,
    scan: "file",
    createOnce({ context }) {
      function inspect(node: AgentlintNode): void {
        const returned = returnedExpression(node);
        if (!returned || !layerExpressionPattern.test(returned.text)) return;
        if (isLayerMapLookup(node)) return;

        context.report({ node, message });
      }

      return {
        arrow_function: inspect,
        function_declaration: inspect,
        function_expression: inspect,
        method_definition: inspect,
      };
    },
  },
});
