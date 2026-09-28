/**
 * Fails a GitHub Actions step that runs `alchemy deploy` or `alchemy destroy` against a stack whose
 * `state:` is `localState()` or `inMemoryState()`. The runner's `.alchemy/state` is discarded with the job,
 * so the next deploy re-creates or collides with live resources, and a destroy plans nothing and leaks them.
 *
 * @attribution https://alchemy.run/state-store/ (inspiration; independently implemented)
 * @attribution https://alchemy.run/environments/ci/ (inspiration; independently implemented)
 */
import path from "node:path";
import { invokedStackFile } from "../commands.js";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { readText } from "../project-files.js";
import { analyzeStackState, type StackStateAnalysis } from "../stack-state.js";
import { loadWorkflows, unresolvedFindings } from "../workflows.js";

const id = "ci-uses-remote-state";
const docs = "https://alchemy.run/state-store/#remote-state";

export const ciUsesRemoteState: ConformanceCheck = {
  id,
  description: "Every CI alchemy deploy or destroy targets a stack with a remote state store, not localState().",
  docs,
  async run(options) {
    const { workflows, findings: loadFindings } = await loadWorkflows(options, id, docs);
    const findings: ConformanceFinding[] = [...loadFindings];
    const analyses = new Map<string, StackStateAnalysis | undefined>();
    for (const workflow of workflows)
      for (const step of workflow.steps) {
        findings.push(...unresolvedFindings(workflow, step, id, docs, "the state store of what it deploys"));
        for (const invocation of step.invocations) {
          if (invocation.command !== "deploy" && invocation.command !== "destroy") continue;
          const where = `${step.label}: \`${invocation.text}\``;
          const stack = invokedStackFile(invocation);
          if (stack === undefined) {
            findings.push({
              check: id,
              docs,
              path: workflow.path,
              severity: "warning",
              evaluation: "unsupported",
              message: `${where} runs from a working directory or config this check cannot resolve statically, so its state store was not reviewed.`,
            });
            continue;
          }
          if (!analyses.has(stack)) {
            const source = await readText(path.join(options.root, stack));
            analyses.set(stack, source === undefined ? undefined : analyzeStackState(stack, source));
          }
          const analysis = analyses.get(stack);
          const base = { check: id, docs, path: workflow.path } as const;
          if (analysis === undefined)
            findings.push({
              ...base,
              severity: "warning",
              evaluation: "unsupported",
              message: `${where} targets ${stack}, which does not exist. Fix the working directory or --config.`,
            });
          else if (!analysis.parsed)
            findings.push({
              ...base,
              path: stack,
              severity: "error",
              evaluation: "failed",
              message: `${stack} does not parse (${analysis.reason}), so the state store of ${where} is unknown.`,
            });
          else if (analysis.kind === "ephemeral")
            findings.push({
              ...base,
              severity: "error",
              message: `${where} uses ${stack}, whose ${analysis.reason}: the runner discards .alchemy/state after the job, so the next ${invocation.command} starts from empty state. Set \`state: Cloudflare.state()\` (or another remote store) for CI.`,
            });
          else if (analysis.kind === "mixed")
            findings.push({
              ...base,
              severity: "warning",
              message: `${where} uses ${stack}, whose ${analysis.reason}. Make sure the branch taken on CI is the remote store.`,
            });
          else if (analysis.kind === "unknown")
            findings.push({
              ...base,
              path: stack,
              severity: "warning",
              evaluation: "unsupported",
              message: `${stack}: ${analysis.reason}, so the state store of ${where} was not reviewed.`,
            });
        }
      }
    return findings;
  },
};
