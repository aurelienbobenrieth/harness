import { defineRule } from "@aurelienbbn/agentlint";

const ioPattern = /\b(?:await\b|fetch\s*\(|axios\.|client\.|api\.|repo\.|repository\.|queue\.|enqueue\s*\()/i;
const loopPattern = /\b(?:for|while)\s*\(|\bfor\s+await\b|\.(?:forEach|map|flatMap|reduce)\s*\(/i;
const sequentialAwaitPattern = /\bawait\b[\s\S]{0,600}\bawait\b[\s\S]{0,600}\bawait\b/;
const fanOutPattern = /Promise\.all\s*\([\s\S]{0,240}\.(?:map|flatMap)\s*\(/;
const longBudgetPattern = /\b(?:timeoutMS|timeoutMs|timeout|durationMs|maxDuration|cpuMs)\s*:\s*([0-9_]+)/g;
const defaultLongBudgetMs = 60_000;

function hasLongBudget(source: string): boolean {
  for (const match of source.matchAll(longBudgetPattern)) {
    const value = Number((match[1] ?? "").replaceAll("_", ""));
    if (Number.isFinite(value) && value > defaultLongBudgetMs) return true;
  }

  return false;
}

function shouldReview(source: string): boolean {
  if (hasLongBudget(source)) return true;
  if (sequentialAwaitPattern.test(source) && ioPattern.test(source)) return true;
  if (fanOutPattern.test(source) && ioPattern.test(source)) return true;

  return loopPattern.test(source) && ioPattern.test(source);
}

export const boundedWorkReview = defineRule({
  id: "core/bounded-work-review",
  description: "Flags execution paths that may exceed bounded runtime budgets.",
  guidance:
    "Review the flagged execution path against the project's runtime budget. In serverless and worker environments, check wall time, CPU, subrequests, retries, provider rate limits, and cold starts. In stateful services, check request latency, queue pressure, and backpressure. Accept when the work is explicitly tiny, chunked, rate-limited, queued, idempotent, or approved as a long-running boundary. For true positives, split work into bounded units, add concurrency/rate limits, persist progress, or move the work behind a workflow/queue boundary.",
  createOnce(context) {
    return {
      program(node) {
        if (!shouldReview(node.text)) return;

        context.report({
          node,
          message:
            "Program contains sequential I/O, looped I/O, fan-out, or a long runtime budget; review boundedness.",
        });
      },
    };
  },
});
