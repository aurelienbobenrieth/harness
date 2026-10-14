import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";
import { callArguments, propertyKey } from "../syntax.js";

// Anchors on the createMachine call itself (bare, chained on setup(...), or
// on a stored setup result) so a chained setup(...).createMachine(...) yields
// exactly one finding instead of two.
const defaultMachineDefinitionPattern = /^createMachine\s*[(<]|\.createMachine\s*[(<]/;
const defaultInvokeMarkerPattern =
  /\binvoke\b|\bcreateInvoke\b|\bfromPromise\b|\bfromCallback\b|\bcreate(?:Async|Callback|Observable|EventObservable)Logic\b|\bfromEffect(?:Stream|EventStream)?\b|\bspawn(?:Child)?\s*[(<]/;
const defaultErrorHandlingMarkerPattern = /\bonError\b|['"]xstate\.error/;
const defaultSpawnCallPattern = /^(?:[\w$]+\.)?spawn(?:Child)?\s*[(<]/;
const defaultSpawnErrorMarkerPattern = /['"`]xstate\.error/;
const createInvokeCalleePattern = /(?:^|\.)createInvoke$/;
const createStateConfigCalleePattern = /(?:^|\.)createStateConfig$/;
const subscribeToCalleePattern = /\.subscribeTo$/;

export type MachineFailureCoverageOptions = {
  /** Pattern matching machine definition call expressions. */
  readonly machineDefinitionPattern?: RegExp;
  /** Pattern that marks the machine as invoking or spawning actors or promise/callback logic. */
  readonly invokeMarkerPattern?: RegExp;
  /** Pattern that proves error handling exists inside the definition. */
  readonly errorHandlingMarkerPattern?: RegExp;
  /** Pattern matching call expressions that spawn an actor inside the definition. */
  readonly spawnCallPattern?: RegExp;
  /** Pattern that proves the definition listens to actor error events (v5 and v6 `xstate.error.actor` transitions). */
  readonly spawnErrorMarkerPattern?: RegExp;
};

function directMember(object: AgentlintNode, key: string): AgentlintNode | undefined {
  return object.children.find(
    (child) => (child.type === "pair" || child.type === "method_definition") && propertyKey(child) === key,
  );
}

function calleeText(call: AgentlintNode): string {
  return call.type === "call_expression" ? (call.childByFieldName("function")?.text ?? "") : "";
}

/** Invoke configs held by an `invoke` value: objects, or the config object of a v6 `createInvoke({...})`. */
function invokeConfigs(value: AgentlintNode | null): ReadonlyArray<AgentlintNode> {
  const items =
    value?.type === "array"
      ? value.children.filter((child) => child.type === "object" || createInvokeCalleePattern.test(calleeText(child)))
      : value
        ? [value]
        : [];
  return items.map((item) => {
    if (!createInvokeCalleePattern.test(calleeText(item))) return item;
    return callArguments(item).find((arg) => arg.type === "object") ?? item;
  });
}

/** Root machine config, a `states` entry, or a v6 `createStateConfig(...)` argument. */
function isStateNode(object: AgentlintNode, machine: AgentlintNode): boolean {
  if (object.type !== "object") return false;
  const parent = object.parent;
  if (parent?.type === "arguments") {
    const call = parent.parent;
    return call === machine || (call ? createStateConfigCalleePattern.test(calleeText(call)) : false);
  }
  const states = parent?.type === "pair" ? parent.parent?.parent : null;
  return states?.type === "pair" && propertyKey(states) === "states";
}

function hasRealOnError(object: AgentlintNode): boolean {
  const onError = directMember(object, "onError");
  return onError !== undefined && !isEmptyHandler(onError.childByFieldName("value"));
}

/** v6: the nearest active state's onError recovers an invoked child's error, so any enclosing state node counts. */
function coveredByEnclosingState(node: AgentlintNode, machine: AgentlintNode): boolean {
  for (let ancestor = node.parent; ancestor && ancestor !== machine; ancestor = ancestor.parent) {
    if (isStateNode(ancestor, machine) && hasRealOnError(ancestor)) return true;
  }
  return false;
}

/** v6: a root-level onError stays active for the machine's whole life, so it also covers spawned children. */
function coveredByRootOnError(machine: AgentlintNode): boolean {
  const config = callArguments(machine).find((arg) => arg.type === "object");
  return config !== undefined && hasRealOnError(config);
}

/** v6: `enq.subscribeTo(ref, { error: ... })` maps a spawned child's failure to a parent event. */
function subscribesToErrors(machine: AgentlintNode): boolean {
  return machine.descendantsOfType("call_expression").some((call) => {
    if (!subscribeToCalleePattern.test(calleeText(call))) return false;
    const mappers = callArguments(call)[1];
    return mappers?.type === "object" && directMember(mappers, "error") !== undefined;
  });
}

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
      revision: 3,
      title: "Machine Failure Coverage",
      summary:
        "Flags invoked actors without a real onError transition and spawned actors without actor-error handling for failure-path review.",
      guidance: {
        standard:
          "Invoked and spawned actors model expected failure explicitly. In XState v5 an invoke handles failure with its own onError, a spawned actor is covered only by an on: { 'xstate.error.actor.<id>': ... } transition, and an error thrown inside an action bypasses onError entirely. In XState v6 the onError of the nearest active state recovers errors thrown by transition functions, effects, and invoked or spawned children; spawned children can also be handled per child with on: { 'xstate.error.actor': { matches: { actorId } } } or enq.subscribeTo(ref, { error }). Recoverable failures offer retry or navigation; successful terminal states are valid.",
        checks: [
          "Each invoke has an onError transition (or a documented reason the error cannot occur). v5: on the invoke itself. v6: on the invoke, or on an enclosing state, which is active whenever the invoke runs.",
          "onError does real work: an empty object, or a target state with no way out, does not count as handling. An empty onError on a v6 invoke also hides the error from the enclosing state's onError.",
          "Each spawned actor that can fail has error handling on the parent. v5 (spawnChild(...), spawn(...) inside assign): an 'xstate.error.actor.<id>' transition; an onError on a sibling invoke does not cover it. v6 (enq.spawn(...), spawn(...) in a context factory): an onError on a state that is active for the child's whole life (children outlive the state that spawned them), an 'xstate.error.actor' transition with matches: { actorId }, or an enq.subscribeTo(ref, { error }) mapper.",
          "Fallible work does not hide in actions. v5: an error thrown inside an action is not caught by onError and surfaces only to actor.subscribe({ error }), so fallible work lives in an invoked actor. v6: an error thrown in a transition function or an enq(...) effect goes to the nearest active state's onError; without one the actor's status becomes 'error' and it stops all of its children.",
          "Error states offer a way out: retry, reset, or navigation, not a terminal trap.",
          "Cart and checkout machines model network failure separately from validation failure so the UI can respond differently.",
          "Machines without invoked or spawned actors or side effects can accept the finding as not applicable.",
        ],
        refs: [
          { type: "url", href: "https://stately.ai/docs/invoke" },
          { type: "url", href: "https://stately.ai/docs/spawn" },
          { type: "url", href: "https://github.com/statelyai/xstate/blob/next/docs/lifecycle-and-errors.md" },
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
          {
            label: "v6 createInvoke without onError",
            file: "src/module.ts",
            source: "s.createMachine({invoke:s.createInvoke({src:async({signal})=>load(signal),onDone:'.ready'})})",
          },
          {
            label: "v6 enq.spawn with only a done mapper",
            file: "src/module.ts",
            source:
              "createMachine({entry:(_,enq)=>{const u=enq.spawn('upload',{id:'u'});enq.subscribeTo(u,{done:()=>({type:'ok'})});}})",
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
          {
            label: "v6 invoke covered by an enclosing state onError",
            file: "src/module.ts",
            source: "createMachine({states:{busy:{onError:'failed',invoke:{src:'load',onDone:'done'}}}})",
          },
          {
            label: "v6 spawn covered by a subscribeTo error mapper",
            file: "src/module.ts",
            source:
              "createMachine({entry:(_,enq)=>{enq.subscribeTo(enq.spawn('upload'),{error:(e)=>({type:'failed',e})});}})",
          },
        ],
      },
      id: "xstate/machine-failure-coverage",
      version: 3,
      scan: "file",
      createOnce({ context }) {
        return {
          call_expression(node) {
            if (!matches(machineDefinitionPattern, node.text) || !matches(invokeMarkerPattern, node.text)) return;
            const invokes = node.descendantsOfType("pair").filter((pair) => propertyKey(pair) === "invoke");
            for (const invoke of invokes) {
              for (const actor of invokeConfigs(invoke.childByFieldName("value"))) {
                const onError = directMember(actor, "onError");
                if (!onError) {
                  if (coveredByEnclosingState(invoke, node)) continue;
                  context.report({
                    node: actor,
                    message:
                      "Invoked actor has no onError (on the invoke, or in v6 on an enclosing state): verify its failure and recovery contract.",
                  });
                } else if (isEmptyHandler(onError.childByFieldName("value")))
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
            const spawnsCovered =
              spawns.length === 0 ||
              matches(spawnErrorMarkerPattern, node.text) ||
              coveredByRootOnError(node) ||
              subscribesToErrors(node);
            if (!spawnsCovered) {
              for (const spawn of spawns)
                context.report({
                  node: spawn,
                  message:
                    "Spawned actor has no error handling: v5 needs an 'xstate.error.actor.<id>' transition on the parent; v6 also accepts a root onError or an enq.subscribeTo(ref, { error }) mapper.",
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
