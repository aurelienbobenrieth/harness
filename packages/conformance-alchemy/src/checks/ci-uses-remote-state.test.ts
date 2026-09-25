import { describe, expect, it } from "vitest";
import { ciUsesRemoteState } from "./ci-uses-remote-state.js";
import { createFixture, stack } from "./test-support.js";

function workflow(run: string, extra = ""): string {
  return `name: deploy
on:
  push:
    branches: [main]
${extra}jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - name: Deploy
        run: ${run}
`;
}

describe("ci-uses-remote-state", () => {
  it("passes a CI deploy of a stack on Cloudflare.state(), and workflows without deploys", async () => {
    const root = await createFixture({
      "alchemy.run.ts": stack("Cloudflare.state()", ""),
      ".github/workflows/deploy.yml": workflow("pnpm alchemy deploy --stage prod --yes"),
      ".github/workflows/ci.yml": workflow("pnpm test && pnpm alchemy plan"),
    });
    expect(await ciUsesRemoteState.run({ root })).toEqual([]);
  });

  it("fails every package-manager form that deploys a localState() stack", async () => {
    const root = await createFixture({
      "alchemy.run.ts": stack("localState()"),
      ".github/workflows/deploy.yml": workflow(`|
          alchemy deploy --stage prod
          bunx alchemy@2.0.0-beta.79 deploy
          npx --yes alchemy deploy
          pnpm exec alchemy deploy
          CI=true yarn alchemy deploy --stage=prod
          bun x alchemy destroy --stage pr-1`),
    });
    const findings = await ciUsesRemoteState.run({ root });
    expect(findings).toHaveLength(6);
    expect(findings.every((finding) => finding.severity === "error")).toBe(true);
    expect(findings[0]?.message).toContain("deploy › Deploy: `alchemy deploy --stage prod`");
  });

  it("resolves a package.json script one level, a working directory, cd, -C and --filter", async () => {
    const root = await createFixture({
      "package.json": JSON.stringify({ name: "root", workspaces: ["apps/*"] }),
      "apps/api/package.json": JSON.stringify({ name: "@app/api", scripts: { ship: "alchemy deploy --stage prod" } }),
      "apps/api/alchemy.run.ts": stack("Alchemy.localState()", ""),
      ".github/workflows/deploy.yml": `on: push
defaults:
  run:
    working-directory: apps
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm --filter @app/api ship
      - run: cd api && npm run ship
      - run: pnpm -C api alchemy deploy
      - working-directory: apps/api
        run: pnpm run ship
      - run: npm run ship
`,
    });
    const findings = await ciUsesRemoteState.run({ root });
    expect(findings.map((finding) => finding.severity)).toEqual(["error", "error", "error", "error"]);
  });

  it("resolves workspace runner forms that pick the script's package deterministically", async () => {
    const root = await createFixture({
      "package.json": JSON.stringify({
        name: "root",
        workspaces: ["apps/*"],
        scripts: { ship: "pnpm --filter backend run deploy" },
      }),
      "apps/backend/package.json": JSON.stringify({ name: "backend", scripts: { deploy: "alchemy deploy" } }),
      "apps/backend/alchemy.run.ts": stack("localState()"),
      "apps/web/package.json": JSON.stringify({ name: "web", scripts: { build: "vite build" } }),
      ".github/workflows/deploy.yml": workflow(`|
          pnpm --filter "./apps/*" run deploy
          bun run --cwd apps/backend deploy
          npm run deploy -w apps/backend
          npm run deploy --workspace=backend
          yarn workspace backend deploy
          pnpm -r run deploy
          pnpm run ship`),
    });
    const findings = await ciUsesRemoteState.run({ root });
    expect(findings.map((finding) => [finding.severity, finding.evaluation])).toEqual(
      Array.from({ length: 7 }, () => ["error", undefined]),
    );
  });

  it("reports script runs whose package, manifest or runner form it cannot resolve as unsupported, never drops them", async () => {
    const root = await createFixture({
      "package.json": JSON.stringify({
        name: "root",
        workspaces: ["apps/*"],
        scripts: { a: "pnpm run b", b: "pnpm run c", c: "alchemy deploy" },
      }),
      "apps/backend/package.json": JSON.stringify({ name: "backend", scripts: { deploy: "alchemy deploy" } }),
      "apps/backend/alchemy.run.ts": stack("localState()"),
      ".github/workflows/deploy.yml": `on: push
jobs:
  matrix:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: \${{ matrix.app }}
    steps:
      - run: pnpm run deploy
  dynamic:
    runs-on: ubuntu-latest
    steps:
      - run: cd $APP_DIR && pnpm run deploy
      - run: pnpm --filter backend... run deploy
      - run: yarn workspaces foreach run deploy
      - run: pnpm install && pnpm lint
      - run: pnpm run a
`,
    });
    const findings = await ciUsesRemoteState.run({ root });
    expect(findings).toHaveLength(5);
    expect(findings[4]?.message).toContain("nested more than 2 scripts deep");
    expect(findings.every((finding) => finding.evaluation === "unsupported")).toBe(true);
    expect(findings[0]?.message).toContain("`pnpm run deploy`");
  });

  it("follows --config to another stack file and a top-level const, and warns on a CI switch", async () => {
    const root = await createFixture({
      "alchemy.run.ts": stack("Cloudflare.state()", ""),
      "stacks/github.ts": stack("store", 'import { localState as local } from "alchemy";\nconst store = local();'),
      "stacks/switch.ts": stack("process.env.CI ? Cloudflare.state() : localState()"),
      ".github/workflows/deploy.yml": workflow(`|
          alchemy deploy --config stacks/github.ts
          alchemy deploy stacks/switch.ts
          alchemy deploy`),
    });
    const findings = await ciUsesRemoteState.run({ root });
    expect(findings.map((finding) => [finding.severity, /`([^`]+)`/u.exec(finding.message)?.[1]])).toEqual([
      ["error", "alchemy deploy --config stacks/github.ts"],
      ["warning", "alchemy deploy stacks/switch.ts"],
    ]);
  });

  it("reports unresolvable or unrecognized evidence as unsupported, never as a pass", async () => {
    const root = await createFixture({
      "alchemy.run.ts": stack("makeState()", ""),
      ".github/workflows/deploy.yml": workflow(`|
          cd "$APP_DIR" && alchemy deploy
          alchemy deploy --config missing.ts
          alchemy deploy`),
    });
    const findings = await ciUsesRemoteState.run({ root });
    expect(findings).toHaveLength(3);
    expect(findings.every((finding) => finding.evaluation === "unsupported")).toBe(true);
    const empty = await createFixture({ "alchemy.run.ts": stack("localState()") });
    expect(await ciUsesRemoteState.run({ root: empty })).toMatchObject([{ evaluation: "unsupported" }]);
  });

  it("fails on unparseable workflows and stack files", async () => {
    const root = await createFixture({
      "alchemy.run.ts": "export default Alchemy.Stack(",
      ".github/workflows/broken.yaml": "jobs: [",
      ".github/workflows/deploy.yml": workflow("alchemy deploy"),
    });
    const findings = await ciUsesRemoteState.run({ root, workflowsDir: ".github/workflows/" });
    expect(findings.map((finding) => [finding.path, finding.evaluation])).toEqual([
      [".github/workflows/broken.yaml", "failed"],
      ["alchemy.run.ts", "failed"],
    ]);
  });
});
