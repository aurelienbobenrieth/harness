import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";
import { isDestructuredSpawn, isEnqueueSpawn } from "../syntax.js";

// v5/v6 machines and state configs, a stored `setup(...)` (v6 also `system.setup(...)`), and `setupEffect(...)`.
const defaultMachineCalleePattern = /(?:^|\.)(?:createMachine|createStateConfig|setup)$|^setupEffect$/;
const defaultSpawnChildCallPattern = /^(?:[\w$]+\.)?spawnChild\s*[(<]/;
const assignCallPattern = /^(?:[\w$]+\.)?assign\s*[(<]/;
const spawnInAssignPattern = /\bspawn\s*[(<]/;

export type SpawnedActorReleaseOptions = {
  /** Pattern tested against the callee text of a call expression to recognise a machine definition. */
  readonly machineCalleePattern?: RegExp;
  /** Pattern matching v5 spawnChild call expressions (bare, enqueue-bound or setup-bound). */
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
    (assignCallPattern.test(call.text) && spawnInAssignPattern.test(call.text)) ||
    isEnqueueSpawn(call) ||
    isDestructuredSpawn(call);

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
      revision: 2,
      title: "Spawned Actor Release",
      summary:
        "Flags machine definitions that spawn actors so every spawn is reviewed for a matching stop and ref removal.",
      guidance: {
        standard:
          "A spawned actor is not tied to a state: exiting the state that spawned it does not stop it, and it runs until it completes, is stopped, or the parent stops. Every spawn needs a release path that stops the child and drops its ActorRef from context, otherwise dynamic lists (todos, uploads, toasts) leak running timers, subscriptions and refs for the lifetime of the parent.",
        checks: [
          "Every spawn site has a reachable stop for that actor (v5 stopChild(...) or enqueue.stopChild(...), v6 enq.stop(ref)), or the spawned logic reaches a final state by itself and the parent handles its completion (v5 an xstate.done.actor.<id> transition, v6 an 'xstate.done.actor' transition with matches: { actorId } or an enq.subscribeTo(ref, { done }) mapper).",
          "The transition that stops the actor also removes its ActorRef from context: v5 assigns the field to undefined or drops the entry; v6 returns a context patch without the ref. v6 enq.stop(ref) removes the child from snapshot.children in the same transition, so a ref left in context points at a stopped actor.",
          "Transitions that remove an item from a context list (filter, splice, delete) stop the actor they drop.",
          "A spawned actor that intentionally lives as long as its parent is acceptable when the number of such actors is bounded; state the bound in the resolution.",
          "Refs live in context only when the machine needs them there. v5: spawnChild is preferred over spawn-in-assign when the ref is not needed in context. v6: read live children from the children argument by id when no ordering or grouping is needed, which removes the ref-leak half of the problem.",
        ],
        refs: [
          { type: "url", href: "https://stately.ai/docs/spawn" },
          { type: "url", href: "https://github.com/statelyai/xstate/blob/next/docs/spawn.md" },
        ],
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
          {
            label: "v6 enq.spawn",
            file: "src/module.ts",
            source:
              "createMachine({on:{add:({context},enq)=>{const r=enq.spawn('todo');return{context:{todos:[r]}};}}});",
          },
          {
            label: "context factory spawn",
            file: "src/module.ts",
            source: "createMachine({context:({spawn,actors})=>({conn:spawn(actors.conn,{id:'conn'})})});",
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
          {
            label: "spawn method on a non-enqueue receiver",
            file: "src/module.ts",
            source: "createMachine({on:{run:({context})=>{pool.spawn('job');}}});",
          },
        ],
      },
      id: "xstate/spawned-actor-release",
      version: 2,
      scan: "file",
      createOnce({ context }) {
        return {
          call_expression(node) {
            if (!isMachineCall(node) || isChainedIntoMachineCall(node)) return;
            const calls = node.descendantsOfType("call_expression");
            if (!calls.some(spawns)) return;
            context.report({
              node,
              message:
                "Machine spawns actors: pair every spawn with a stop (v5 stopChild(), v6 enq.stop()) and remove its ref from context in the same transition.",
            });
          },
        };
      },
    },
  });
}

export const spawnedActorRelease = defineSpawnedActorRelease();
