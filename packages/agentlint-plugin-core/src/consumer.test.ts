import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";

it("runs published agent presets against real TypeScript and Liquid parser nodes", async () => {
  const workspace = path.resolve(import.meta.dirname, "../../..");
  const directory = await mkdtemp(path.join(tmpdir(), "harness-agent-consumer-"));
  const packageUrl = (name: string): string =>
    pathToFileURL(path.join(workspace, "packages", name, "dist/index.mjs")).href;
  const files: Record<string, string> = {
    ".agentlint/config.ts": `import { strictPreset as core } from ${JSON.stringify(packageUrl("agentlint-plugin-core"))};
import { strictPreset as effect } from ${JSON.stringify(packageUrl("agentlint-plugin-effect"))};
import { strictPreset as query } from ${JSON.stringify(packageUrl("agentlint-plugin-tanstack-query"))};
import { xstatePreset as xstate } from ${JSON.stringify(packageUrl("agentlint-plugin-xstate"))};
import { shopifyAppPreset as app } from ${JSON.stringify(packageUrl("agentlint-plugin-shopify-app"))};
export default { rules: [...core.rules, ...effect.rules, ...query.rules, ...xstate.rules, ...app.rules] };`,
    "locales/en.json": '{"button":"CLICK HERE"}',
    "sample.ts":
      'export interface IUser { id: string }\nexport type Order = { id: string };\nfetch("/unbounded"); class Card extends LitElement {} useQuery({}); createActor(machine); const copy = "Hurry!";',
    "blocks/card.liquid": "<oio-card><button>Show</button></oio-card>",
    "snippets/card.liquid": "{% doc %}A card.{% enddoc %}<div>CLICK HERE</div>",
    "valid.ts": "interface Local { id: string }; export const id = 1;",
    "blocks/valid.liquid": '<oio-card><form action="/cart"><button>Add</button></form></oio-card>',
    "snippets/valid.liquid": "{% doc %}Card. @example {% render 'card', title: 'Cart' %}{% enddoc %}<span>Cart</span>",
  };
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: directory, windowsHide: true });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.test",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--allow-empty",
        "-qm",
        "baseline",
      ],
      { cwd: directory, windowsHide: true },
    );
    await Promise.all(
      Object.entries(files).map(async ([file, content]) => {
        const target = path.join(directory, file);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, content);
      }),
    );
    const executable = path.join(
      workspace,
      "packages/agentlint-plugin-core/node_modules/@aurelienbbn/agentlint/dist/bin.mjs",
    );
    let output: string;
    try {
      output = execFileSync(
        process.execPath,
        [
          executable,
          "check",
          "sample.ts",
          "locales/en.json",
          "blocks/card.liquid",
          "snippets/card.liquid",
          "valid.ts",
          "blocks/valid.liquid",
          "snippets/valid.liquid",
          "--base",
          "HEAD",
          "--format",
          "jsonl",
        ],
        { cwd: directory, encoding: "utf8", timeout: 20_000, windowsHide: true },
      );
    } catch (error) {
      if (
        typeof error !== "object" ||
        error === null ||
        !("status" in error) ||
        error.status !== 1 ||
        !("stdout" in error) ||
        !("stderr" in error)
      )
        throw error;
      assert.equal(String(error.stderr), "");
      output = String(error.stdout);
    }
    const findings = output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { rule: { id: string }; location: { file: string; line: number } });
    expect(findings.map((finding) => finding.rule.id)).toEqual(
      expect.arrayContaining([
        "core/boundary-resilience",
        "tanstack-query/query-state-coverage",
        "xstate/actor-cleanup",
        "shopify-app/no-pressure-copy",
        "effect/prefer-schema-contracts",
      ]),
    );
    expect(findings.filter((finding) => finding.location.file.includes("valid."))).toEqual([]);
    expect(findings.every((finding) => finding.location.line > 0)).toBe(true);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
}, 30_000);
