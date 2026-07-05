import path from "node:path";
import { Effect } from "effect";
import { fileSize, listDirectory } from "../../shared/fs-support.js";
import { BudgetCommand, BudgetResult } from "./request.js";

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[\\w.-]*");
  return new RegExp(`^${escaped}$`);
}

export const budgetHandler = Effect.fn("budgetHandler")(function* (command: BudgetCommand) {
  const budgets = command.budgets.map((budget) => ({ ...budget, regexp: patternToRegExp(budget.pattern) }));
  const lines: string[] = [];
  let overBudget = 0;

  for (const entry of yield* Effect.promise(() => listDirectory(path.join(command.root, "assets")))) {
    const matching = budgets
      .filter((budget) => budget.regexp.test(entry))
      .toSorted((a, b) => b.pattern.length - a.pattern.length)[0];
    if (matching === undefined) continue;
    const size = yield* Effect.promise(() => fileSize(path.join(command.root, "assets", entry)));
    const status = size > matching.maxBytes ? "OVER" : "ok";
    if (size > matching.maxBytes) overBudget += 1;
    lines.push(`${status.padEnd(5)} assets/${entry} ${size}B / ${matching.maxBytes}B (${matching.pattern})`);
  }

  lines.push(overBudget === 0 ? "all assets within budget" : `${overBudget} asset(s) over budget`);
  return new BudgetResult({ lines, exitCode: overBudget === 0 ? 0 : 1 });
});
