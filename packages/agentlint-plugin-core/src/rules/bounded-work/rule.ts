import { defineRule } from "@aurelienbbn/agentlint";

const ioPattern =
  /\b(?:await\b|fetch\s*\(|axios\.|client\.|api\.|repo\.|repository\.|queue\.|enqueue\s*\()/i;
const loopPattern = /\b(?:for|while)\s*\(|\bfor\s+await\b|\.(?:forEach|map|flatMap|reduce)\s*\(/i;
const sequentialAwaitPattern = /\bawait\b[\s\S]{0,600}\bawait\b[\s\S]{0,600}\bawait\b/;
const fanOutPattern = /Promise\.all\s*\([\s\S]{0,240}\.(?:map|flatMap)\s*\(/;
const longBudgetPattern =
  /\b(?:timeoutMS|timeoutMs|timeout|durationMs|maxDuration|cpuMs)\s*:\s*([0-9_]+)/g;
const defaultLongBudgetMs = 60_000;

function hasLongBudget(source: string): boolean {
  for (const match of source.matchAll(longBudgetPattern)) {
    const value = Number((match[1] ?? "").replaceAll("_", ""));
    if (Number.isFinite(value) && value > defaultLongBudgetMs) return true;
  }

  return false;
}

function shouldReport(source: string): boolean {
  if (hasLongBudget(source)) return true;
  if (sequentialAwaitPattern.test(source) && ioPattern.test(source)) return true;
  if (fanOutPattern.test(source) && ioPattern.test(source)) return true;

  return loopPattern.test(source) && ioPattern.test(source);
}

export const boundedWork = defineRule({
  id: "core/bounded-work",
  description: "Flags execution paths with unbounded I/O, fan-out, or runtime budgets.",
  guidance: {
    standard:
      "Long-running or I/O-heavy execution paths must show an explicit runtime boundary, bound, or backpressure strategy.",
    checks: [
      "Sequential I/O stays within the request, job, or provider budget.",
      "Looped I/O and fan-out use explicit concurrency, rate, retry, and provider-limit controls.",
      "Long budgets belong to approved workflow, queue, cron, or service boundaries with persisted progress or idempotency.",
    ],
  },
  createOnce(context) {
    return {
      program(node) {
        if (!shouldReport(node.text)) return;

        context.report({
          node,
          message:
            "Execution path needs an explicit bound for sequential I/O, looped I/O, fan-out, or a long runtime budget.",
        });
      },
    };
  },
});
