/**
 * Forbid transition branches that can never run and unguarded `always` loops.
 *
 * @attribution eslint-plugin-xstate no-infinite-loop by Richard Laffers (concept)
 */
import {
  findProperty,
  importsFrom,
  isInsideMachineConfig,
  parentOf,
  propertyKeyName,
  stringLiteralValue,
  unwrapExpression,
} from "../ast.js";
import type { ESTree, Rule } from "@oxlint/plugins";

const unreachableMessage =
  "Transitions are tried in order and this unguarded branch always wins, so every branch after it is dead: move it last or give it a guard.";

const loopMessage =
  "An unguarded always transition that stays in the same state re-fires forever (infinite loop): add a guard or a target that leaves the state.";

type Branch = {
  readonly node: ESTree.Node;
  readonly guarded: boolean;
  readonly target: string | undefined;
};

const transitionMaps: ReadonlySet<string> = new Set(["on", "after"]);

const transitionSlots: ReadonlySet<string> = new Set(["always", "onDone", "onError"]);

const dynamicTarget = "\0dynamic";

/** Undefined when the element is not statically a transition (spread, identifier, call...). */
function branch(element: ESTree.Node | null): Branch | undefined {
  if (element === null) return undefined;
  const node = unwrapExpression(element);
  const shorthandTarget = stringLiteralValue(node);
  if (shorthandTarget !== undefined) return { node, guarded: false, target: shorthandTarget };
  if (node.type !== "ObjectExpression") return undefined;
  if (node.properties.some((property) => property.type !== "Property" || property.computed)) return undefined;
  const target = findProperty(node, "target");
  return {
    node,
    guarded: findProperty(node, "guard") !== undefined,
    target: target === undefined ? undefined : (stringLiteralValue(unwrapExpression(target.value)) ?? dynamicTarget),
  };
}

function owningStateKey(slot: ESTree.Node): string | undefined {
  const stateConfig = parentOf(slot);
  const stateProperty = stateConfig === undefined ? undefined : parentOf(stateConfig);
  if (stateProperty?.type !== "Property") return undefined;
  const states = parentOf(stateProperty);
  const statesProperty = states === undefined ? undefined : parentOf(states);
  if (statesProperty?.type !== "Property" || propertyKeyName(statesProperty) !== "states") return undefined;
  return propertyKeyName(stateProperty);
}

export const noUnreachableTransition: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid an unguarded transition placed before other branches of the same transition array, and unguarded always transitions that never leave their state.",
    },
    messages: {
      unreachableTransition: unreachableMessage,
      unguardedAlwaysLoop: loopMessage,
    },
    schema: [],
  },
  createOnce(context) {
    let enabled = false;

    function checkOrder(value: ESTree.Node): void {
      if (value.type !== "ArrayExpression") return;
      const branches = value.elements.map((element) => branch(element));
      const blocking = branches.findIndex((candidate) => candidate !== undefined && !candidate.guarded);
      if (blocking === -1 || blocking === branches.length - 1) return;
      const candidate = branches[blocking];
      if (candidate !== undefined) context.report({ node: candidate.node, messageId: "unreachableTransition" });
    }

    function checkLoop(slot: ESTree.Node, value: ESTree.Node): void {
      const elements = value.type === "ArrayExpression" ? value.elements : [value];
      const stateKey = owningStateKey(slot);
      for (const element of elements) {
        const candidate = branch(element);
        if (candidate === undefined || candidate.guarded) continue;
        const stays = candidate.target === undefined || (stateKey !== undefined && candidate.target === stateKey);
        if (stays) context.report({ node: candidate.node, messageId: "unguardedAlwaysLoop" });
      }
    }

    return {
      Program(node) {
        enabled = importsFrom(node, ["xstate"]);
      },
      Property(node) {
        if (!enabled || parentOf(node)?.type !== "ObjectExpression") return;
        const key = propertyKeyName(node);
        if (key === undefined) return;
        const value = unwrapExpression(node.value);
        if (transitionMaps.has(key)) {
          if (value.type !== "ObjectExpression" || !isInsideMachineConfig(context, node)) return;
          for (const entry of value.properties) {
            if (entry.type === "Property") checkOrder(unwrapExpression(entry.value));
          }
          return;
        }
        if (!transitionSlots.has(key) || !isInsideMachineConfig(context, node)) return;
        checkOrder(value);
        if (key === "always") checkLoop(node, value);
      },
    };
  },
};
