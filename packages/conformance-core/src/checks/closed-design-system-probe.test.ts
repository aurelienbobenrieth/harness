import { expect, it } from "vitest";
import { closedDesignSystemProbe } from "./closed-design-system-probe.js";
import { createFixture } from "./test-support.js";

function writeCssCommand(css: string): readonly string[] {
  return ["node", "-e", `require("node:fs").writeFileSync(process.argv[1], ${JSON.stringify(css)})`, "{output}"];
}

it("is skipped entirely when the closedDesignSystem option is unset", async () => {
  const root = await createFixture({});

  expect(await closedDesignSystemProbe.run({ root })).toEqual([]);
});

it("passes when required selectors are present and forbidden selectors are absent", async () => {
  const root = await createFixture({ "styles/theme.css": "@import 'tokens';" });

  const findings = await closedDesignSystemProbe.run({
    root,
    closedDesignSystem: {
      stylesheet: "styles/theme.css",
      buildCommand: writeCssCommand(".btn{color:red}.card{padding:1rem}"),
      requiredSelectors: [".btn", ".card"],
      forbiddenSelectors: [".mt-4", ".text-red-500"],
    },
  });

  expect(findings).toEqual([]);
});

it("fails when a required token selector is absent", async () => {
  const root = await createFixture({ "styles/theme.css": "@import 'tokens';" });

  const findings = await closedDesignSystemProbe.run({
    root,
    closedDesignSystem: {
      stylesheet: "styles/theme.css",
      buildCommand: writeCssCommand(".btn{color:red}"),
      requiredSelectors: [".btn", ".card"],
      forbiddenSelectors: [],
    },
  });

  expect(findings).toHaveLength(1);
  expect(findings[0]?.severity).toBe("error");
  expect(findings[0]?.message).toContain('".card"');
  expect(findings[0]?.message).toContain("required token selector absent");
});

it("fails when a default utility leaks into the built CSS", async () => {
  const root = await createFixture({ "styles/theme.css": "@import 'tokens';" });

  const findings = await closedDesignSystemProbe.run({
    root,
    closedDesignSystem: {
      stylesheet: "styles/theme.css",
      buildCommand: writeCssCommand(".btn{color:red}.mt-4{margin-top:1rem}"),
      requiredSelectors: [".btn"],
      forbiddenSelectors: [".mt-4"],
    },
  });

  expect(findings).toHaveLength(1);
  expect(findings[0]?.severity).toBe("error");
  expect(findings[0]?.message).toContain('".mt-4"');
  expect(findings[0]?.message).toContain("default utility leaked");
});

it("reports a build failure with a stderr excerpt", async () => {
  const root = await createFixture({ "styles/theme.css": "@import 'tokens';" });

  const findings = await closedDesignSystemProbe.run({
    root,
    closedDesignSystem: {
      stylesheet: "styles/theme.css",
      buildCommand: ["node", "-e", "console.error('boom: tailwind missing'); process.exit(1);"],
      requiredSelectors: [".btn"],
      forbiddenSelectors: [],
    },
  });

  expect(findings).toHaveLength(1);
  expect(findings[0]?.severity).toBe("error");
  expect(findings[0]?.message).toContain("build failed");
  expect(findings[0]?.message).toContain("boom: tailwind missing");
});

it("reports a build that exits cleanly without producing output", async () => {
  const root = await createFixture({ "styles/theme.css": "@import 'tokens';" });

  const findings = await closedDesignSystemProbe.run({
    root,
    closedDesignSystem: {
      stylesheet: "styles/theme.css",
      buildCommand: ["node", "-e", "process.exit(0);"],
      requiredSelectors: [".btn"],
      forbiddenSelectors: [],
    },
  });

  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("produced no output");
});
