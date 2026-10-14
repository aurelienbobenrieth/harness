import { defineRule, type StateRule } from "@aurelienbbn/agentlint";

// Bare or receiver-bound (v6 `system.createActor`) XState actors, `@xstate/effect` scoped actors and actor atoms.
const defaultActorStartPattern = /^(?:[\w$]+\.)?(?:createActor|createEffectActor|createActorAtoms)\s*(?:<[^>]*>)?\s*\(/;
const effectActorCalleePattern = /(?:^|\.)createEffectActor$/;
const actorAtomsCalleePattern = /(?:^|\.)createActorAtoms$/;

const actorMessage =
  "Actor creation: verify stop() runs on host teardown and teardown-critical cleanup is not left to exit actions.";
const effectActorMessage =
  "Effect actor creation: verify the enclosing Scope (Effect.scoped, a Layer under a disposed runtime) closes when the host goes away.";
const actorAtomsMessage =
  "Actor atoms creation: verify the atom registry is disposed when its owner shuts down, which releases the actor.";

/** Tests from the start so global and sticky patterns stay deterministic across nodes. */
function matches(pattern: RegExp, text: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

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
      revision: 3,
      title: "Actor Cleanup",
      summary: "Flags actor creation sites that need lifecycle-cleanup review.",
      guidance: {
        standard:
          "Started actors must be stopped when their host goes away: a web component stops its actor in disconnectedCallback, a React component lets @xstate/react own the actor, an @xstate/effect actor belongs to the Scope that created it; otherwise machines keep running against detached DOM. In XState v5 and v6 alike, stopping an actor completes all of its observers and stops its children, but it does not run the machine's exit actions.",
        checks: [
          "actor.start() is paired with actor.stop() on the host teardown path (disconnectedCallback, dispose, abort). This holds for createActor(...) and for v6 system.createActor(...).",
          "subscribe() calls keep the returned subscription and unsubscribe on teardown, unless actor.stop() is proven on that same teardown path: a stopped actor completes its observers, so an explicit unsubscribe is only required when the subscriber goes away before the actor does.",
          "Cleanup that must run on teardown (timers, listeners, sockets, abort) does not live in exit actions: exit actions do not run when the root actor is stopped externally with actor.stop(). Put it in the cleanup function returned by callback logic (v5 fromCallback, v6 createCallbackLogic), or react to the abort signal an async actor receives (v6 createAsyncLogic).",
          "In React files the actor is created through useActorRef, useMachine or createActorContext so it follows the component lifecycle; a bare createActor(...) passes only as a documented module-scope singleton.",
          "createEffectActor(...) runs inside a bounded Scope: Effect.scoped(program) for a unit of work, or a Layer provided to a ManagedRuntime that is disposed on shutdown. Closing the scope stops the actor and interrupts its hosted Effects.",
          "createActorAtoms(...) actors are released when their atoms have no consumers; the owning atom registry is disposed when its owner shuts down.",
          "Module-scope singleton actors that intentionally live for the page are acceptable when documented.",
        ],
        refs: [
          { type: "url", href: "https://stately.ai/docs/actors" },
          { type: "url", href: "https://stately.ai/docs/callback-actors" },
          { type: "url", href: "https://stately.ai/docs/xstate-react" },
          {
            type: "url",
            href: "https://github.com/statelyai/xstate/blob/next/packages/xstate-effect/docs/actors.md",
          },
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
        mustReport: [
          { file: "src/module.ts", source: "createActor(machine)" },
          { label: "v6 system actor", file: "src/module.ts", source: "system.createActor(machine).start();" },
          {
            label: "@xstate/effect actor",
            file: "src/module.ts",
            source: "Effect.gen(function*(){const actor=yield* createEffectActor(machine);});",
          },
          { label: "actor atoms", file: "src/module.ts", source: "const review=createActorAtoms(runtime,machine);" },
        ],
        mustStaySilent: [
          { file: "src/module.ts", source: "const id=1;" },
          { label: "React actor context", file: "src/module.tsx", source: "const Ctx=createActorContext(machine);" },
        ],
      },
      id: "xstate/actor-cleanup",
      version: 2,
      scan: "file",
      createOnce({ context }) {
        return {
          call_expression(node) {
            if (!matches(actorStartPattern, node.text)) return;
            // `createActor(m).start()` starts with the creation text too: report the creation call only.
            const receiver = node.childByFieldName("function")?.childByFieldName("object");
            if (receiver?.type === "call_expression" && matches(actorStartPattern, receiver.text)) return;
            const callee = node.childByFieldName("function")?.text ?? "";
            const message = effectActorCalleePattern.test(callee)
              ? effectActorMessage
              : actorAtomsCalleePattern.test(callee)
                ? actorAtomsMessage
                : actorMessage;
            context.report({ node, message });
          },
        };
      },
    },
  });
}

export const actorCleanup = defineActorCleanup();
