import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineTestExercisesProjectCode, testExercisesProjectCode } from "./rule.js";

const message =
  "Test file imports nothing from the project, so it exercises a copy or a third-party library; import the real subject, or label the test as a black-box or learning test.";
const vitest = 'import { expect, it, test } from "vitest";\n';
const body = 'it("slugifies", () => {\n  expect(slugify("Hello World")).toBe("hello-world");\n});\n';

async function messages(source: string, file = "src/slugify.test.ts", rule = testExercisesProjectCode) {
  return (await testRuleOnSource(rule, source, file)).map((finding) => finding.message);
}

it("reports a test whose subject is declared in the test file, on the first test call", async () => {
  const source = `${vitest}function slugify(title: string) { return title.toLowerCase().replaceAll(" ", "-"); }\n${body}${body}`;
  const findings = await testRuleOnSource(testExercisesProjectCode, source, "src/slugify.test.ts");
  expect(findings.map((finding) => [finding.line, finding.message])).toEqual([[3, message]]);
});

it("reports a test that only exercises a third-party library", async () => {
  expect(
    await messages(
      `${vitest}import { z } from "zod";\ntest.each([1, 2])("parses %s", (value) => {\n  expect(z.number().parse(value)).toBe(value);\n});\n`,
    ),
  ).toEqual([message]);
});

it("stays silent when the project is imported statically, dynamically, or through require and importActual", async () => {
  expect(await messages(`${vitest}import { slugify } from "./slugify.js";\n${body}`)).toEqual([]);
  expect(
    await messages(
      `${vitest}it("loads", async () => {\n  const { y } = await import("../src/y");\n  expect(y).toBe(1);\n});\n`,
    ),
  ).toEqual([]);
  expect(await messages(`${vitest}const { slugify } = require("../slugify");\n${body}`)).toEqual([]);
  expect(
    await messages(
      `${vitest}it("keeps the real one", async () => {\n  const real = await vi.importActual("./slugify.js");\n  expect(real).toBeDefined();\n});\n`,
    ),
  ).toEqual([]);
  expect(await messages(`${vitest}export * from "./shared-cases.js";\n${body}`)).toEqual([]);
});

it("stays silent on aliases, black-box drivers, type tests and files without tests", async () => {
  expect(await messages(`${vitest}import { run } from "@/cli";\n${body}`)).toEqual([]);
  expect(await messages(`${vitest}import { slugify } from "#text/slugify";\n${body}`)).toEqual([]);
  expect(await messages(`${vitest}import { execFileSync } from "node:child_process";\n${body}`)).toEqual([]);
  expect(
    await messages(`${vitest}it("answers", async () => {\n  expect((await fetch(url)).status).toBe(200);\n});\n`),
  ).toEqual([]);
  expect(await messages(`${vitest}import { z } from "zod";\nexport const cases = [z.string()];\n`)).toEqual([]);
  expect(await messages(`${vitest}${body}`, "src/slugify.ts")).toEqual([]);
  expect(testExercisesProjectCode.binding.exclude).toEqual(["**/*.d.ts", "**/*.test-d.ts"]);
  expect(await messages(`${vitest}${body}`, "src/slugify.test-d.ts")).toEqual([]);
});

it("does not mistake scoped or dotted package names for project code", async () => {
  expect(await messages(`${vitest}import { render } from "@testing-library/react";\n${body}`)).toEqual([message]);
  expect(await messages(`${vitest}import dots from ".dotfile-package";\n${body}`)).toEqual([message]);
});

it("honours workspace packages, custom aliases and black-box lists, and mirrors them into the binding", async () => {
  const source = `${vitest}import { slugify } from "@acme/text/slugify";\n${body}`;
  const rule = defineTestExercisesProjectCode({
    workspacePackages: ["@acme/text"],
    projectImportPattern: /^app\//g,
    blackBoxModules: ["msw"],
  });
  expect(await messages(source)).toEqual([message]);
  expect(await messages(source, "src/a.test.ts", rule)).toEqual([]);
  expect(await messages(`${vitest}import { slugify } from "@acme/textual";\n${body}`, "src/a.test.ts", rule)).toEqual([
    message,
  ]);
  const aliased = `${vitest}import { slugify } from "app/slugify";\n${body}`;
  expect(await messages(aliased, "src/a.test.ts", rule)).toEqual([]);
  expect(await messages(aliased, "src/a.test.ts", rule)).toEqual([]);
  expect(await messages(`${vitest}import { setupServer } from "msw";\n${body}`, "src/a.test.ts", rule)).toEqual([]);
  expect(await messages(`${vitest}import { execa } from "execa";\n${body}`, "src/a.test.ts", rule)).toEqual([message]);
  expect(rule.binding.options).toEqual({
    projectImportPattern: { source: "^app\\/", flags: "g" },
    workspacePackages: ["@acme/text"],
    blackBoxModules: ["msw"],
  });
});
