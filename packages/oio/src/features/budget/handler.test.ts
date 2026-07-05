import { Effect } from "effect";
import { expect, it } from "vitest";
import { createFixture } from "../test-support.js";
import { budgetHandler } from "./handler.js";
import { BudgetCommand } from "./request.js";

it("passes assets within budget", async () => {
  const root = await createFixture({ "assets/cart.js": "tiny" });
  const result = await Effect.runPromise(
    budgetHandler(new BudgetCommand({ root, budgets: [{ pattern: "*.js", maxBytes: 100 }] })),
  );
  expect(result.exitCode).toBe(0);
});

it("fails assets over budget", async () => {
  const root = await createFixture({ "assets/cart.js": "x".repeat(200) });
  const result = await Effect.runPromise(
    budgetHandler(new BudgetCommand({ root, budgets: [{ pattern: "*.js", maxBytes: 100 }] })),
  );
  expect(result.exitCode).toBe(1);
  expect(result.lines.join("\n")).toContain("OVER");
});
