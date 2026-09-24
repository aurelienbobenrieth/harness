import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { binding, unwrapExpressionKeepingChain } from "@aurelienbbn/oxlint-kit/ast";
import { effectMethod } from "../binding-support.js";
import { moduleMethod, propertyNamed } from "../sota-support.js";

const message =
  "Bound this retry: add Schedule.recurs(n), Schedule.upTo/during, a `times` option, or a `while`/`until` predicate so a permanently failing call cannot retry forever.";

const unboundedSchedules: ReadonlySet<string> = new Set([
  "exponential",
  "fibonacci",
  "fixed",
  "forever",
  "spaced",
  "windowed",
]);
const boundingCombinators: ReadonlySet<string> = new Set(["during", "duration", "recurs", "upTo", "while"]);
const boundingOptions: readonly string[] = ["times", "until", "while"];

type Evidence = {
  unbounded: boolean;
  bounded: boolean;
  opaque: boolean;
};

function constInitializer(context: Context, node: ESTree.Node & { readonly name: string }): ESTree.Node | undefined {
  for (const definition of binding(context, node, node.name)?.defs ?? []) {
    if (
      definition.node.type === "VariableDeclarator" &&
      definition.parent?.type === "VariableDeclaration" &&
      definition.parent.kind === "const" &&
      definition.node.init !== null
    )
      return definition.node.init;
  }
  return undefined;
}

function inspect(context: Context, input: ESTree.Node, evidence: Evidence, seen: Set<ESTree.Node>): void {
  const node = unwrapExpressionKeepingChain(input);
  if (seen.has(node)) return;
  seen.add(node);

  if (node.type === "Literal" || node.type === "TemplateLiteral") return;
  if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") return;
  if (node.type === "ArrayExpression") {
    for (const element of node.elements) {
      if (element === null || element.type === "SpreadElement") evidence.opaque = true;
      else inspect(context, element, evidence, seen);
    }
    return;
  }
  if (node.type === "CallExpression") {
    inspect(context, node.callee, evidence, seen);
    for (const argument of node.arguments) {
      if (argument.type === "SpreadElement") evidence.opaque = true;
      else inspect(context, argument, evidence, seen);
    }
    return;
  }
  if (node.type === "MemberExpression") {
    const combinator = moduleMethod(context, node, "Schedule");
    if (combinator !== undefined) {
      if (unboundedSchedules.has(combinator)) evidence.unbounded = true;
      if (boundingCombinators.has(combinator)) evidence.bounded = true;
      return;
    }
    if (!node.computed && node.property.type === "Identifier" && node.property.name === "pipe") {
      inspect(context, node.object, evidence, seen);
      return;
    }
    evidence.opaque = true;
    return;
  }
  if (node.type === "Identifier") {
    const initializer = constInitializer(context, node);
    if (initializer === undefined) evidence.opaque = true;
    else inspect(context, initializer, evidence, seen);
    return;
  }
  evidence.opaque = true;
}

function isUnboundedPolicy(context: Context, policy: ESTree.Node): boolean {
  let schedule = unwrapExpressionKeepingChain(policy);
  if (schedule.type === "Identifier")
    schedule = unwrapExpressionKeepingChain(constInitializer(context, schedule) ?? schedule);
  if (schedule.type === "ArrowFunctionExpression" || schedule.type === "FunctionExpression") return false;

  if (schedule.type === "ObjectExpression") {
    if (schedule.properties.some((property) => property.type === "SpreadElement")) return false;
    if (boundingOptions.some((name) => propertyNamed(schedule, name) !== undefined)) return false;
    const inner = propertyNamed(schedule, "schedule")?.value;
    if (inner === undefined) return false;
    schedule = inner;
  }

  const evidence: Evidence = { unbounded: false, bounded: false, opaque: false };
  inspect(context, schedule, evidence, new Set());
  return evidence.unbounded && !evidence.bounded && !evidence.opaque;
}

/**
 * Require a visible bound on `Effect.retry` policies built in the same file.
 *
 * @attribution Effect bundled ai-docs "capped exponential backoff with jitter and max attempts" pattern (concept)
 */
export const boundedRetry: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require Effect.retry policies visible in the same file to carry a bound such as Schedule.recurs, Schedule.upTo, Schedule.during, times, while, or until.",
    },
    messages: { boundedRetry: message },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (effectMethod(context, node.callee) !== "retry") return;
        const policy = node.arguments.length >= 2 ? node.arguments[1] : node.arguments[0];
        if (policy === undefined || policy.type === "SpreadElement") return;
        if (!isUnboundedPolicy(context, policy)) return;

        context.report({ node: policy, messageId: "boundedRetry" });
      },
    };
  },
};
