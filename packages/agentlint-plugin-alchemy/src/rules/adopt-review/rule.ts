/**
 * Flags Alchemy adoption opt-ins: `AdoptPolicy.adopt(...)` in code and `--adopt` in package.json scripts. Adoption
 * takes over cloud resources that another stack, stage or owner holds.
 *
 * @attribution Alchemy AdoptPolicy, alchemy/src/AdoptPolicy.ts 2.0.0-beta.79, and https://alchemy.run/cli/adopting-resources (Apache-2.0 project; concept, independently implemented)
 */
import { defineRule, type AgentlintNode } from "@aurelienbbn/agentlint";
import { scriptExcludes, scriptGlobs } from "../source-scan.js";

const ruleId = "alchemy/adopt-review";
const qualifiedAdoptPattern = /(?:^|\.)AdoptPolicy\.adopt$/u;
const adoptImportPattern = /from\s*["']alchemy\/AdoptPolicy["']/u;
const adoptFlagPattern = /(?:^|\s)--adopt(?=[\s"'=]|$)/u;

function isScriptEntry(pair: AgentlintNode): boolean {
  const scripts = pair.parent?.parent;
  return scripts?.type === "pair" && scripts.childByFieldName("key")?.text === '"scripts"';
}

/**
 * Schedules human review of adoption. Only the operator knows whether a resource Alchemy cannot prove it owns may be
 * taken over, so the binding reserves acceptance for a human.
 */
export const adoptReview = defineRule({
  lifecycle: "state",
  standard: {
    id: ruleId,
    revision: 1,
    title: "Adopt Review",
    summary:
      "Flags AdoptPolicy.adopt(...) and `--adopt` in package.json scripts, which let Alchemy take over cloud resources it cannot prove it owns.",
    guidance: {
      standard:
        "When a resource has no state, Alchemy asks the provider's `read` whether it exists and whether this stack, stage and logical ID own it. Owned resources are adopted silently with no flag; recovering a wiped state store needs none. A resource `read` reports as not ours fails with `OwnedBySomeoneElse` unless adoption is on, and then Alchemy takes it over and reconciles its tags and config to this declaration. `--adopt` turns that on for the whole run, `adopt()` or `adopt(true)` for the piped effect. Sources: `alchemy/src/AdoptPolicy.ts`, https://alchemy.run/cli/adopting-resources.",
      checks: [
        "Pass: a one-off, documented migration of named, existing resources into this stack, scoped to the runs that need it, with the resources listed.",
        "Pass: test harness code that adopts resources it created itself in an isolated account or stage.",
        "Fail: `--adopt` in a script that routine or CI deploys run: every future ownership collision (another stage, another stack, a teammate's resource) is taken over silently instead of failing.",
        "Fail: adoption added to get past `OwnedBySomeoneElse` without identifying who owns the resource; re-tag it, pick another physical name, or remove the conflicting resource instead.",
      ],
      examples: [
        {
          label: "one-off takeover, never in a routine script",
          code: "alchemy plan --adopt --stage prod   # read the takeover list\nalchemy deploy --adopt --stage prod # once, with the list recorded in the PR",
        },
      ],
      refs: [
        { type: "url", href: "https://alchemy.run/cli/adopting-resources" },
        { type: "url", href: "https://alchemy.run/infrastructure-as-code/resource-lifecycle" },
      ],
    },
  },
  binding: {
    id: ruleId,
    authority: "human",
    include: [...scriptGlobs, "**/package.json"],
    exclude: [...scriptExcludes, "**/node_modules/**"],
  },
  detector: {
    fixtures: {
      mustReport: [
        { file: "src/deploy.ts", source: "const run = deploy(program).pipe(AdoptPolicy.adopt(true));" },
        { file: "package.json", source: '{ "scripts": { "deploy": "alchemy deploy --adopt" } }' },
      ],
      mustStaySilent: [
        { file: "src/deploy.ts", source: "const run = deploy(program).pipe(AdoptPolicy.adopt(false));" },
        {
          file: "package.json",
          source: '{ "scripts": { "deploy": "alchemy deploy --adopted-flag" }, "adopt": "--adopt" }',
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
          if (!qualifiedAdoptPattern.test(callee) && !(callee === "adopt" && adoptImportPattern.test(context.source)))
            return;
          const argument = node.childByFieldName("arguments")?.children.find((child) => child.isNamed)?.text ?? "";
          if (argument === "false") return;
          context.report({
            node,
            message:
              "Adoption lets Alchemy take over resources it cannot prove it owns and rewrite their config to this declaration. Scope it to a one-off, documented migration and name the resources, or remove it.",
            evidence: { argument },
          });
        },
        pair(node) {
          if (!context.path.endsWith("package.json") || !isScriptEntry(node)) return;
          const value = node.childByFieldName("value");
          if (value?.type !== "string" || !adoptFlagPattern.test(value.text.slice(1, -1))) return;
          context.report({
            node,
            message:
              "`--adopt` in a package script adopts every conflicting resource on each run. Keep it out of routine and CI scripts; run it once by hand with the takeover list recorded.",
            evidence: { script: node.childByFieldName("key")?.text ?? "" },
          });
        },
      };
    },
  },
});
