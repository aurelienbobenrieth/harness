import { type AgentlintNode, defineRule, type StateRule } from "@aurelienbbn/agentlint";
import { diskRepo, memoryRepo, type Repo, rootOf } from "../transaction-no-network/program.js";
import { type Wire, wireOf } from "./wire.js";

const reasonField = /[{,\s]reason\??\s*:/u;
const messageField = /[{,\s]message\??\s*:/u;
const literalReasons = /\breason\??\s*:\s*\w+\.Literals?\(\[?([^\])]*)/u;

const contract = {
  "packages/api/rpcs.ts": [
    'import { Rpc, Schema } from "effect";',
    'export class PlanRefusedError extends Schema.TaggedError<PlanRefusedError>()("PlanRefusedError", {',
    '  reason: Schema.Literals(["inactive", "plan_not_offered"]),',
    "}) {}",
    'export class SaveRefusedError extends Schema.TaggedError<SaveRefusedError>()("SaveRefusedError", {',
    '  reason: Schema.Literals(["stale_revision"]),',
    "}) {}",
    'export const change = Rpc.make("plan.change", { error: Schema.Union([PlanRefusedError, SaveRefusedError]) });',
    "",
  ].join("\n"),
};

const reasonsOf = (heritage: string): readonly string[] => {
  const [, literals] = literalReasons.exec(heritage) ?? [];
  return literals === undefined ? [] : [...literals.matchAll(/["']([^"']+)["']/gu)].map((match) => match[1] ?? "");
};

/** Tagged errors whose wire form carries a `reason`, the class itself not turning it into a text. */
const carriesUnspokenReason = (node: AgentlintNode, heritage: AgentlintNode): boolean => {
  if (!heritage.text.includes("TaggedError") || !reasonField.test(heritage.text)) return false;
  if (messageField.test(heritage.text)) return false;
  return !/\bmessage\b/u.test(node.childByFieldName("body")?.text ?? "");
};

/** Reviews refusal reasons a program sends and no caller in the checkout tells apart. */
export const refusalReasonReachesReader: StateRule = defineRule({
  lifecycle: "state",
  standard: {
    id: "effect/refusal-reason-reaches-reader",
    revision: 1,
    title: "A refusal's reason reaches who was refused",
    summary:
      "Flags an RPC or HTTP API error carrying a reason that no code in the checkout reads, so a refusal the user could act on does not end as a generic failure.",
    guidance: {
      standard:
        "A server that says why it refused has done the work; the reason only helps if it reaches the person refused. An error whose reason nobody reads collapses into the page's generic failure, which usually says to retry, and retrying a refusal changes nothing.",
      checks: [
        "Find what the client shows when this error arrives, for each reason.",
        "Fails when the user can act on a reason, or when the text shown tells them to do something that cannot help: retry a refusal that will refuse again, reload an inactive installation. Give each such reason its own text.",
        "Passes when a reason can only follow a stale view, and the generic text sends the user to refresh. Name how the interface prevents the rest.",
        "Passes when the caller is a program, or lives in another repository.",
        "A reason nothing needs can also leave the contract: then the refusal is honest about being generic.",
      ],
      examples: [
        {
          label: "FAIL",
          description: "The server refuses with `inactive`; the page says to retry.",
          code: 'class SetupRefusedError extends Schema.TaggedError<SetupRefusedError>()("SetupRefusedError", {\n  reason: Schema.Literals(["inactive", "no_policy"]),\n}) {}\n\n// page: every failure shows the same line\n{AsyncResult.isFailure(save) ? <p role="alert">Could not save. Retry.</p> : undefined}',
        },
        {
          label: "PASS",
          description: "Each reason has a text, and TypeScript keeps the map complete.",
          code: 'const REFUSALS: Record<SetupRefusedError["reason"], () => string> = {\n  inactive: m.setup_refused_inactive,\n  no_policy: m.setup_refused_no_policy,\n};',
        },
      ],
      refs: [{ type: "url", href: "https://www.nngroup.com/articles/error-message-guidelines/" }],
    },
  },
  binding: {
    id: "effect/refusal-reason-reaches-reader",
    authority: "agent",
    include: ["**/*.{ts,tsx,mts,cts}"],
    exclude: [
      "**/*.d.ts",
      "**/*.{test,spec}.{ts,tsx}",
      "**/{test,tests,__tests__,testing,fixtures}/**",
      "**/testing.{ts,tsx}",
    ],
  },
  detector: {
    id: "effect/refusal-reason-reaches-reader",
    version: 1,
    scan: "file",
    fixtures: {
      mustReport: [
        {
          label: "a client that tells one refusal apart and not the other",
          files: {
            "apps/web/page.tsx":
              'const REFUSALS: Record<SaveRefusedError["reason"], () => string> = { stale_revision: reload };\n',
            ...contract,
          },
        },
      ],
      mustStaySilent: [
        {
          label: "a client that reads both refusals",
          files: {
            "apps/web/page.tsx": [
              'const save: Record<SaveRefusedError["reason"], () => string> = { stale_revision: reload };',
              "export const text = (error) => (Schema.is(PlanRefusedError)(error) ? plans[error.reason]() : failed());",
              "",
            ].join("\n"),
            ...contract,
          },
        },
        {
          label: "a checkout with no client at all",
          files: contract,
        },
      ],
    },
    createOnce({ context }) {
      const state: { memory: Record<string, string>; wire: Wire | undefined } = { memory: {}, wire: undefined };
      const wireFor = (): Wire => {
        const root = rootOf(context.path, context.absolutePath);
        const repo: Repo | undefined = root === undefined ? memoryRepo({ ...state.memory }) : undefined;
        if (repo !== undefined) return wireOf(repo);
        state.wire ??= wireOf(diskRepo(root ?? ""));
        return state.wire;
      };

      return {
        before(): boolean {
          if (rootOf(context.path, context.absolutePath) === undefined) state.memory[context.path] = context.source;
          return context.source.includes("TaggedError") && context.source.includes("reason");
        },
        class_declaration(node) {
          const name = node.childByFieldName("name")?.text;
          const heritage = node.childrenByType("class_heritage")[0];
          if (name === undefined || heritage === undefined || !carriesUnspokenReason(node, heritage)) return;
          const wire = wireFor();
          // Nothing in the checkout reads any error of the wire: its clients live elsewhere.
          if (!wire.errors.has(name) || wire.readers.size === 0 || wire.readers.has(name)) return;
          context.report({
            evidence: { error: name, reasons: reasonsOf(heritage.text) },
            message: `${name} sends a reason and nothing in this checkout reads it, so every refusal looks the same to the user. Give each reason they can act on its own text, or stop sending it.`,
            node,
          });
        },
      };
    },
  },
});
