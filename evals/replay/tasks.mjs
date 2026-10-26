/** Landed slices are context, never byte-for-byte expected solutions. */
export const tasks = [
  {
    id: "forwarded-boundary",
    commit: "b5012d38a",
    scope: ["apps/backend/src/features/links"],
    tests: [
      "apps/backend/src/features/links/validate-link/handler.test.ts",
      "apps/backend/src/features/links/layer.integration.test.ts",
    ],
    prompt:
      "Fix ValidateLink at the public edge. A forwarded legacy response must remain a forwarded response, with no invented v2 reply. An absent ValidationReads adapter is a configuration failure, never a transient checkout outage that fails open. Preserve the existing outage fail-open policy and shadow-visit recording. Keep ports and adapters separate. Add distinguishing regression coverage.",
    pbt: false,
    browser: false,
  },
  {
    id: "archive-codec",
    commit: "729f88f4b",
    scope: ["apps/backend/src/features/recovery/archive-tinybird-export/archive-objects/encoding.boundary.ts"],
    tests: ["apps/backend/src/features/recovery/archive-tinybird-export/archive-objects/encoding.test.ts"],
    prompt:
      "Implement the raw archive wire codec in apps/backend/src/features/recovery/archive-tinybird-export/archive-objects/encoding.boundary.ts. The consumer contract is synchronous: compressedPart(readonly JSON records): Uint8Array emits zstd-compressed complete NDJSON rows; joinedParts(readonly Uint8Array frames): Uint8Array emits one readable zstd frame containing all rows in order; objectDigest(Uint8Array): string is lowercase SHA-256 hex of exact wire bytes. Preserve Unicode, nested fields, empty input and page boundaries. This is the encoding sub-slice of the Tinybird history archive work; do not implement storage, importers or other archive work. Verify the wire format independently. Retain tests alongside the codec; the production file scope does not exclude test files.",
    pbt: true,
    browser: false,
  },
  {
    id: "shell-boundaries",
    commit: "28e9be7a6",
    scope: ["apps/ops/src/shell", "apps/ops/src/features/errors/api.ts", "apps/ops/src/features/jobs/api.ts"],
    tests: ["apps/ops/src/shell"],
    prompt:
      "Refactor the ops shell so nav-counts, nav, navigation-commands and preferences reach errors and jobs only through those features' api.ts public surfaces, rather than their internal queries.ts/tabs.ts. Preserve all behavior. The takedown count remains owned by separate work and must stay unchanged. Avoid creating a generic feature facade or broad public re-exports. Verify existing shell behavior.",
    pbt: false,
    browser: false,
    acceptanceKind: "existing-tests-and-boundary",
  },
  {
    id: "uninstalled-regression",
    commit: "993fc4cd1",
    scope: ["apps/backend/src/features/protection"],
    tests: [
      "apps/backend/src/features/protection/on-revision-staged/handler.integration.test.ts",
      "apps/backend/src/features/protection/pause-protection/handler.integration.test.ts",
      "apps/backend/src/features/protection/on-deliverable-objects-ensured/handler.integration.test.ts",
    ],
    prompt:
      "Fix protection so PauseProtection and PublishStagedRevision refuse an uninstalled merchant before any platform object is ensured, claimed, paused or published. Recorded authority alone does not establish a current installation. Keep WriteRevision's distinct semantics: an obsolete installation's staged revision can be superseded without a platform write. Preserve outage handling. Add regressions that observe results and absence of writes.",
    pbt: false,
    browser: false,
  },
  {
    id: "bulk-confirmation",
    commit: "d347e2c5d",
    scope: [
      "apps/ops/src/components/confirm-dialog.tsx",
      "apps/ops/src/components/reason-dialog.tsx",
      "apps/ops/src/features/jobs",
    ],
    tests: [
      "apps/ops/src/features/jobs/sections/job-select-matching.test.tsx",
      "apps/ops/src/features/jobs/testing.tsx",
    ],
    prompt:
      "Fix bulk-job reason confirmation. Up to 25 matching jobs need a valid reason. Above 25, the dialog must retain the typed-count field as well as the reason and enable confirmation only when BOTH are valid. Typing 25 for a 26-job action must remain disabled; a correct count with a too-short reason remains disabled; a valid reason and the exact count (surrounding whitespace allowed) enables it. Preserve shared confirmation behavior and verify through the user-facing job selection flow, with browser evidence if available.",
    pbt: false,
    browser: true,
  },
];

/** Blocked cells stay in the denominator; order counterbalances condition and repetition. */
export function matrix(selected = tasks) {
  const conditions = ["none", "full", "testing", "build"];

  return [1, 2].flatMap((seed) =>
    selected.flatMap((task, index) => {
      const ordered = [...conditions.slice((index + seed) % 4), ...conditions.slice(0, (index + seed) % 4)];

      return ["gpt-6.1-sol", "gpt-6-luna"].flatMap((model) =>
        ordered
          .filter((condition) => model !== "gpt-6-luna" || ["none", "full"].includes(condition))
          .map((condition) => ({ task, seed, model, condition })),
      );
    }),
  );
}
