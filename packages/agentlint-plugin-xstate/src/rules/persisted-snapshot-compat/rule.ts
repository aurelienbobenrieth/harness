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
      revision: 1,
      title: "Persisted Snapshot Compatibility",
      summary:
        "Flags sites that persist or restore an actor snapshot so stored state is reviewed for versioning, fallback and serialisability.",
      guidance: {
        standard:
          "A persisted snapshot outlives the machine that produced it. XState does not migrate it: restoring a snapshot that names a renamed or removed state throws at actor creation, so every returning user crashes on the deploy that changed the machine. Persisted state is versioned, restored defensively, and limited to JSON-serialisable context.",
        checks: [
          "The stored payload carries a version or schema key that is checked before restore, or the storage key itself is versioned.",
          "Restore is wrapped so an incompatible, corrupt or missing snapshot falls back to a fresh actor instead of throwing at startup.",
          "Context holds only JSON-serialisable values: no Date, Map, Set, class instance, function or DOM node.",
          "Nothing relies on entry actions re-running after restore: actions are not replayed for the restored state.",
          "Persisted machines reference child actors by named src (setup({ actors })): an inline child actor cannot be persisted and getPersistedSnapshot() throws.",
        ],
        refs: [{ type: "url", href: "https://stately.ai/docs/persistence" }],
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
      createOnce(context) {
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
