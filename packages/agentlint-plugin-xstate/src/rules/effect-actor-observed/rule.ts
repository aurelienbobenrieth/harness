import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";

const defaultEffectActorCalleePattern = /(?:^|\.)createEffectActor$/;
const defaultObserverNames = ["join", "waitFor", "snapshots"] as const;

export type EffectActorObservedOptions = {
  /** Pattern tested against the callee text of a call expression to recognise an `@xstate/effect` actor creation. */
  readonly effectActorCalleePattern?: RegExp;
  /** Functions that read an actor's outcome when given the actor as first argument (default: join, waitFor, snapshots). */
  readonly observerNames?: ReadonlyArray<string>;
};

/** Tests from the start so global and sticky patterns stay deterministic across nodes. */
function matches(pattern: RegExp, text: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Identifier the created actor is bound to, through `yield*`, `await` and parentheses. */
function boundName(call: AgentlintNode): string | undefined {
  let value: AgentlintNode = call;
  while (
    value.parent &&
    ["yield_expression", "await_expression", "parenthesized_expression"].includes(value.parent.type)
  ) {
    value = value.parent;
  }
  const declarator = value.parent;
  if (declarator?.type !== "variable_declarator") return undefined;
  const name = declarator.childByFieldName("name");
  return name?.type === "identifier" ? name.text : undefined;
}

export function defineEffectActorObserved(options: EffectActorObservedOptions = {}): StateRule {
  options = structuredClone(options);
  const effectActorCalleePattern = options.effectActorCalleePattern ?? defaultEffectActorCalleePattern;
  const observerNames = [...(options.observerNames ?? defaultObserverNames)];
  const observers = observerNames.map(escapeRegExp).join("|");

  /** Whether `source` reads the outcome of the actor bound to `name`, or hands the actor to its caller. */
  const observed = (source: string, name: string): boolean => {
    const actor = escapeRegExp(name);
    return [
      new RegExp(`\\b(?:${observers})\\s*\\(\\s*${actor}(?![\\w$])`),
      new RegExp(`\\bpipe\\s*\\(\\s*${actor}\\s*,\\s*(?:${observers})\\b`),
      new RegExp(`(?<![\\w$.])${actor}\\s*\\.\\s*subscribe\\s*\\(`),
      new RegExp(`\\breturn\\s+${actor}\\s*(?:[;}]|$)`, "m"),
    ].some((pattern) => pattern.test(source));
  };

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "xstate/effect-actor-observed",
      revision: 1,
      title: "Effect Actor Observed",
      summary:
        "Flags @xstate/effect actors bound by createEffectActor(...) whose outcome the file never reads with join, waitFor, snapshots or subscribe.",
      guidance: {
        standard:
          "A root actor created with createEffectActor(...) reports failure as a value, not by failing the Effect that created it: an errored actor nobody observes is silent, like a failed forked fiber. Whoever owns the actor reads its outcome: join(actor) succeeds with the output or fails with the actor's error, waitFor(actor, predicate) fails with ActorStoppedError when the actor stops or errors first, snapshots(actor) emits the error snapshot before it ends, and actor.subscribe({ error }) receives it.",
        checks: [
          "The program that owns the actor reads its outcome with join, waitFor, snapshots, subscribe with an error observer, or the result atom of createActorAtoms; send(actor, event) alone observes nothing, and emitted(actor) just ends when the actor errors.",
          "Expected domain outcomes (declined, expired) are final states with output, read through join; unexpected machine errors are handled with Effect.catch or turned into defects with Effect.orDie, not dropped.",
          "waitFor calls that may never match carry a { timeout } so a stuck workflow fails instead of hanging.",
          "An actor handed to another owner (returned, provided as a Layer service) is observed by that owner; name it in the resolution.",
          "A fire-and-forget actor whose failure is intentionally ignored is acceptable with a reason.",
        ],
        refs: [
          {
            type: "url",
            href: "https://github.com/statelyai/xstate/blob/next/packages/xstate-effect/docs/observing-actors.md",
          },
          {
            type: "url",
            href: "https://github.com/statelyai/xstate/blob/next/packages/xstate-effect/docs/testing-and-errors.md",
          },
        ],
      },
    },
    binding: {
      id: "xstate/effect-actor-observed",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx}"],
      exclude: ["**/*.d.ts"],
      options: {
        effectActorCalleePattern: options.effectActorCalleePattern
          ? { source: options.effectActorCalleePattern.source, flags: options.effectActorCalleePattern.flags }
          : null,
        observerNames: options.observerNames ? [...options.observerNames] : null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            label: "sent to, never observed",
            file: "src/module.ts",
            source:
              "Effect.gen(function*(){const actor=yield* createEffectActor(machine);yield* send(actor,{type:'GO'});});",
          },
        ],
        mustStaySilent: [
          {
            label: "joined",
            file: "src/module.ts",
            source: "Effect.gen(function*(){const actor=yield* createEffectActor(task);return yield* join(actor);});",
          },
          {
            label: "provided as a service",
            file: "src/module.ts",
            source: "const ReviewLayer=Layer.effect(ReviewActor,createEffectActor(machine));",
          },
        ],
      },
      id: "xstate/effect-actor-observed",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        return {
          call_expression(node) {
            if (!matches(effectActorCalleePattern, node.childByFieldName("function")?.text ?? "")) return;
            const name = boundName(node);
            if (name === undefined || observed(context.source, name)) return;
            context.report({
              node,
              message: `Effect actor '${name}' is never joined, awaited or streamed: its failure stays silent; read its outcome with join, waitFor, snapshots or subscribe.`,
            });
          },
        };
      },
    },
  });
}

export const effectActorObserved = defineEffectActorObserved();
