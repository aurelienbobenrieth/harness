import { defineRule, type StateRule } from "@aurelienbbn/agentlint";

const defaultActorStartPattern = /^createActor\s*(?:<[^>]*>)?\s*\(/;

export type ActorCleanupOptions = {
  /** Pattern matching actor creation call expressions. */
  readonly actorStartPattern?: RegExp;
};

export function defineActorCleanup(options: ActorCleanupOptions = {}): StateRule {
  options = structuredClone(options);
  const actorStartPattern = options.actorStartPattern ?? defaultActorStartPattern;

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "xstate/actor-cleanup",
      revision: 2,
      title: "Actor Cleanup",
      summary: "Flags actor creation sites that need lifecycle-cleanup review.",
      guidance: {
        standard:
          "Started actors must be stopped when their host goes away: a web component stops its actor in disconnectedCallback, a React component lets @xstate/react own the actor, otherwise machines keep running against detached DOM. Stopping an actor unsubscribes all of its observers, but it does not run the machine's exit actions.",
        checks: [
          "actor.start() is paired with actor.stop() on the host teardown path (disconnectedCallback, dispose, abort).",
          "subscribe() calls keep the returned subscription and unsubscribe on teardown, unless actor.stop() is proven on that same teardown path: a stopped actor unsubscribes its observers, so an explicit unsubscribe is only required when the subscriber goes away before the actor does.",
          "Cleanup that must run on teardown (timers, listeners, sockets, abort) does not live in exit actions: exit actions do not run when the root actor is stopped externally with actor.stop(). Put it in the cleanup function returned by an invoked fromCallback actor.",
          "In React files the actor is created through useActorRef, useMachine or createActorContext so it follows the component lifecycle; a bare createActor(...) passes only as a documented module-scope singleton.",
          "Module-scope singleton actors that intentionally live for the page are acceptable when documented.",
        ],
        refs: [
          { type: "url", href: "https://stately.ai/docs/actors" },
          { type: "url", href: "https://stately.ai/docs/callback-actors" },
          { type: "url", href: "https://stately.ai/docs/xstate-react" },
        ],
      },
    },
    binding: {
      id: "xstate/actor-cleanup",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx}"],
      exclude: ["**/*.d.ts", "**/*.{test,spec}.*"],
      options: {
        actorStartPattern: options.actorStartPattern
          ? { source: options.actorStartPattern.source, flags: options.actorStartPattern.flags }
          : null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [{ file: "src/module.ts", source: "createActor(machine)" }],
        mustStaySilent: [{ file: "src/module.ts", source: "const id=1;" }],
      },
      id: "xstate/actor-cleanup",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        return {
          call_expression(node) {
            actorStartPattern.lastIndex = 0;
            if (!actorStartPattern.test(node.text)) return;
            context.report({
              node,
              message:
                "Actor creation: verify stop() runs on host teardown and teardown-critical cleanup is not left to exit actions.",
            });
          },
        };
      },
    },
  });
}

export const actorCleanup = defineActorCleanup();
