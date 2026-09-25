/**
 * Flags stateful Alchemy resources left on the default `destroy` removal policy, and `retain` conditions that read
 * `Stage` through an Effect.
 *
 * @attribution Alchemy RemovalPolicy, alchemy/src/RemovalPolicy.ts 2.0.0-beta.79, and https://alchemy.run/infrastructure-as-code/resource-lifecycle (Apache-2.0 project; concept, independently implemented)
 * @attribution alchemy-run/alchemy#1738 (Effect-form retain fails inside Effect-native Workers; reported behavior, not code)
 */
import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";
import { calleeSource, statefulResources } from "../alchemy-declarations.js";
import { scriptExcludes, scriptGlobs } from "../source-scan.js";

export type RemovalPolicyReviewOptions = {
  /** Resource constructors to review, written as they follow the provider namespace. Default: R2, D1 and KV. */
  readonly resources?: readonly string[];
};

const ruleId = "alchemy/removal-policy-review";
const policyPattern = /retain|RemovalPolicy\s*\.\s*destroy/iu;
const stageConditionPattern = /retain\s*\([\s\S]*\bStage\b/u;

/** Argument text of the first enclosing `.pipe(...)` that decorates the node with a removal policy. */
function enclosingPolicy(node: AgentlintNode): string | undefined {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type !== "call_expression") continue;
    const callee = current.childByFieldName("function");
    if (callee?.type !== "member_expression" || callee.childByFieldName("property")?.text !== "pipe") continue;
    const argumentText = current.childByFieldName("arguments")?.text ?? "";
    if (policyPattern.test(argumentText)) return argumentText;
  }
  return undefined;
}

export function defineRemovalPolicyReview(options: RemovalPolicyReviewOptions = {}): StateRule {
  options = structuredClone(options);
  const resources = options.resources ?? statefulResources;
  const calleePattern = new RegExp(String.raw`(?:^|\.)(${calleeSource(resources)})$`, "u");

  return defineRule({
    lifecycle: "state",
    standard: {
      id: ruleId,
      revision: 1,
      title: "Removal Policy Review",
      summary:
        "Flags stateful Alchemy resources (R2, D1, KV) on the default destroy removal policy, and retain conditions that read Stage through an Effect.",
      guidance: {
        standard:
          'Most Alchemy resources default to the `destroy` removal policy: when the declaration is removed, renamed without `renamedFrom`, replaced, or the stack destroyed, Alchemy calls the provider\'s `delete`. D1 databases and KV namespaces go with their data; an R2 bucket is emptied first only with `forceDestroy: true`, otherwise R2 refuses to delete it while it holds objects. `RemovalPolicy.retain()` skips `delete` and forgets the resource, and applies to everything declared inside the piped effect (`alchemy/src/RemovalPolicy.ts`). Retain must be deployed before the change that removes the resource. Prefer the boolean form `RemovalPolicy.retain(stack.stage === "prod")`: the Effect form that reads `Stage` fails with `Service not found: Stage` when an Effect-native Worker yields the resource (alchemy#1738, open on 2.0.0-beta.79).',
        checks: [
          "Pass: the data is disposable or reproducible in every stage (cache, preview, fixture, derived index), or the resource is recreated from source on deploy.",
          "Pass: retention is applied elsewhere and covers this declaration: a scope-level `.pipe(RemovalPolicy.retain(...))` on the enclosing effect, or a later `.pipe` on the exported binding; cite it.",
          "Fail: the resource holds user or business data in any deployed stage and nothing retains it.",
          'Fail (Stage condition): `RemovalPolicy.retain(Effect.map(Stage, ...))` on a resource that an Effect-native Worker yields. Inside a generator use `const stack = yield* Alchemy.Stack` and `RemovalPolicy.retain(stack.stage === "prod")`; at module level derive the stage from `Alchemy.Stack`, which Workers provide.',
        ],
        examples: [
          {
            label: "retain where the data lives",
            code: 'const stack = yield* Alchemy.Stack;\nconst uploads = yield* Cloudflare.R2.Bucket("Uploads").pipe(RemovalPolicy.retain(stack.stage === "prod"));',
          },
        ],
        refs: [
          { type: "url", href: "https://alchemy.run/infrastructure-as-code/resource-lifecycle" },
          { type: "url", href: "https://github.com/alchemy-run/alchemy/issues/1738" },
        ],
      },
    },
    binding: {
      id: ruleId,
      authority: "agent",
      include: [...scriptGlobs],
      exclude: [...scriptExcludes],
      options: { resources: options.resources ? [...options.resources] : null },
    },
    detector: {
      fixtures: {
        mustReport: [
          { file: "alchemy.run.ts", source: 'const db = yield* Cloudflare.D1.Database("Orders");' },
          {
            file: "resources.ts",
            source:
              'export const Db = Cloudflare.D1.Database("Orders").pipe(Alchemy.RemovalPolicy.retain(Effect.map(Alchemy.Stage, (stage) => stage === "prod")));',
          },
        ],
        mustStaySilent: [
          {
            file: "alchemy.run.ts",
            source:
              'const b = yield* Cloudflare.R2.Bucket("Uploads").pipe(RemovalPolicy.retain(stack.stage === "prod"));',
          },
          {
            file: "alchemy.run.ts",
            source: 'const w = yield* Cloudflare.Worker("Api", { main: import.meta.url });',
          },
        ],
      },
      id: ruleId,
      version: 1,
      scan: "file",
      createOnce({ context }) {
        return {
          call_expression(node) {
            const callee = (node.childByFieldName("function")?.text ?? "").replace(/\s+/gu, "");
            const type = calleePattern.exec(callee)?.[1];
            if (type === undefined) return;
            const id = node.childByFieldName("arguments")?.children.find((child) => child.isNamed)?.text ?? "";
            const policy = enclosingPolicy(node);

            if (policy === undefined) {
              context.report({
                node,
                message: `${type}(${id}) uses the default destroy removal policy: removing, renaming or replacing it deletes the cloud object and its data. Pipe it through \`RemovalPolicy.retain(stack.stage === "prod")\` or confirm the data is disposable.`,
                evidence: { type, id, policy: "default" },
              });
            } else if (stageConditionPattern.test(policy)) {
              context.report({
                node,
                message: `${type}(${id}) retains through an Effect that reads Stage: an Effect-native Worker that yields it fails with "Service not found: Stage" (alchemy#1738). Use the boolean form \`RemovalPolicy.retain(stack.stage === "prod")\` with the stage read from \`Alchemy.Stack\`.`,
                evidence: { type, id, policy: "stage-effect" },
              });
            }
          },
        };
      },
    },
  });
}

export const removalPolicyReview = defineRemovalPolicyReview();
