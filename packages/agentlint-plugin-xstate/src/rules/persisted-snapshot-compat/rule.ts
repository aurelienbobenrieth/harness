import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";

const defaultPersistCalleePattern = /(?:^|\.)getPersistedSnapshot$/;
const defaultRestoreCalleePattern = /(?:^|\.)(?:createActor|useActor|useMachine|useActorRef)$/;

export type PersistedSnapshotCompatOptions = {
  /** Pattern tested against the callee text of a call expression to recognise a snapshot being persisted. */
  readonly persistCalleePattern?: RegExp;
  /** Pattern tested against the callee text of calls whose options object may restore a `snapshot`. */
  readonly restoreCalleePattern?: RegExp;
};

function restoresSnapshot(call: AgentlintNode): boolean {
  const options = call
    .childByFieldName("arguments")
    ?.children.filter((child) => child.isNamed && child.type !== "comment")[1];
  if (options?.type !== "object") return false;
  return options.children.some(
    (child) =>
      (child.type === "pair" && child.childByFieldName("key")?.text.replace(/^['"`]|['"`]$/g, "") === "snapshot") ||
      (child.type === "shorthand_property_identifier" && child.text === "snapshot"),
  );
}

/** Tests from the start so global and sticky patterns stay deterministic across nodes. */
function matches(pattern: RegExp, text: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

export function definePersistedSnapshotCompat(options: PersistedSnapshotCompatOptions = {}): StateRule {
  options = structuredClone(options);
  const persistCalleePattern = options.persistCalleePattern ?? defaultPersistCalleePattern;
  const restoreCalleePattern = options.restoreCalleePattern ?? defaultRestoreCalleePattern;

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "xstate/persisted-snapshot-compat",
      revision: 2,
      title: "Persisted Snapshot Compatibility",
      summary:
        "Flags sites that persist or restore an actor snapshot so stored state is reviewed for versioning, fallback and serialisability.",
      guidance: {
        standard:
          "A persisted snapshot outlives the machine that produced it. Restoring a snapshot that names a renamed or removed state does not throw at createActor(...): in v5 and v6 alike the actor comes back with status 'error', and without an error observer that error is reported as unhandled, so every returning user lands on a dead actor after the deploy that changed the machine. v5 never migrates stored snapshots; v6 stamps the machine's id and version into each persisted snapshot and migrates old ones through machineVersions(). Snapshots stored by v5 do not restore in v6. Persisted state is versioned, restored defensively, and limited to JSON-serialisable context.",
        checks: [
          "The stored payload is versioned. v5: a version or schema key checked before restore, or a versioned storage key. v6: the machine declares a version, and older snapshots go through machineVersions(...).migrateSnapshot(...) or are discarded.",
          "Restore checks the restored actor's status (or subscribes with an error observer) and falls back to a fresh actor when the snapshot is incompatible, corrupt or missing; wrapping createActor(...) in try/catch alone catches nothing.",
          "An upgrade from v5 to v6 drains or discards snapshots stored by v5: their internal shape changed.",
          "Context holds only JSON-serialisable values: no Map, Set, class instance, function, BigInt or DOM node. A Date comes back as a string.",
          "Nothing relies on entry actions re-running after restore: restoring runs no transitions and replays no actions (in v6, always transitions are not re-evaluated until the next event).",
          "The persisted value comes from actor.getPersistedSnapshot(), never from actor.getSnapshot().",
          "Spawned child actors use a registered source (setup({ actors }) in v5, the machine's actors in v6). v6: getPersistedSnapshot() throws 'An inline child actor cannot be persisted.' while an inline spawned child exists. v5: an inline spawned child is written without a source the machine can resolve.",
          "@xstate/effect actors started with createEffectActor(...) cannot be restored from a persisted snapshot yet: their snapshot is not a durable checkpoint.",
        ],
        refs: [
          { type: "url", href: "https://stately.ai/docs/persistence" },
          { type: "url", href: "https://github.com/statelyai/xstate/blob/next/docs/persistence.md" },
        ],
      },
    },
    binding: {
      id: "xstate/persisted-snapshot-compat",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx}"],
      exclude: ["**/*.d.ts", "**/*.{test,spec}.*"],
      options: {
        persistCalleePattern: options.persistCalleePattern
          ? {
              source: options.persistCalleePattern.source,
              flags: options.persistCalleePattern.flags,
            }
          : null,
        restoreCalleePattern: options.restoreCalleePattern
          ? {
              source: options.restoreCalleePattern.source,
              flags: options.restoreCalleePattern.flags,
            }
          : null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            label: "persist",
            file: "src/module.ts",
            source: "save(actor.getPersistedSnapshot());",
          },
          {
            label: "restore",
            file: "src/module.ts",
            source: "createActor(machine,{snapshot:JSON.parse(raw)});",
          },
          {
            label: "v6 system actor restore",
            file: "src/module.ts",
            source: "system.createActor(machine,{snapshot:migrated}).start();",
          },
          {
            label: "hook restore",
            file: "src/module.tsx",
            source: "useMachine(machine,{snapshot});",
          },
        ],
        mustStaySilent: [
          {
            label: "fresh actor with input",
            file: "src/module.ts",
            source: "createActor(machine,{input:{id}});",
          },
          {
            label: "snapshot key on an unrelated call",
            file: "src/module.ts",
            source: "render(view,{snapshot:actor.getSnapshot()});",
          },
        ],
      },
      id: "xstate/persisted-snapshot-compat",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        return {
          call_expression(node) {
            const callee = node.childByFieldName("function")?.text ?? "";
            if (matches(persistCalleePattern, callee)) {
              context.report({
                node,
                message:
                  "Snapshot persisted: store it with a version and restore it behind a compatibility check that falls back to a fresh actor.",
              });
              return;
            }
            if (!matches(restoreCalleePattern, callee) || !restoresSnapshot(node)) return;
            context.report({
              node,
              message:
                "Actor restored from a stored snapshot: check its version first and fall back to a fresh actor when the machine has changed.",
            });
          },
        };
      },
    },
  });
}

export const persistedSnapshotCompat = definePersistedSnapshotCompat();
