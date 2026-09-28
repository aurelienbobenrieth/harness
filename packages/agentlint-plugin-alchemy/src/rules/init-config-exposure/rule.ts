/**
 * Flags each `effect/Config` key yielded directly in an Alchemy runtime's init body: Alchemy binds every config value
 * loaded there onto the deployed runtime (`secret_text` on Cloudflare).
 *
 * @attribution Alchemy secrets docs, https://alchemy.run/environments/secrets, and alchemy/src/Platform.ts 2.0.0-beta.79 plan-phase config binding (Apache-2.0 project; concept, independently implemented)
 * @attribution alchemy-run/alchemy#1842 (deployer credentials bound through init config reads; reported behavior, not code)
 */
import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";
import { scriptExcludes, scriptGlobs } from "../source-scan.js";

export type InitConfigExposureOptions = {
  /** Pattern matching the callee of a runtime constructor whose last argument is its init effect. */
  readonly runtimePattern?: RegExp;
};

const ruleId = "alchemy/init-config-exposure";
const defaultRuntimePattern =
  /(?:^|\.)(?:Worker|Container|Lambda\.Function|ECS\.(?:Service|Task)|EC2\.Instance|AppRunner\.Service)$/u;
const configYieldPattern = /^yield\s*\*\s*Config\s*\.\s*(\w+)\s*\(\s*(["'`])([^"'`]+)\2/u;
const functionTypes = new Set([
  "arrow_function",
  "function_expression",
  "function_declaration",
  "generator_function",
  "generator_function_declaration",
  "method_definition",
]);

const compact = (node: AgentlintNode | null | undefined): string => (node?.text ?? "").replace(/\s+/gu, "");

function enclosingFunction(node: AgentlintNode): AgentlintNode | undefined {
  for (let current = node.parent; current; current = current.parent)
    if (functionTypes.has(current.type)) return current;
  return undefined;
}

/** The runtime constructor callee when `generator` is the body of `Effect.gen` passed last to that constructor. */
function runtimeCallee(generator: AgentlintNode): string | undefined {
  let effect = generator.parent?.parent;
  if (generator.type !== "generator_function" || effect?.type !== "call_expression") return undefined;
  if (compact(effect.childByFieldName("function")) !== "Effect.gen") return undefined;

  for (let member = effect.parent; member?.type === "member_expression"; member = effect.parent) {
    const call = member.parent;
    if (member.childByFieldName("property")?.text !== "pipe" || call?.type !== "call_expression") return undefined;
    effect = call;
  }

  const argumentList = effect.parent;
  const runtime = argumentList?.parent;
  const last = argumentList?.children.findLast((child) => child.isNamed);
  if (argumentList?.type !== "arguments" || runtime?.type !== "call_expression" || last?.text !== effect.text)
    return undefined;
  const callee = runtime.childByFieldName("function");
  return compact(callee?.type === "call_expression" ? callee.childByFieldName("function") : callee);
}

export function defineInitConfigExposure(options: InitConfigExposureOptions = {}): StateRule {
  options = structuredClone(options);
  const runtimePattern = options.runtimePattern ?? defaultRuntimePattern;

  return defineRule({
    lifecycle: "state",
    standard: {
      id: ruleId,
      revision: 1,
      title: "Init Config Exposure",
      summary:
        "Flags each effect/Config key yielded in an Alchemy runtime init body, which Alchemy uploads to the deployed runtime as a secret binding.",
      guidance: {
        standard:
          "During the plan phase Alchemy wraps a runtime's init in a ConfigProvider that binds every config key the init loads onto the runtime (`alchemy/src/Platform.ts`); on Cloudflare each one deploys as `secret_text` whatever the `Config` constructor (https://alchemy.run/environments/secrets). A key read in init is therefore shipped to the runtime with the deployer's value: intended for the runtime's own secrets, a leak for deploy-only values such as provider credentials, state-store tokens or signing keys. Reads made by libraries during init are bound the same way and are invisible here (alchemy#1842 binds the deployer's AWS keys that way).",
        checks: [
          "Pass: the runtime uses the key at request time, and the deployer's value for the stage is the value the runtime should hold.",
          "Fail: the key is a deploy-time credential (cloud provider keys, `CLOUDFLARE_API_TOKEN`, state-store tokens) or a value only the stack needs; read it in the stack body, not in the runtime's init.",
          "Fail: the key is read in init only to compute a prop or resource name; move that read out of the init effect.",
        ],
        examples: [
          {
            label: "runtime secret bound on purpose",
            code: 'Effect.gen(function* () {\n  const apiKey = yield* Config.Redacted("STRIPE_API_KEY"); // bound as secret_text\n  return { fetch: handler(apiKey) };\n})',
          },
        ],
        refs: [
          { type: "url", href: "https://alchemy.run/environments/secrets" },
          { type: "url", href: "https://github.com/alchemy-run/alchemy/issues/1842" },
        ],
      },
    },
    binding: {
      id: ruleId,
      authority: "agent",
      include: [...scriptGlobs],
      exclude: [...scriptExcludes],
      options: {
        runtimePattern: options.runtimePattern
          ? { source: options.runtimePattern.source, flags: options.runtimePattern.flags }
          : null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            file: "src/api.ts",
            source:
              'export default Cloudflare.Worker("Api", { main: import.meta.url }, Effect.gen(function* () {\n  const key = yield* Config.Redacted("API_KEY");\n  return { fetch: handler(key) };\n}));',
          },
        ],
        mustStaySilent: [
          {
            file: "src/api.ts",
            source:
              'export default Cloudflare.Worker("Api", { main: import.meta.url }, Effect.gen(function* () {\n  return { fetch: Effect.gen(function* () { const key = yield* Config.Redacted("API_KEY"); return key; }) };\n}));',
          },
          {
            file: "alchemy.run.ts",
            source:
              'const program = Effect.gen(function* () { const token = yield* Config.Redacted("CLOUDFLARE_API_TOKEN"); });',
          },
        ],
      },
      id: ruleId,
      version: 1,
      scan: "file",
      createOnce({ context }) {
        return {
          yield_expression(node) {
            const match = configYieldPattern.exec(node.text);
            if (!match) return;
            const generator = enclosingFunction(node);
            const runtime = generator ? runtimeCallee(generator) : undefined;
            runtimePattern.lastIndex = 0;
            if (runtime === undefined || !runtimePattern.test(runtime)) return;
            const key = match[3] ?? "";
            context.report({
              node,
              message: `\`${key}\` is read in the ${runtime} init: Alchemy binds it to the deployed runtime as a secret with the deployer's value. Keep it only if the runtime needs it; read deploy-only values in the stack body.`,
              evidence: { key, runtime },
            });
          },
        };
      },
    },
  });
}

export const initConfigExposure = defineInitConfigExposure();
