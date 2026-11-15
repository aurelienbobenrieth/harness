import type { Context, ESTree, Rule } from "@oxlint/plugins";
import {
  importedSpecifierName,
  isFunctionNode,
  nearestFunction,
  parentOf,
  unwrapExpression,
} from "@aurelienbbn/oxlint-kit/ast";
import { effectBodyMethod, effectCallee } from "../binding-support.js";
import { hasEffectImport } from "../effect-modules.js";
import { allowOptionDefaults, allowOptionSchema, isExemptFile } from "../test-paths.js";

const tryMessage =
  "Replace try/catch with Effect.try or Effect.tryPromise whose catch maps the failure to a tagged error: a native catch hides the failure from the error channel.";
const throwMessage =
  "Replace throw with `yield* new TaggedError(...)` or Effect.fail(new TaggedError(...)): a native throw fails outside the error channel.";

const capturingConstructors: ReadonlySet<string> = new Set(["try", "tryPromise"]);

/**
 * Whether `fn` is the callback Effect runs inside its own capture: the first argument of `Effect.try` /
 * `Effect.tryPromise`, or the `try` property of their options object. A throw or try there is the idiom, because
 * Effect turns the thrown value into the error its `catch` maps.
 */
function isCapturedCallback(context: Context, fn: ESTree.Node): boolean {
  let candidate: ESTree.Node = fn;
  let parent = parentOf(candidate);
  if (parent?.type === "Property" && parent.value === candidate && parent.parent?.type === "ObjectExpression") {
    const key = parent.key;
    const name = key.type === "Identifier" ? key.name : key.type === "Literal" ? String(key.value) : undefined;
    if (name !== "try") return false;
    candidate = parent.parent;
    parent = parentOf(candidate);
  }
  if (parent?.type !== "CallExpression" || parent.arguments[0] !== candidate) return false;
  return capturingConstructors.has(effectCallee(context, parent.callee) ?? "");
}

function insideCapturedCallback(context: Context, node: ESTree.Node): boolean {
  for (let fn = nearestFunction(node); fn !== undefined; fn = nearestFunction(fn))
    if (isCapturedCallback(context, fn)) return true;
  return false;
}

const frameworkThrowSources: readonly string[] = [
  "@tanstack/",
  "next/",
  "react-router",
  "@remix-run/",
  "@sveltejs/kit",
];

/**
 * `throw redirect(...)` / `throw notFound()`: a router framework (TanStack Router, Next.js, React Router, Remix,
 * SvelteKit) requires the throw to leave a loader or handler, so no Effect error channel can replace it.
 */
function isFrameworkThrow(context: Context, node: ESTree.ThrowStatement): boolean {
  const thrown = unwrapExpression(node.argument);
  return (
    thrown.type === "CallExpression" &&
    importedSpecifierName(context, thrown.callee, (source) =>
      frameworkThrowSources.some((prefix) => source === prefix.replace(/\/$/u, "") || source.startsWith(prefix)),
    ) !== undefined
  );
}

/** The body is an Effect generator, where `no-unsafe-effect-body` (throw) and `effecttsgo/try-catch-in-effect-gen` (try) already report. */
function directlyInEffectBody(context: Context, node: ESTree.Node): boolean {
  const fn = nearestFunction(node);
  return fn !== undefined && isFunctionNode(fn) && effectBodyMethod(context, fn) !== undefined;
}

/**
 * Keep failure in the error channel of files that use Effect: no `try`/`catch` and no `throw`, with a tagged error
 * and `Effect.fail` or `Effect.try` instead. Legal: `try`/`finally` without `catch` (cleanup, no failure handling),
 * and any `try`/`throw` inside the callback of `Effect.try` or `Effect.tryPromise`, where Effect captures the
 * thrown value. Throws and try/catch directly inside `Effect.gen`/`Effect.fn` bodies belong to
 * `no-unsafe-effect-body` and `effecttsgo/try-catch-in-effect-gen`. `throw redirect()` / `throw notFound()` from a router
 * framework (TanStack Router, Next.js, React Router, Remix, SvelteKit) stays legal: the framework requires the throw. Silent in files that do not import Effect, and
 * in test-support files unless `allow` says otherwise.
 *
 * @attribution Author's private effect-first rail (owner's own rule; re-implemented generically)
 */
export const noNativeFailure: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow try/catch and throw in files that import Effect, outside Effect.try callbacks and Effect generator bodies.",
    },
    messages: {
      noTry: tryMessage,
      noThrow: throwMessage,
    },
    schema: [allowOptionSchema],
    defaultOptions: allowOptionDefaults,
  },
  createOnce(context) {
    let fileImportsEffect = false;

    function applies(node: ESTree.Node): boolean {
      return (
        fileImportsEffect &&
        !directlyInEffectBody(context, node) &&
        !insideCapturedCallback(context, node) &&
        !isExemptFile(context)
      );
    }

    return {
      Program(node: ESTree.Program) {
        fileImportsEffect = hasEffectImport(node);
      },
      TryStatement(node) {
        if (node.handler === null || !applies(node)) return;
        context.report({ node, messageId: "noTry" });
      },
      ThrowStatement(node) {
        if (!applies(node) || isFrameworkThrow(context, node)) return;
        context.report({ node, messageId: "noThrow" });
      },
    };
  },
};
