import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-theme/no-external-dependencies";

it("reports external package imports", async () => {
  await expect(
    assertRuleReports(ruleName, 'import dayjs from "dayjs";\nexport const now = dayjs();\n'),
  ).resolves.toBeUndefined();
});

it("ignores relative imports", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'import { formatMoney } from "./money.js";\nexport { formatMoney };\n'),
  ).resolves.toBeUndefined();
});

it("reports lit imports when not allowed", async () => {
  await expect(
    assertRuleReports(ruleName, 'import { LitElement } from "lit";\nexport class Card extends LitElement {}\n'),
  ).resolves.toBeUndefined();
});

it("ignores allowlisted packages and their subpaths", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { LitElement } from "lit";\nimport { Task } from "@lit/task";\nimport { setup } from "xstate";\nexport { LitElement, Task, setup };\n',
      { ruleOptions: { allow: ["lit", "@lit", "xstate"] } },
    ),
  ).resolves.toBeUndefined();
});

it("ignores theme alias imports", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { Component } from "@theme/component";\nexport class Card extends Component {}\n',
    ),
  ).resolves.toBeUndefined();
});
