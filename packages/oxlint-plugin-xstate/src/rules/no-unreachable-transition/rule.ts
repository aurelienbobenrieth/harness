/**
 * Forbid transition branches that can never run and `always` transitions that loop forever.
 *
 * The order check covers XState v5 transition arrays (v6 types reject arrays and
 * `guard`). The loop check covers an unconditional, targetless `always` that
 * changes something on every pass: v5 `actions`, a v6 static `{ context }`, or a
 * v6 function that returns a `{ context }` patch without a target on every path.
 * A targetless `always` with no effect, and one targeting its own state, settle
 * after one pass and are left alone.
 *
 * @attribution eslint-plugin-xstate no-infinite-loop by Richard Laffers (concept)
 */
import {
  isFunctionNode,
  parentOf,
  propertyKeyName,
  stringLiteralValue,
  unwrapExpressionKeepingChain,
  walk,
} from "@aurelienbbn/oxlint-kit/ast";
import { findProperty, importsFrom, isInsideMachineConfig } from "../ast.js";
import type { ESTree, Rule } from "@oxlint/plugins";

const unreachableMessage =
  "Transitions are tried in order and this unguarded branch always wins, so every branch after it is dead: move it last or give it a guard.";

const loopMessage =
  "This always transition has no target and no condition, so its actions or context update re-run after every microstep (infinite loop): guard it in XState v5, return undefined once nothing changes in XState v6, or give it a target.";

type Branch = {
  readonly node: ESTree.Node;
  readonly conditional: boolean;
  readonly targeted: boolean;
  readonly effectful: boolean;
};

const transitionMaps: ReadonlySet<string> = new Set(["on", "after"]);

const transitionSlots: ReadonlySet<string> = new Set(["always", "onDone", "onError"]);

/** Keys that make a branch conditional: a v5 guard, a v6 payload match, or a v6 `to` function. */
const conditionKeys: readonly string[] = ["guard", "matches", "to"];

const effectKeys: readonly string[] = ["actions", "context"];

function isStaticObject(node: ESTree.Node): node is ESTree.ObjectExpression {
  return (
    node.type === "ObjectExpression" &&
    node.properties.every((property) => property.type === "Property" && !property.computed)
  );
}

/** Undefined when the element is not statically a transition (spread, identifier, call...). */
function branch(element: ESTree.Node | null): Branch | undefined {
  if (element === null) return undefined;
  const node = unwrapExpressionKeepingChain(element);
  if (stringLiteralValue(node) !== undefined) return { node, conditional: false, targeted: true, effectful: false };
  if (!isStaticObject(node)) return undefined;
  return {
    node,
    conditional: conditionKeys.some((key) => findProperty(node, key) !== undefined),
    targeted: findProperty(node, "target") !== undefined,
    effectful: effectKeys.some((key) => findProperty(node, key) !== undefined),
  };
}

/** Every `return` argument of a function body, ignoring nested functions; `null` for a bare `return`. */
function returnArguments(body: ESTree.Node): (ESTree.Node | null)[] {
  const found: (ESTree.Node | null)[] = [];
  walk(body, (child) => {
    if (isFunctionNode(child)) return false;
    if (child.type === "ReturnStatement") found.push(child.argument);
    return undefined;
  });
  return found;
}

/**
 * True for an XState v6 `always` function that returns a targetless `{ context }`
 * patch on every path: a concise object body, or a block whose last statement
 * returns such a patch and whose every other `return` does too.
 */
function alwaysPatchesContext(fn: ESTree.Node): boolean {
  if (!isFunctionNode(fn) || fn.body === null) return false;
  let results: (ESTree.Node | null)[];
  if (fn.body.type === "BlockStatement") {
    if (fn.body.body.at(-1)?.type !== "ReturnStatement") return false;
    results = returnArguments(fn.body);
  } else {
    results = [fn.body];
  }
  return results.every((result) => {
    if (result === null) return false;
    const patch = unwrapExpressionKeepingChain(result);
    return (
      isStaticObject(patch) &&
      findProperty(patch, "target") === undefined &&
      findProperty(patch, "context") !== undefined
    );
  });
}

export const noUnreachableTransition: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid an unguarded transition placed before other branches of the same transition array (XState v5), and targetless always transitions that re-run their actions or context update forever.",
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
      const blocking = branches.findIndex((candidate) => candidate !== undefined && !candidate.conditional);
      if (blocking === -1 || blocking === branches.length - 1) return;
      const candidate = branches[blocking];
      if (candidate !== undefined) context.report({ node: candidate.node, messageId: "unreachableTransition" });
    }

    function checkLoop(value: ESTree.Node): void {
      if (alwaysPatchesContext(value)) {
        context.report({ node: value, messageId: "unguardedAlwaysLoop" });
        return;
      }
      const elements = value.type === "ArrayExpression" ? value.elements : [value];
      for (const element of elements) {
        const candidate = branch(element);
        if (candidate === undefined || candidate.conditional || candidate.targeted || !candidate.effectful) continue;
        context.report({ node: candidate.node, messageId: "unguardedAlwaysLoop" });
      }
    }

    return {
      Program(node) {
        enabled = importsFrom(node, ["xstate", "@xstate/effect"]);
      },
      Property(node) {
        if (!enabled || parentOf(node)?.type !== "ObjectExpression") return;
        const key = propertyKeyName(node);
        if (key === undefined) return;
        const value = unwrapExpressionKeepingChain(node.value);
        if (transitionMaps.has(key)) {
          if (value.type !== "ObjectExpression" || !isInsideMachineConfig(context, node)) return;
          for (const entry of value.properties) {
            if (entry.type === "Property") checkOrder(unwrapExpressionKeepingChain(entry.value));
          }
          return;
        }
        if (!transitionSlots.has(key) || !isInsideMachineConfig(context, node)) return;
        checkOrder(value);
        if (key === "always") checkLoop(value);
      },
    };
  },
};
