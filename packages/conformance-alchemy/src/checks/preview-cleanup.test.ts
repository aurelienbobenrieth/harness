import { describe, expect, it } from "vitest";
import { previewCleanup } from "./preview-cleanup.js";
import { createFixture } from "./test-support.js";

/** One workflow deploying on push and PR events and cleaning up on close, stage computed once in `env`. */
const sharedStage = `on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened, closed]
env:
  STAGE: \${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.number) || 'prod' }}
jobs:
  deploy:
    if: \${{ github.event.action != 'closed' }}
    runs-on: ubuntu-latest
    steps:
      - run: pnpm alchemy deploy --stage \${{ env.STAGE }} --yes
  cleanup:
    if: \${{ github.event.action == 'closed' }}
    runs-on: ubuntu-latest
    steps:
      - name: Refuse production
        run: |
          if [ "$STAGE" = "prod" ]; then
            exit 1
          fi
      - run: pnpm alchemy destroy --stage \${{ env.STAGE }} --yes
`;

function job(on: string, run: string, env = ""): string {
  return `on: ${on}
jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - run: ${run}
${env}`;
}

describe("preview-cleanup", () => {
  it("passes a shared stage expression guarded before destroy", async () => {
    const root = await createFixture({ ".github/workflows/deploy.yml": sharedStage });
    expect(await previewCleanup.run({ root })).toEqual([]);
  });

  it("passes a preview deploy paired with a pr- destroy in a separate closed workflow", async () => {
    const root = await createFixture({
      ".github/workflows/preview.yml": job("pull_request", "bunx alchemy deploy --stage pr-${{ github.event.number }}"),
      ".github/workflows/cleanup.yml": job(
        "\n  pull_request:\n    types: closed",
        "bunx alchemy destroy",
        "        env:\n          ALCHEMY_STAGE: pr-${{ github.event.number }}\n",
      ),
      ".github/workflows/prod.yml": job("push", "alchemy deploy --stage prod"),
    });
    expect(await previewCleanup.run({ root })).toEqual([]);
  });

  it("fails a preview deploy whose destroy never runs on close", async () => {
    const root = await createFixture({
      ".github/workflows/preview.yml": job("pull_request", "alchemy deploy --stage pr-${{ github.event.number }}"),
      ".github/workflows/cleanup.yml": job("pull_request", "alchemy destroy --stage pr-${{ github.event.number }}"),
    });
    const findings = await previewCleanup.run({ root });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.path).toBe(".github/workflows/preview.yml");
    expect(findings[0]?.message).toContain("types: [closed]");
  });

  it("fails a cleanup that destroys another stack", async () => {
    const root = await createFixture({
      ".github/workflows/preview.yml": job("pull_request", "cd apps/api && alchemy deploy --stage pr-$PR"),
      ".github/workflows/cleanup.yml": job(
        "\n  pull_request:\n    types: [closed]",
        "cd apps/web && alchemy destroy --stage pr-$PR",
      ),
    });
    const findings = await previewCleanup.run({ root });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("apps/api/alchemy.run.ts");
  });

  it("fails a destroy of a literal production stage and of an unguarded expression that can reach it", async () => {
    const root = await createFixture({
      ".github/workflows/teardown.yml": job("workflow_dispatch", "alchemy destroy --stage production"),
      ".github/workflows/deploy.yml": sharedStage.replace(/- name: Refuse production[\s\S]*?fi\n/u, ""),
    });
    const findings = await previewCleanup.run({ root });
    expect(findings.map((finding) => [finding.path, finding.severity])).toEqual([
      [".github/workflows/deploy.yml", "error"],
      [".github/workflows/teardown.yml", "error"],
    ]);
    expect(findings[0]?.message).toContain("can resolve to production");
    expect(findings[1]?.message).toContain("destroys stage production");
  });

  it("appends arguments forwarded to a package script before reading the stage", async () => {
    const root = await createFixture({
      "package.json": JSON.stringify({ scripts: { deploy: "alchemy deploy", destroy: "alchemy destroy" } }),
      ".github/workflows/preview.yml": job(
        "pull_request",
        "|\n          bun run deploy --stage pr-${{ github.event.number }}\n          npm run deploy -- --stage pr-2",
      ),
      ".github/workflows/teardown.yml": job("workflow_dispatch", "pnpm run destroy --stage prod"),
    });
    const findings = await previewCleanup.run({ root });
    expect(findings.map((finding) => finding.path)).toEqual([
      ".github/workflows/preview.yml",
      ".github/workflows/preview.yml",
      ".github/workflows/teardown.yml",
    ]);
    expect(findings[2]?.message).toContain("destroys stage prod");
  });

  it("accepts an allow-list guard that exits unless the stage starts with pr-", async () => {
    const guard = `run: |
          case "$STAGE" in
            pr-*) ;;
            *) exit 1 ;;
          esac`;
    const root = await createFixture({
      ".github/workflows/deploy.yml": sharedStage.replace(
        /name: Refuse production\n\s+run: \|[\s\S]*?fi\n/u,
        `${guard}\n`,
      ),
    });
    expect(await previewCleanup.run({ root })).toEqual([]);
  });

  it("does not report a missing cleanup as an error when a closing workflow runs a script it cannot resolve", async () => {
    const root = await createFixture({
      ".github/workflows/preview.yml": job("pull_request", "alchemy deploy --stage pr-${{ github.event.number }}"),
      ".github/workflows/cleanup.yml": job("\n  pull_request:\n    types: [closed]", "cd $APP && pnpm run teardown"),
    });
    const findings = await previewCleanup.run({ root });
    expect(findings.map((finding) => [finding.path, finding.evaluation])).toEqual([
      [".github/workflows/cleanup.yml", "unsupported"],
      [".github/workflows/preview.yml", "unsupported"],
    ]);
  });

  it("reports a missing workflows directory as unsupported evidence", async () => {
    const root = await createFixture({ "alchemy.run.ts": "" });
    expect(await previewCleanup.run({ root, workflowsDir: "ci" })).toMatchObject([
      { severity: "warning", evaluation: "unsupported" },
    ]);
  });
});
