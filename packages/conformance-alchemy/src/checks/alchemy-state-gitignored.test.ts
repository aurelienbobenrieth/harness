import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { alchemyStateIgnored, isIgnored, parseGitignore } from "../gitignore.js";
import { alchemyStateGitignored } from "./alchemy-state-gitignored.js";
import { createFixture, initGit, stack } from "./test-support.js";

const run = (root: string, stackFiles?: readonly string[]) =>
  alchemyStateGitignored.run({ root, ...(stackFiles === undefined ? {} : { stackFiles }) });

describe("alchemy-state-gitignored, from .gitignore files", () => {
  it("passes when the root .gitignore ignores .alchemy/ for a nested stack", async () => {
    const root = await createFixture({
      ".gitignore": "node_modules/\n.alchemy/\n",
      "apps/api/alchemy.run.ts": stack("localState()"),
    });
    expect(await run(root)).toEqual([]);
  });

  it("passes with a nested .gitignore and glob forms git accepts", async () => {
    const root = await createFixture({
      "apps/api/.gitignore": ".alchemy\n",
      "apps/web/.gitignore": "/.alchemy/**\n",
      "apps/api/alchemy.run.ts": stack("localState()"),
      "apps/web/alchemy.run.ts": stack("localState()"),
    });
    expect(await run(root)).toEqual([]);
  });

  it("fails a stack directory without an ignore rule", async () => {
    const root = await createFixture({ ".gitignore": "dist/\n", "alchemy.run.ts": stack("localState()") });
    const findings = await run(root);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("error");
    expect(findings[0]?.path).toBe(".gitignore");
  });

  it("fails when a nested negation re-includes state, or a root-anchored rule misses the nested stack", async () => {
    const root = await createFixture({
      ".gitignore": "/.alchemy/\n",
      "alchemy.run.ts": stack("localState()"),
      "apps/api/alchemy.run.ts": stack("localState()"),
      "apps/web/.gitignore": ".alchemy/\n!.alchemy/\n",
      "apps/web/alchemy.run.ts": stack("localState()"),
    });
    const findings = await run(root);
    expect(findings.map((finding) => finding.message.split(" ")[0])).toEqual([
      "apps/api/.alchemy/",
      "apps/web/.alchemy/",
    ]);
  });

  it("reads stackFiles globs and fails when none match", async () => {
    const root = await createFixture({ ".gitignore": ".alchemy/\n", "stacks/github.ts": stack("localState()") });
    expect(await run(root, ["stacks/*.ts"])).toEqual([]);
    expect(await run(root)).toMatchObject([{ severity: "error", evaluation: "failed" }]);
    await expect(run(root, ["../outside/*.ts"])).rejects.toThrow("inside the project");
    await expect(run(root, [])).rejects.toThrow("at least one glob");
  });
});

describe("alchemy-state-gitignored, from git", () => {
  it("passes on a committed rule and ignores node_modules stacks", async () => {
    const root = await createFixture({
      ".gitignore": ".alchemy/\n",
      "alchemy.run.ts": stack("localState()"),
      "node_modules/pkg/alchemy.run.ts": stack("localState()"),
    });
    initGit(root);
    expect(await run(root)).toEqual([]);
  });

  it("fails a rule that lives only in .git/info/exclude, and state that is already committed", async () => {
    const root = await createFixture({
      "alchemy.run.ts": stack("localState()"),
      ".alchemy/state/App/dev/Worker.json": "{}",
    });
    initGit(root, [".alchemy/state/App/dev/Worker.json"]);
    await mkdir(path.join(root, ".git/info"), { recursive: true });
    await writeFile(path.join(root, ".git/info/exclude"), ".alchemy/\n");
    const findings = await run(root);
    expect(findings).toHaveLength(2);
    expect(findings[0]?.message).toContain("is committed");
    expect(findings[1]?.message).toContain(".git/info/exclude, which is not committed");
  });

  it("agrees with the .gitignore reader on the same tree", async () => {
    const root = await createFixture({ ".gitignore": "*.log\n", "apps/a/.gitignore": ".alchemy/*\n" });
    initGit(root);
    const directories = ["", "apps/a"];
    const git = await alchemyStateIgnored(root, directories);
    const files = await alchemyStateIgnored(root, directories, false);
    expect(git.method).toBe("git");
    expect(files.method).toBe("gitignore-files");
    expect(git.verdicts.map((verdict) => verdict.ignored)).toEqual(files.verdicts.map((verdict) => verdict.ignored));
    expect(files.verdicts.map((verdict) => verdict.ignored)).toEqual([false, true]);
  });
});

describe("gitignore pattern reader", () => {
  it("follows git's anchoring, wildcard, escape and parent-exclusion rules", () => {
    const rules = parseGitignore("# comment\n\\#literal\nbuild/**/cache\n[.]alchemy?\n", "");
    expect(isIgnored(rules, "build/cache")).toBe(true);
    expect(isIgnored(rules, "build/a/b/cache")).toBe(true);
    expect(isIgnored(rules, "x/.alchemyz")).toBe(true);
    expect(isIgnored(rules, "#literal/state")).toBe(true);
    expect(isIgnored(rules, "src/cache")).toBe(false);
    expect(isIgnored([...parseGitignore("out/\n", ""), ...parseGitignore("!out\n", "")], "out/.alchemy")).toBe(false);
    expect(isIgnored([...parseGitignore("out\n", ""), ...parseGitignore("!.alchemy\n", "out")], "out/.alchemy")).toBe(
      true,
    );
  });
});
