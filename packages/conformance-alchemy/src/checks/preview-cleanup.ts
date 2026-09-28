/**
 * Pairs every CI deploy to a `pr-*` preview stage with an `alchemy destroy` of a `pr-*` stage in a
 * workflow triggered by `pull_request` `closed`, and fails a destroy whose stage is, or can resolve to,
 * `prod` / `production` without an earlier guard step in its job. Stages are read as written: `--stage`,
 * else `ALCHEMY_STAGE`, with `${{ env.X }}` and `$X` substituted from the workflow, job and step env.
 *
 * @attribution https://alchemy.run/environments/stages/ (inspiration; independently implemented)
 * @attribution https://alchemy.run/environments/ci/ (inspiration; independently implemented)
 */
import { invokedStackFile, type AlchemyInvocation } from "../commands.js";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { invocationStage, loadWorkflows, unresolvedFindings, type Workflow, type WorkflowStep } from "../workflows.js";

const id = "preview-cleanup";
const docs = "https://alchemy.run/environments/stages/#pull-request-previews";

const previewStage = /(?:^|[^\w-])pr-/u;
const productionWord = /(?:^|[^\w-])(?:prod|production)(?:[^\w-]|$)/u;
const productionLiteral = /^(?:prod|production)$/u;

type Located = {
  readonly workflow: Workflow;
  readonly step: WorkflowStep;
  readonly invocation: AlchemyInvocation;
  readonly stage: string | undefined;
  readonly stack: string | undefined;
};

/**
 * A step of the same job, up to the destroy step itself, that exits non-zero and names either production
 * (the Alchemy CI guide's deny check) or the `pr-` prefix (an allow-list such as `case "$STAGE" in pr-*)`).
 * Its condition is not evaluated.
 */
function guarded(workflow: Workflow, target: WorkflowStep): boolean {
  const earlier = workflow.steps.slice(0, workflow.steps.indexOf(target) + 1);
  return earlier.some(
    (step) =>
      step.job === target.job &&
      (productionWord.test(step.run) || previewStage.test(step.run)) &&
      /\bexit\s+[1-9]/u.test(step.run),
  );
}

export const previewCleanup: ConformanceCheck = {
  id,
  description:
    "Every CI deploy to a pr-* stage has a matching alchemy destroy on pull_request closed, and no destroy can target prod.",
  docs,
  async run(options) {
    const { workflows, findings: loadFindings } = await loadWorkflows(options, id, docs);
    const findings: ConformanceFinding[] = [...loadFindings];
    const located: Located[] = workflows.flatMap((workflow) =>
      workflow.steps.flatMap((step) =>
        step.invocations.map((invocation) => ({
          workflow,
          step,
          invocation,
          stage: invocationStage(invocation, step),
          stack: invokedStackFile(invocation),
        })),
      ),
    );
    const cleanups = located.filter(
      (entry) =>
        entry.invocation.command === "destroy" &&
        entry.workflow.closesPullRequests &&
        previewStage.test(entry.stage ?? ""),
    );
    const closingUnresolved = workflows.some(
      (workflow) => workflow.closesPullRequests && workflow.steps.some((step) => step.unresolved.length > 0),
    );
    const steps = workflows.flatMap((workflow) => workflow.steps.map((step) => ({ workflow, step })));
    for (const { workflow, step } of steps) findings.push(...unresolvedFindings(workflow, step, id, docs, "its stage"));
    for (const entry of located) {
      const where = `${entry.step.label}: \`${entry.invocation.text}\``;
      if (entry.invocation.command === "deploy" && previewStage.test(entry.stage ?? "")) {
        const matched = cleanups.some(
          (cleanup) => cleanup.stack === undefined || entry.stack === undefined || cleanup.stack === entry.stack,
        );
        if (!matched)
          findings.push({
            check: id,
            docs,
            path: entry.workflow.path,
            ...(closingUnresolved ? { severity: "warning", evaluation: "unsupported" } : { severity: "error" }),
            message: `${where} deploys preview stage ${entry.stage ?? ""}, but no workflow triggered on pull_request \`types: [closed]\` runs \`alchemy destroy --stage pr-...\` for ${entry.stack ?? "this stack"}${closingUnresolved ? " that this check can resolve" : ""}. Add a cleanup job, or every closed PR leaves its resources running.`,
          });
      }
      if (entry.invocation.command !== "destroy" || entry.stage === undefined) continue;
      if (productionLiteral.test(entry.stage.trim()))
        findings.push({
          check: id,
          docs,
          path: entry.workflow.path,
          severity: "error",
          message: `${where} destroys stage ${entry.stage}. Never destroy production from CI; target the preview stage (pr-\${{ github.event.number }}).`,
        });
      else if (productionWord.test(entry.stage) && !guarded(entry.workflow, entry.step))
        findings.push({
          check: id,
          docs,
          path: entry.workflow.path,
          severity: "error",
          message: `${where} destroys a stage that can resolve to production (${entry.stage}). Compute the stage as pr-\${{ github.event.number }}, or add an earlier step in the job that exits 1 when the stage is prod.`,
        });
    }
    return findings;
  },
};
