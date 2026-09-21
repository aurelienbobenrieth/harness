/**
 * Schedules visible-state review for user-triggered TanStack Query mutations.
 *
 * @attribution TanStack Query mutations guide (documentation inspiration; independently implemented)
 */
import { defineRule } from "@aurelienbbn/agentlint";
import { calleeName } from "../query-calls.js";

const message =
  "TanStack Query mutation needs visible-state coverage for pending, error, retry, and success, including duplicate-submission prevention.";

export const mutationStateCoverage = defineRule({
  lifecycle: "state",
  standard: {
    id: "tanstack-query/mutation-state-coverage",
    revision: 1,
    title: "Mutation State Coverage",
    summary:
      "Flags useMutation calls, including member-call spellings, that need user-visible pending, error, retry, success, and duplicate-submission review.",
    guidance: {
      standard:
        "A user-triggered mutation must expose its progress and outcome at the interaction boundary instead of leaving the initiating control apparently idle.",
      checks: [
        "Disable or otherwise guard the initiating action while the same mutation is pending when duplicate submissions would be unsafe.",
        "Render an actionable error without discarding the user's input, and make retry deliberate rather than automatic for non-idempotent work.",
        "Confirm success at the right scope, then invalidate, update, or reconcile affected query data without replacing server truth with stale local state.",
        "Account for paused/offline mutations when the application enables persistence or offline retry.",
        "Background mutations with no user-visible interaction may document that boundary and accept the review instead of fabricating UI state.",
      ],
      refs: [
        { type: "url", href: "https://tanstack.com/query/latest/docs/framework/react/guides/mutations" },
        {
          type: "url",
          href: "https://tanstack.com/query/latest/docs/framework/react/guides/mutations#persisting-offline-mutations",
        },
      ],
    },
  },
  binding: {
    id: "tanstack-query/mutation-state-coverage",
    authority: "agent",
    include: ["**/*.{ts,tsx,js,jsx}"],
    exclude: ["**/*.d.ts", "**/*.{test,spec}.*", "**/__tests__/**", "**/test-utils.*", "**/test-utils/**"],
  },
  detector: {
    fixtures: {
      mustReport: [
        {
          label: "bare mutation hook",
          file: "src/save-button.tsx",
          source: "const save = useMutation({ mutationFn: saveTodo });",
        },
        {
          label: "member mutation hook",
          file: "src/save-button.tsx",
          source: "const save = trpc.todo.save.useMutation();",
        },
        {
          label: "generic mutation hook",
          file: "src/save-button.tsx",
          source: "const save = useMutation<Todo, Error, Input>({ mutationFn: saveTodo });",
        },
      ],
      mustStaySilent: [
        {
          label: "mutation state selector",
          file: "src/status.tsx",
          source: "const pending = useMutationState({ filters: { status: 'pending' } });",
        },
        { label: "custom wrapper", file: "src/save.ts", source: "const save = useSaveMutation();" },
      ],
    },
    id: "tanstack-query/mutation-state-coverage",
    version: 1,
    scan: "file",
    createOnce(context) {
      return {
        call_expression(node) {
          if (calleeName(node) !== "useMutation") return;
          context.report({ node, message, evidence: { hook: "useMutation" } });
        },
      };
    },
  },
});
