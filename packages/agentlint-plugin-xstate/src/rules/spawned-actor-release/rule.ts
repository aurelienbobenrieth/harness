import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";

const defaultMachineCalleePattern = /(?:^|\.)(?:createMachine|createStateConfig)$|^setup$/;
const defaultSpawnChildCallPattern = /^(?:[\w$]+\.)?spawnChild\s*[(<]/;
const assignCallPattern = /^(?:[\w$]+\.)?assign\s*[(<]/;
const spawnInAssignPattern = /\bspawn\s*[(<]/;

export type SpawnedActorReleaseOptions = {
  /** Pattern tested against the callee text of a call expression to recognise a machine definition. */
  readonly machineCalleePattern?: RegExp;
  /** Pattern matching spawnChild call expressions (bare, enqueue-bound or setup-bound). */
  readonly spawnChildCallPattern?: RegExp;
};

function calleeText(call: AgentlintNode): string {
  return call.childByFieldName("function")?.text ?? "";
}

/** Tests from the start so global and sticky patterns stay deterministic across nodes. */
function matches(pattern: RegExp, text: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

export function defineSpawnedActorRelease(options: SpawnedActorReleaseOptions = {}): StateRule {
  options = structuredClone(options);
  const machineCalleePattern = options.machineCalleePattern ?? defaultMachineCalleePattern;
  const spawnChildCallPattern = options.spawnChildCallPattern ?? defaultSpawnChildCallPattern;

  const isMachineCall = (node: AgentlintNode): boolean =>
    node.type === "call_expression" && matches(machineCalleePattern, calleeText(node));
  const spawns = (call: AgentlintNode): boolean =>
    matches(spawnChildCallPattern, call.text) ||
    (assignCallPattern.test(call.text) && spawnInAssignPattern.test(call.text));

  /** A setup(...) whose result is chained into another machine call is reported through that outer call. */
  const isChainedIntoMachineCall = (node: AgentlintNode): boolean => {
    for (let ancestor: AgentlintNode | null = node.parent; ancestor; ancestor = ancestor.parent) {
      if (isMachineCall(ancestor)) return true;
    }
    return false;
  };

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "xstate/spawned-actor-release",
      revision: 1,
      title: "Spawned Actor Release",
      summary:
        "Flags machine definitions that spawn actors so every spawn is reviewed for a matching stop and ref removal.",
      guidance: {
        standard:
          "A spawned actor is not tied to a state: nothing stops it until the parent stops. Every spawn needs a release path that stops the child and drops its ActorRef from context, otherwise dynamic lists (todos, uploads, toasts) leak running timers, subscriptions and refs for the lifetime of the parent.",
        checks: [
          "Every spawn site has a reachable stopChild(...) or enqueue.stopChild(...) for that actor, or the spawned logic reaches a final state by itself and the parent handles its xstate.done.actor.<id> event.",
          "The transition that stops the actor also removes its ActorRef from context (assign the field to undefined, or drop the entry from the array or map).",
          "Transitions that remove an item from a context list (filter, splice, delete) stop the actor they drop.",
          "A spawned actor that intentionally lives as long as its parent is acceptable when the number of such actors is bounded; state the bound in the resolution.",
          "spawnChild is preferred over spawn-in-assign when the ref is not needed in context, which removes the ref-leak half of the problem.",
        ],
        refs: [{ type: "url", href: "https://stately.ai/docs/spawn" }],
      },
    },
    binding: {
      id: "xstate/spawned-actor-release",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx}"],
      exclude: ["**/*.d.ts", "**/*.{test,spec}.*"],
      options: {
        machineCalleePattern: options.machineCalleePattern
          ? {
              source: options.machineCalleePattern.source,
              flags: options.machineCalleePattern.flags,
            }
          : null,
        spawnChildCallPattern: options.spawnChildCallPattern
          ? {
              source: options.spawnChildCallPattern.source,
              flags: options.spawnChildCallPattern.flags,
            }
          : null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            label: "spawn inside assign",
            file: "src/module.ts",
            source: "createMachine({on:{ADD:{actions:assign({ref:({spawn})=>spawn(todoMachine)})}}});",
          },
          {
            label: "spawnChild",
            file: "src/module.ts",
            source: 'setup({}).createMachine({entry:spawnChild("sync",{id:"sync"})});',
          },
        ],
        mustStaySilent: [
          {
            label: "invoke only",
            file: "src/module.ts",
            source: 'createMachine({invoke:{src:"load",onError:"failed"}});',
          },
          {
            label: "process spawn outside a machine",
            file: "src/module.ts",
            source: 'const child = spawn("git", ["status"]); assign({ref:child});',
          },
        ],
      },
      id: "xstate/spawned-actor-release",
      version: 1,
      scan: "file",
      createOnce(context) {
        return {
          call_expression(node) {
            if (!isMachineCall(node) || isChainedIntoMachineCall(node)) return;
            const calls = node.descendantsOfType("call_expression");
            if (!calls.some(spawns)) return;
            context.report({
              node,
              message:
                "Machine spawns actors: pair every spawn with stopChild() and remove its ref from context in the same transition.",
            });
          },
        };
      },
    },
  });
}

export const spawnedActorRelease = defineSpawnedActorRelease();
