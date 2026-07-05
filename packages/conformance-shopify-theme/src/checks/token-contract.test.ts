import { expect, it } from "vitest";
import { createFixture } from "./test-support.js";
import { tokenContract } from "./token-contract.js";

it("passes when emitted and consumed tokens match", async () => {
  const root = await createFixture({
    "snippets/theme-tokens.liquid": ":root { --theme-space-2: {{ settings.space | times: 2 }}px; }",
    "frontend/entrypoints/styles.css": ".price { padding: var(--theme-space-2); }",
  });
  expect(await tokenContract.run({ root })).toEqual([]);
});

it("reports consumed tokens that are never emitted", async () => {
  const root = await createFixture({
    "snippets/theme-tokens.liquid": ":root { --theme-space-2: 8px; }",
    "frontend/entrypoints/styles.css": ".price { color: var(--scheme-text); }",
  });
  const findings = await tokenContract.run({ root });
  expect(findings.map((finding) => `${finding.severity} ${finding.message}`)).toEqual([
    expect.stringContaining("error --scheme-text is consumed"),
    expect.stringContaining("warning --theme-space-2 is emitted"),
  ]);
});
