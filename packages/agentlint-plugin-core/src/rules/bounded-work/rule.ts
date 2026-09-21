import { type AgentlintNode, defineRule } from "@aurelienbbn/agentlint";

const ioPattern = /\b(?:await\b|fetch\s*\(|axios\.|client\.|api\.|repo\.|repository\.|queue\.|enqueue\s*\()/i;
const loopPattern = /\b(?:for|while)\s*\(|\bfor\s+await\b|\.(?:forEach|map|flatMap|reduce)\s*\(/i;
const sequentialAwaitPattern = /\bawait\b[\s\S]{0,600}\bawait\b[\s\S]{0,600}\bawait\b/;
const fanOutPattern = /Promise\.all\s*\([\s\S]{0,240}\.(?:map|flatMap)\s*\(/;
const longBudgetPattern = /\b(?:timeoutMS|timeoutMs|durationMs|cpuMs)\s*:\s*([0-9_]+)/g;
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

function executionSource(node: AgentlintNode, root = true): string {
  if (["comment", "string", "template_string", "regex"].includes(node.type)) return " ";
  if (
    !root &&
    [
      "function_declaration",
      "function_expression",
      "arrow_function",
      "generator_function",
      "method_definition",
      "class_declaration",
    ].includes(node.type) &&
    node.parent?.type !== "arguments"
  )
    return " ";
  if (node.children.length === 0) return node.text;
  let cursor = 0;
  let source = "";
  for (const child of node.children) {
    const start = node.text.indexOf(child.text, cursor);
    if (start < 0) continue;
    source += node.text.slice(cursor, start) + executionSource(child, false);
    cursor = start + child.text.length;
  }
  return source + node.text.slice(cursor);
}

export const boundedWork = defineRule({
  lifecycle: "state",
  standard: {
    id: "core/bounded-work",
    revision: 1,
    title: "Bounded Work",
    summary: "Flags execution paths with unbounded I/O, fan-out, or runtime budgets.",
    guidance: {
      standard:
        "Long-running or I/O-heavy execution paths must show an explicit runtime boundary, bound, or backpressure strategy.",
      checks: [
        "Sequential I/O stays within the request, job, or provider budget.",
        "Looped I/O and fan-out use explicit concurrency, rate, retry, and provider-limit controls.",
        "Long budgets belong to approved workflow, queue, cron, or service boundaries with persisted progress or idempotency.",
      ],
    },
  },
  binding: {
    id: "core/bounded-work",
    authority: "agent",
    include: ["**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"],
    exclude: ["**/*.d.ts"],
  },
  detector: {
    fixtures: {
      mustReport: [
        {
          file: "src/module.ts",
          source: "await Promise.all(items.map(item => client.send(item)))",
        },
      ],
      mustStaySilent: [{ file: "src/module.ts", source: "const values = items.map(item => item.id);" }],
    },
    id: "core/bounded-work",
    version: 1,
    scan: "file",
    createOnce(context) {
      const check = (node: AgentlintNode): void => {
        const source = executionSource(node);
        if (!shouldReport(source)) return;
        context.report({
          node,
          message:
            "Execution path needs an explicit bound for sequential I/O, looped I/O, fan-out, or a long runtime budget.",
        });
      };
      return {
        program: check,
        function_declaration: check,
        function_expression: check,
        arrow_function: check,
        generator_function: check,
      };
    },
  },
});
