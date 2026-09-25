import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("runs the built rule exports through the actual draft agentlint TSX parser", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "harness-shopify-agent-review-"));
  try {
    await mkdir(path.join(root, ".agentlint"));
    const plugin = new URL("../dist/index.mjs", import.meta.url).href;
    await writeFile(
      path.join(root, ".agentlint/config.ts"),
      `
import { shopifyAppPreset, defineAppUxReview } from ${JSON.stringify(plugin)};
export default {
  rules: [
    ...shopifyAppPreset.rules,
    defineAppUxReview({ targets: [
      { filenamePattern: /home\\.tsx$/, areas: ["home"] },
      { filenamePattern: /sidekick\\.ts$/, areas: ["sidekick"], trigger: "file" },
    ] }),
  ],
};
`,
    );
    await writeFile(
      path.join(root, "home.tsx"),
      `
export const Home = () => <s-page>
  <s-banner dismissible heading="Import complete" />
  <s-text-field label="Postal code" error={error} />
  <s-button tone={"critical"}>Delete saved search</s-button>
  <s-modal heading="Confirm archive" />
  <s-button>{"Yes"}</s-button>
  <s-paragraph>Leave a review</s-paragraph>
  <form title="SaveBar" />
  <s-page />
</s-page>;
`,
    );
    await writeFile(path.join(root, "sidekick.ts"), "export const intent = { name: 'find-delayed-shipments' };");
    await writeFile(
      path.join(root, "clean.tsx"),
      `
const text = '<s-banner tone="critical">Yes</s-banner>';
export const Clean = () => <s-page>
  <s-text-field label="Postal code" error="" />
  <s-button tone="neutral">Archive saved search</s-button>
  <s-paragraph>Review product details</s-paragraph>
  <form data-save-bar />
</s-page>;
`,
    );
    const executable = fileURLToPath(new URL("./bin.mjs", import.meta.resolve("@aurelienbbn/agentlint")));
    const reviewed = spawnSync(
      process.execPath,
      [executable, "check", "home.tsx", "sidekick.ts", "clean.tsx", "--format", "jsonl"],
      {
        cwd: root,
        windowsHide: true,
        encoding: "utf8",
        timeout: 20_000,
      },
    );
    expect(reviewed.error).toBeUndefined();
    expect({ status: reviewed.status, stderr: reviewed.stderr }).toEqual({ status: 1, stderr: "" });
    const findings = reviewed.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { rule: { id: string }; location: { file: string; line: number } });
    expect(findings.map((finding) => finding.rule.id).toSorted()).toEqual([
      "shopify-app/action-label-clarity",
      "shopify-app/app-ux-review",
      "shopify-app/app-ux-review",
      "shopify-app/banner-usage",
      "shopify-app/destructive-action-review",
      "shopify-app/form-error-recovery",
      "shopify-app/modal-workflow-review",
      "shopify-app/review-solicitation",
      "shopify-app/settings-save-bar",
    ]);
    expect(findings.some((finding) => finding.location.file.endsWith("clean.tsx"))).toBe(false);
    expect(findings.every((finding) => finding.location.line > 0)).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);
