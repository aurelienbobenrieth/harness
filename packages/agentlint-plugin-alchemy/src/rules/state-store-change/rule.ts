/**
 * Flags a change to the `state:` option of `Alchemy.Stack`: the store is where Alchemy remembers what it deployed.
 *
 * @attribution Alchemy state store docs, https://alchemy.run/state-store (Apache-2.0 project; concept, independently implemented)
 */
import { defineRule } from "@aurelienbbn/agentlint";
import { stackDeclarations, type StackDeclaration } from "../alchemy-declarations.js";
import { changedSources, scriptExcludes, scriptGlobs } from "../source-scan.js";

const ruleId = "alchemy/state-store-change";

function display(state: string | undefined): string {
  return state ?? "(none)";
}

/** Pairs each after-side stack with its before-side declaration: same file and name first, then same file. */
function previousOf(
  stack: StackDeclaration,
  before: readonly StackDeclaration[],
  used: Set<StackDeclaration>,
): StackDeclaration | undefined {
  const candidates = before.filter((candidate) => candidate.path === stack.path && !used.has(candidate));
  return candidates.find((candidate) => candidate.name === stack.name) ?? candidates[0];
}

/**
 * Schedules human review when a stack's state store changes. A new store starts empty: Alchemy re-reads owned
 * resources, cannot prove ownership of the rest, and the old store keeps rows nothing reconciles.
 */
export const stateStoreChange = defineRule({
  lifecycle: "change",
  standard: {
    id: ruleId,
    revision: 1,
    title: "State Store Change",
    summary:
      "Flags a changed `state:` option on Alchemy.Stack so a human confirms how existing state moves to the new store.",
    guidance: {
      standard:
        "The state store holds every resource's props, outputs, instance ID and removal policy, keyed by stack, stage and logical ID; `Alchemy.Stack` requires one (`alchemy/src/Stack.ts`, `StackProps.state`). Pointing a stack at another store makes the next deploy plan against empty state: resources whose provider `read` proves ownership are re-adopted silently, others are created again or fail as `OwnedBySomeoneElse`, and the old store keeps rows that later deploys never clean up. Sources: https://alchemy.run/state-store, https://alchemy.run/cli/adopting-resources.",
      checks: [
        "Pass: the stack has never been deployed with the old store in any stage (new stack, or local-only development state).",
        "Pass: the change records how existing state reaches the new store, and an `alchemy plan` against the new store for every deployed stage shows only noops and silent adoptions.",
        "Pass: an equivalent expression of the same store (renamed variable, extracted helper) with the same backend and location.",
        "Fail: the store changes in the same change as resource edits, so a mistaken plan cannot be told apart from the store switch.",
        "Fail: CI and local deploys now point at different stores for the same stage.",
      ],
      examples: [
        {
          label: "switch stores deliberately, then deploy",
          code: "-    state: localState(),\n+    state: Cloudflare.state(),\n# run `alchemy plan` against the new store before any deploy and record the result",
        },
      ],
      refs: [
        { type: "url", href: "https://alchemy.run/state-store" },
        { type: "url", href: "https://alchemy.run/cli/adopting-resources" },
      ],
    },
  },
  binding: {
    id: ruleId,
    authority: "human",
    include: [...scriptGlobs],
    exclude: [...scriptExcludes],
  },
  detector: {
    id: ruleId,
    version: 2,
    fixtures: {
      mustReport: [
        {
          before: {
            "alchemy.run.ts":
              'export default Alchemy.Stack("App", { providers: Cloudflare.providers(), state: localState() }, program);\n',
          },
          after: {
            "alchemy.run.ts":
              'export default Alchemy.Stack("App", { providers: Cloudflare.providers(), state: Cloudflare.state() }, program);\n',
          },
        },
        {
          before: {
            "alchemy.run.ts":
              'const state = localState();\nexport default Alchemy.Stack("App", { providers, state }, program);\n',
          },
          after: {
            "alchemy.run.ts":
              'const state = Cloudflare.state();\nexport default Alchemy.Stack("App", { providers, state }, program);\n',
          },
        },
      ],
      mustStaySilent: [
        {
          before: {
            "alchemy.run.ts":
              'export default Alchemy.Stack("App", { providers: Cloudflare.providers(), state: localState() }, program);\n',
          },
          after: {
            "alchemy.run.ts":
              'export default Alchemy.Stack(\n  "App",\n  { providers: Cloudflare.providers(), state: localState() },\n  newProgram,\n);\n',
          },
        },
        {
          before: {
            "alchemy.run.ts": 'export default Alchemy.Stack("App", { providers, state: localState() }, program);\n',
          },
          after: {
            "alchemy.run.ts":
              'const store = localState();\nexport default Alchemy.Stack("App", { providers, state: store }, program);\n',
          },
        },
      ],
    },
    detect({ context }) {
      const sources = changedSources(context.change, ruleId);
      const before = sources.flatMap((source) =>
        source.before === undefined ? [] : stackDeclarations(source.path, source.before),
      );
      const used = new Set<StackDeclaration>();

      for (const source of sources) {
        if (source.after === undefined) continue;
        for (const stack of stackDeclarations(source.path, source.after)) {
          const previous = previousOf(stack, before, used);
          if (!previous) continue;
          used.add(previous);
          if (previous.state === stack.state) continue;
          context.report({
            key: `state-store:${stack.name}`,
            lineageKey: `state-store:${stack.name}`,
            file: stack.path,
            message: `Stack "${stack.name}" changes its state store (${display(previous.state)} → ${display(stack.state)}): the next deploy plans against empty state, so resources are re-adopted, created again or fail as OwnedBySomeoneElse. Migrate the state first and record how.`,
            evidence: { stack: stack.name, before: display(previous.state), after: display(stack.state) },
            excerpt: `state: ${display(stack.state)}`,
            startLine: stack.line,
            endLine: stack.line,
          });
        }
      }
    },
  },
});
