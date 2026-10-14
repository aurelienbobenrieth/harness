import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";
import { callArguments, isDestructuredSpawn, isEnqueueSpawn, propertyKey } from "../syntax.js";

const defaultSpawnChildCallPattern = /^(?:[\w$]+\.)?spawnChild\s*[(<]/;

export type SpawnIdCollisionOptions = {
  /** Pattern matching v5 spawnChild call expressions (bare, enqueue-bound or setup-bound). */
  readonly spawnChildCallPattern?: RegExp;
};

/** Tests from the start so global and sticky patterns stay deterministic across nodes. */
function matches(pattern: RegExp, text: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

/** The `id` option of a spawn call when it is a string with no interpolation. */
function fixedId(call: AgentlintNode): AgentlintNode | undefined {
  const options = callArguments(call)[1];
  if (options?.type !== "object") return undefined;
  const id = options.children.find((child) => child.type === "pair" && propertyKey(child) === "id");
  const value = id?.childByFieldName("value");
  if (value?.type === "string") return value;
  if (value?.type === "template_string" && !value.children.some((child) => child.type === "template_substitution"))
    return value;
  return undefined;
}

/** Name of the `on` event whose handler (function, transition object, or actions) contains `node`. */
function handledEvent(node: AgentlintNode): string | undefined {
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (ancestor.type !== "pair" && ancestor.type !== "method_definition") continue;
    const map = ancestor.parent?.type === "object" ? ancestor.parent.parent : null;
    if (map?.type === "pair" && propertyKey(map) === "on") return propertyKey(ancestor);
  }
  return undefined;
}

export function defineSpawnIdCollision(options: SpawnIdCollisionOptions = {}): StateRule {
  options = structuredClone(options);
  const spawnChildCallPattern = options.spawnChildCallPattern ?? defaultSpawnChildCallPattern;

  const isSpawn = (call: AgentlintNode): boolean =>
    matches(spawnChildCallPattern, call.text) || isEnqueueSpawn(call) || isDestructuredSpawn(call);

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "xstate/spawn-id-collision",
      revision: 1,
      title: "Spawn Id Collision",
      summary:
        "Flags spawns with a fixed id inside an event handler, where a repeated event spawns a second child under the same id.",
      guidance: {
        standard:
          "An event handler runs every time its event is handled, and a spawned child outlives the state that created it. A spawn with a fixed id inside an event handler therefore asks for a second live child under the same id the next time that event arrives. XState v6 rejects it: the spawn throws and the parent actor's status becomes 'error'. XState v5 does not report it: the second child starts under the same id and the first is orphaned, still running, no longer addressable, and never cleaned up.",
        checks: [
          "Ids of children spawned per event derive from something stable and unique per child, such as a file, item or participant id (`upload-${event.fileId}`), or the id is omitted so XState generates one.",
          "A singleton child with a fixed id is stopped before it is spawned again: earlier in the same transition (v6 frees an id stopped earlier in the same transition), or by a guard that refuses the event while that child is live.",
          "The event provably cannot be handled again while the child lives (the handler leaves the only state that accepts it, and the child completes or is stopped before that state is re-entered); state that path in the resolution.",
        ],
        refs: [
          { type: "url", href: "https://stately.ai/docs/spawn" },
          { type: "url", href: "https://github.com/statelyai/xstate/blob/next/docs/spawn.md" },
        ],
      },
    },
    binding: {
      id: "xstate/spawn-id-collision",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx}"],
      exclude: ["**/*.d.ts"],
      options: {
        spawnChildCallPattern: options.spawnChildCallPattern
          ? { source: options.spawnChildCallPattern.source, flags: options.spawnChildCallPattern.flags }
          : null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            label: "v6 enq.spawn with a literal id",
            file: "src/module.ts",
            source: "createMachine({on:{add:(_,enq)=>{enq.spawn('upload',{id:'upload'});}}});",
          },
          {
            label: "v5 spawnChild with a literal id",
            file: "src/module.ts",
            source: "createMachine({on:{ADD:{actions:spawnChild('todo',{id:'todo'})}}});",
          },
        ],
        mustStaySilent: [
          {
            label: "id derived from the event",
            file: "src/module.ts",
            source: "createMachine({on:{add:({event},enq)=>{enq.spawn('upload',{id:`upload-${event.id}`});}}});",
          },
          {
            label: "fixed id in entry",
            file: "src/module.ts",
            source: "createMachine({entry:(_,enq)=>{enq.spawn('sync',{id:'sync'});}});",
          },
        ],
      },
      id: "xstate/spawn-id-collision",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        return {
          call_expression(node) {
            if (!isSpawn(node)) return;
            const id = fixedId(node);
            if (!id) return;
            const event = handledEvent(node);
            if (event === undefined) return;
            context.report({
              node,
              message: `Spawn with fixed id ${id.text} inside the '${event}' handler: a repeated '${event}' throws in v6 and orphans the first child in v5; derive the id per child or stop the existing child first.`,
            });
          },
        };
      },
    },
  });
}

export const spawnIdCollision = defineSpawnIdCollision();
