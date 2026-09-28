/**
 * Flags diffs that weaken what Alchemy keeps when a resource is deleted: a `RemovalPolicy.retain(...)` removed or
 * narrowed, a `RemovalPolicy.destroy()` added, or `forceDestroy: true` set on an existing R2 bucket.
 *
 * @attribution Alchemy RemovalPolicy, alchemy/src/RemovalPolicy.ts 2.0.0-beta.79, and https://alchemy.run/infrastructure-as-code/resource-lifecycle (Apache-2.0 project; concept, independently implemented)
 */
import { defineRule, type ChangeRule } from "@aurelienbbn/agentlint";
import { resourceDeclarations, statefulResources, type ResourceDeclaration } from "../alchemy-declarations.js";
import { changedSources, findCalls, normalizeExpression, scriptExcludes, scriptGlobs } from "../source-scan.js";

export type RemovalPolicyChangeOptions = {
  /** Resource constructors whose removal takes their own policy decoration with them. Default: R2, D1 and KV. */
  readonly resources?: readonly string[];
};

const ruleId = "alchemy/removal-policy-change";
const policyCallee = String.raw`RemovalPolicy\s*\.\s*(?:retain|destroy)`;

type Policy = { readonly text: string; readonly weakening: "retain" | "destroy" };

const unconditionalRetain = "RemovalPolicy.retain()";

/**
 * Canonical policy: `retain()` ≡ `retain(true)` ≡ `destroy(false)` and `destroy()` ≡ `destroy(true)` ≡ `retain(false)`,
 * both combinators mapping a boolean the same way (`alchemy/src/RemovalPolicy.ts`). Conditions keep their text.
 */
function policiesOf(source: string | undefined): Policy[] {
  if (source === undefined) return [];
  return findCalls(source, policyCallee).map((call) => {
    const argument = normalizeExpression(call.args.join(", "));
    const named = call.name.endsWith("retain") ? "retain" : "destroy";
    if (argument !== "" && argument !== "true" && argument !== "false")
      return { text: `RemovalPolicy.${named}(${argument})`, weakening: named };
    const retains = (named === "retain") === (argument !== "false");
    return retains
      ? { text: unconditionalRetain, weakening: "retain" }
      : { text: "RemovalPolicy.destroy()", weakening: "destroy" };
  });
}

function tally(policies: readonly Policy[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const policy of policies) result.set(policy.text, (result.get(policy.text) ?? 0) + 1);
  return result;
}

const keyOf = (declaration: ResourceDeclaration): string => `${declaration.type}\u0000${declaration.id}`;

export function defineRemovalPolicyChange(options: RemovalPolicyChangeOptions = {}): ChangeRule {
  options = structuredClone(options);
  const resources = options.resources ?? statefulResources;

  return defineRule({
    lifecycle: "change",
    standard: {
      id: ruleId,
      revision: 1,
      title: "Removal Policy Change",
      summary:
        "Flags diffs that remove or narrow RemovalPolicy.retain, add RemovalPolicy.destroy, or set forceDestroy on an existing R2 bucket, so a human confirms the data may be deleted.",
      guidance: {
        standard:
          "A removal policy decides whether Alchemy calls the provider's `delete` when a resource is orphaned, destroyed or superseded by a replacement; `retain` skips it and forgets the resource, `destroy` is the default for most types. The policy is a decoration, not a prop: the plan shows a noop, the deploy persists the new policy, and it applies to the next removal (`alchemy/src/RemovalPolicy.ts`, `alchemy/src/Apply.ts` noop commit). `forceDestroy: true` lets Alchemy empty an R2 bucket before deleting it; without it R2 refuses to delete a non-empty bucket (`alchemy/src/Cloudflare/R2/Bucket.ts`). Weakening either is a decision to let data be deleted.",
        checks: [
          "Pass: the resource holds disposable or reproducible data (cache, preview, test fixture) in every stage the new policy reaches.",
          "Pass: retention moved rather than disappeared (a scope-level `.pipe(RemovalPolicy.retain(...))`, or a shared helper) and still covers the resource; cite it.",
          'Pass: a conditional retain still covers every stage holding real data, e.g. `RemovalPolicy.retain(stack.stage === "prod")` with only `prod` holding data. Prefer the boolean form: an Effect condition that reads `Stage` fails inside Effect-native Workers (alchemy#1738).',
          "Fail: the policy is weakened in the same change that removes, renames or replaces the resource; the orphan delete then runs with the weakened policy.",
        ],
        examples: [
          {
            label: "retain where data lives",
            code: 'const stack = yield* Alchemy.Stack;\nconst db = yield* Cloudflare.D1.Database("Orders").pipe(RemovalPolicy.retain(stack.stage === "prod"));',
          },
        ],
        refs: [
          { type: "url", href: "https://alchemy.run/infrastructure-as-code/resource-lifecycle" },
          { type: "url", href: "https://github.com/alchemy-run/alchemy/issues/1248" },
          { type: "url", href: "https://github.com/alchemy-run/alchemy/issues/1738" },
        ],
      },
    },
    binding: {
      id: ruleId,
      authority: "human",
      include: [...scriptGlobs],
      exclude: [...scriptExcludes],
      options: { resources: options.resources ? [...options.resources] : null },
    },
    detector: {
      id: ruleId,
      version: 2,
      fixtures: {
        mustReport: [
          {
            before: {
              "alchemy.run.ts": 'const db = yield* Cloudflare.D1.Database("Orders").pipe(RemovalPolicy.retain());\n',
            },
            after: { "alchemy.run.ts": 'const db = yield* Cloudflare.D1.Database("Orders");\n' },
          },
          {
            before: { "alchemy.run.ts": 'const b = yield* Cloudflare.R2.Bucket("Uploads");\n' },
            after: { "alchemy.run.ts": 'const b = yield* Cloudflare.R2.Bucket("Uploads", { forceDestroy: true });\n' },
          },
        ],
        mustStaySilent: [
          {
            before: { "alchemy.run.ts": 'const db = yield* Cloudflare.D1.Database("Orders");\n' },
            after: {
              "alchemy.run.ts": 'const db = yield* Cloudflare.D1.Database("Orders").pipe(RemovalPolicy.retain());\n',
            },
          },
          {
            before: {
              "a.ts": 'export const db = Cloudflare.D1.Database("Orders").pipe(RemovalPolicy.retain());\n',
              "b.ts": "export const other = 1;\n",
            },
            after: {
              "a.ts": "export const other = 1;\n",
              "b.ts": 'export const db = Cloudflare.D1.Database("Orders").pipe(RemovalPolicy.retain());\n',
            },
          },
          {
            before: {
              "alchemy.run.ts":
                'const db = yield* Cloudflare.D1.Database("Orders").pipe(RemovalPolicy.retain(stack.stage === "prod"));\n',
            },
            after: {
              "alchemy.run.ts":
                'const db = yield* Cloudflare.D1.Database("Orders").pipe(RemovalPolicy.retain(true));\n',
            },
          },
        ],
      },
      detect({ context }) {
        const sources = changedSources(context.change, ruleId);
        const declarations = (side: "before" | "after"): ResourceDeclaration[] =>
          sources.flatMap((source) => {
            const text = source[side];
            return text === undefined ? [] : resourceDeclarations(source.path, text, resources);
          });
        const beforeDeclarations = declarations("before");
        const afterDeclarations = declarations("after");
        const afterKeys = new Set(afterDeclarations.map(keyOf));

        const beforeTotals = tally(sources.flatMap((source) => policiesOf(source.before)));
        const afterTotals = tally(sources.flatMap((source) => policiesOf(source.after)));
        const removedWithDeclaration = tally(
          beforeDeclarations
            .filter((declaration) => !afterKeys.has(keyOf(declaration)))
            .flatMap((declaration) => declaration.pipes.flatMap(policiesOf)),
        );

        for (const source of sources) {
          const beforePolicies = policiesOf(source.before);
          const afterPolicies = policiesOf(source.after);
          const before = tally(beforePolicies);
          const after = tally(afterPolicies);
          const distinct = new Map([...beforePolicies, ...afterPolicies].map((policy) => [policy.text, policy]));
          // A conditional retain replaced by an unconditional one strengthens retention.
          let strengthened = Math.max(
            0,
            (after.get(unconditionalRetain) ?? 0) - (before.get(unconditionalRetain) ?? 0),
          );
          const weakenings = [...distinct.values()].filter((policy) => {
            const local = (after.get(policy.text) ?? 0) - (before.get(policy.text) ?? 0);
            const global = (afterTotals.get(policy.text) ?? 0) - (beforeTotals.get(policy.text) ?? 0);
            if (policy.weakening === "destroy") return local > 0 && global > 0;
            if (local >= 0 || global + (removedWithDeclaration.get(policy.text) ?? 0) >= 0) return false;
            if (strengthened < -local) return true;
            strengthened += local;
            return false;
          });
          const forceDestroyed = afterDeclarations.filter(
            (declaration) =>
              declaration.path === source.path &&
              declaration.props?.get("forceDestroy") === "true" &&
              beforeDeclarations.some(
                (previous) => keyOf(previous) === keyOf(declaration) && previous.props?.get("forceDestroy") !== "true",
              ),
          );
          if (weakenings.length === 0 && forceDestroyed.length === 0) continue;

          const removedRetains = weakenings
            .filter((policy) => policy.weakening === "retain")
            .map((policy) => policy.text);
          const addedDestroys = weakenings
            .filter((policy) => policy.weakening === "destroy")
            .map((policy) => policy.text);
          const forceDestroyIds = forceDestroyed.map((declaration) => `${declaration.type}("${declaration.id}")`);
          const line =
            forceDestroyed[0]?.line ??
            context.change.files.find((file) => file.path === source.path)?.hunks[0]?.newStart ??
            1;
          const parts = [
            ...(removedRetains.length > 0 ? [`removes ${removedRetains.join(", ")}`] : []),
            ...(addedDestroys.length > 0 ? [`adds ${addedDestroys.join(", ")}`] : []),
            ...(forceDestroyIds.length > 0 ? [`sets forceDestroy on ${forceDestroyIds.join(", ")}`] : []),
          ];
          context.report({
            key: "removal-policy",
            lineageKey: `removal-policy:${source.path}`,
            file: source.path,
            message: `This change ${parts.join("; ")}: the next orphan delete, destroy or replacement deletes the cloud object and its data. Confirm the data is disposable in every affected stage, or keep the retention.`,
            evidence: {
              removedRetain: removedRetains.toSorted(),
              addedDestroy: addedDestroys.toSorted(),
              forceDestroy: forceDestroyIds.toSorted(),
            },
            startLine: Math.max(1, line),
            endLine: Math.max(1, line),
          });
        }
      },
    },
  });
}

export const removalPolicyChange = defineRemovalPolicyChange();
