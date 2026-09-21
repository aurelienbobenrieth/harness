import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";

// Anchors on the createMachine call itself (bare, chained on setup(...), or
// on a stored setup result) so a chained setup(...).createMachine(...) yields
// exactly one finding instead of two.
const defaultMachineDefinitionPattern = /^createMachine\s*[(<]|\.createMachine\s*[(<]/;
const defaultInvokeMarkerPattern = /\binvoke\b|\bfromPromise\b|\bfromCallback\b|\bspawn(?:Child)?\s*[(<]/;
const defaultErrorHandlingMarkerPattern = /\bonError\b|['"]xstate\.error/;
const defaultSpawnCallPattern = /^(?:[\w$]+\.)?spawn(?:Child)?\s*[(<]/;
const defaultSpawnErrorMarkerPattern = /['"`]xstate\.error/;

export type MachineFailureCoverageOptions = {
  /** Pattern matching machine definition call expressions. */
  readonly machineDefinitionPattern?: RegExp;
  /** Pattern that marks the machine as invoking or spawning actors or promise/callback logic. */
  readonly invokeMarkerPattern?: RegExp;
  /** Pattern that proves error handling exists inside the definition. */
  readonly errorHandlingMarkerPattern?: RegExp;
  /** Pattern matching call expressions that spawn an actor inside the definition. */
  readonly spawnCallPattern?: RegExp;
  /** Pattern that proves the definition listens to actor error events; onError never covers spawned actors. */
  readonly spawnErrorMarkerPattern?: RegExp;
};

function isEmptyHandler(value: AgentlintNode | null): boolean {
  return (
    (value?.type === "object" || value?.type === "array") && value.children.every((child) => child.isNamed === false)
  );
}

/** Tests from the start so global and sticky patterns stay deterministic across nodes. */
function matches(pattern: RegExp, text: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

function serialize(pattern: RegExp | undefined): { source: string; flags: string } | null {
  return pattern ? { source: pattern.source, flags: pattern.flags } : null;
}

export function defineMachineFailureCoverage(options: MachineFailureCoverageOptions = {}): StateRule {
  options = structuredClone(options);
  const machineDefinitionPattern = options.machineDefinitionPattern ?? defaultMachineDefinitionPattern;
  const invokeMarkerPattern = options.invokeMarkerPattern ?? defaultInvokeMarkerPattern;
  const errorHandlingMarkerPattern = options.errorHandlingMarkerPattern ?? defaultErrorHandlingMarkerPattern;
  const spawnCallPattern = options.spawnCallPattern ?? defaultSpawnCallPattern;
  const spawnErrorMarkerPattern = options.spawnErrorMarkerPattern ?? defaultSpawnErrorMarkerPattern;

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "xstate/machine-failure-coverage",
      revision: 2,
      title: "Machine Failure Coverage",
      summary:
        "Flags invoked actors without a real onError transition and spawned actors without an xstate.error handler for failure-path review.",
      guidance: {
        standard:
          "Invoked and spawned actors model expected failure explicitly. An invoke handles failure with onError; a spawned actor has no onError and is covered only by an on: { 'xstate.error.actor.<id>': ... } transition. Recoverable failures offer retry or navigation; successful terminal states are valid.",
        checks: [
          "Each invoke has an onError transition (or a documented reason the error cannot occur).",
          "onError does real work: an empty object, or a target state with no way out, does not count as handling.",
          "Each spawned actor (spawnChild(...), spawn(...) inside assign) that can fail is covered by an 'xstate.error.actor.<id>' transition on the parent; an onError on a sibling invoke does not cover it.",
          "Errors thrown inside actions are not caught by onError: they surface only to actor.subscribe({ error }), so fallible work lives in an invoked actor, not in an action.",
          "Error states offer a way out: retry, reset, or navigation, not a terminal trap.",
          "Cart and checkout machines model network failure separately from validation failure so the UI can respond differently.",
          "Machines without invoked or spawned actors or side effects can accept the finding as not applicable.",
        ],
        refs: [
          { type: "url", href: "https://stately.ai/docs/invoke" },
          { type: "url", href: "https://stately.ai/docs/spawn" },
        ],
      },
    },
    binding: {
      id: "xstate/machine-failure-coverage",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx}"],
      exclude: ["**/*.d.ts"],
      options: {
        machineDefinitionPattern: serialize(options.machineDefinitionPattern),
        invokeMarkerPattern: serialize(options.invokeMarkerPattern),
        errorHandlingMarkerPattern: serialize(options.errorHandlingMarkerPattern),
        spawnCallPattern: serialize(options.spawnCallPattern),
        spawnErrorMarkerPattern: serialize(options.spawnErrorMarkerPattern),
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          { file: "src/module.ts", source: "createMachine({invoke:{src:load}})" },
          {
            label: "empty onError",
            file: "src/module.ts",
            source: 'createMachine({invoke:{src:"load",onError:{}}})',
          },
          {
            label: "uncovered spawn next to a covered invoke",
            file: "src/module.ts",
            source: 'createMachine({invoke:{src:"load",onError:"failed"},entry:spawnChild("sync",{id:"sync"})})',
          },
        ],
        mustStaySilent: [
          { file: "src/module.ts", source: 'createMachine({invoke:{src:load,onError:"error"}})' },
          {
            label: "spawn covered by an actor error transition",
            file: "src/module.ts",
            source:
              'createMachine({entry:spawnChild("sync",{id:"sync"}),on:{"xstate.error.actor.sync":{target:".failed"}}})',
          },
        ],
      },
      id: "xstate/machine-failure-coverage",
      version: 2,
      scan: "file",
      createOnce(context) {
        return {
          call_expression(node) {
            if (!matches(machineDefinitionPattern, node.text) || !matches(invokeMarkerPattern, node.text)) return;
            const invokes = node
              .descendantsOfType("pair")
              .filter((pair) => pair.childByFieldName("key")?.text === "invoke");
            for (const invoke of invokes) {
              const value = invoke.childByFieldName("value");
              const actors =
                value?.type === "array"
                  ? value.children.filter((child) => child.type === "object")
                  : value
                    ? [value]
                    : [];
              for (const actor of actors) {
                const onError = actor.children.find(
                  (child) => child.type === "pair" && child.childByFieldName("key")?.text === "onError",
                );
                if (!onError)
                  context.report({
                    node: actor,
                    message: "Invoked actor has no onError transition: verify its failure and recovery contract.",
                  });
                else if (isEmptyHandler(onError.childByFieldName("value")))
                  context.report({
                    node: onError,
                    message:
                      "Invoked actor has an empty onError: give the failure a target or actions that let the user recover.",
                  });
              }
            }
            const spawns = node
              .descendantsOfType("call_expression")
              .filter((call) => matches(spawnCallPattern, call.text));
            if (!matches(spawnErrorMarkerPattern, node.text)) {
              for (const spawn of spawns)
                context.report({
                  node: spawn,
                  message:
                    "Spawned actor has no error transition: onError does not cover it, handle 'xstate.error.actor.<id>' on the parent.",
                });
            }
            if (invokes.length > 0 || spawns.length > 0) return;
            if (matches(errorHandlingMarkerPattern, node.text)) return;
            context.report({
              node,
              message: "Machine definition: verify invoked actors handle onError and no state is a dead end.",
            });
          },
        };
      },
    },
  });
}

export const machineFailureCoverage = defineMachineFailureCoverage();
