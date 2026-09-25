/* eslint-disable no-await-in-loop -- Wire and verify each archive before executing the isolated consumer. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, mkdir, mkdtemp, symlink, writeFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const policy = JSON.parse(await readFile(path.join(root, "policy/compatibility.json"), "utf8"));
const archive = path.join(root, policy.localAgentlint.path);
assert.equal(
  `sha512-${createHash("sha512")
    .update(await readFile(archive))
    .digest("base64")}`,
  policy.localAgentlint.integrity,
);
const developmentEngine = await realpath(
  path.join(root, "packages/agentlint-plugin-core/node_modules/@aurelienbbn/agentlint"),
);
const developmentModules = path.dirname(path.dirname(developmentEngine));
const folder = await mkdtemp(path.join(tmpdir(), "harness-agentlint-current-"));
const domains = ["core", "effect", "shopify-app", "tanstack-query", "xstate"];
const presets = ["strictPreset", "strictPreset", "shopifyAppPreset", "strictPreset", "xstatePreset"];

function run(command, args, expected = 0) {
  try {
    const result = execFileSync(command, args, {
      cwd: folder,
      encoding: "utf8",
      windowsHide: true,
      timeout: 60_000,
      stdio: "pipe",
    });
    assert.equal(expected, 0, "Expected an unresolved gate");
    return result;
  } catch (error) {
    if (expected !== 0 && error.status === expected) {
      assert.equal(String(error.stderr), "");
      return String(error.stdout);
    }
    throw error;
  }
}

async function unpack(file, name) {
  const destination = path.join(folder, "node_modules", "@aurelienbbn", name);
  await mkdir(destination, { recursive: true });
  run("tar", ["-xf", file, "--strip-components", "1", "-C", destination]);
  return destination;
}

try {
  const engine = await unpack(archive, "agentlint");
  const manifest = JSON.parse(await readFile(path.join(engine, "package.json"), "utf8"));
  for (const [name, version] of Object.entries(manifest.dependencies)) {
    const source = await realpath(path.join(developmentModules, name));
    const installed = JSON.parse(await readFile(path.join(source, "package.json"), "utf8"));
    assert.equal(installed.version, version, `Local runtime differs from packed dependency: ${name}`);
    const target = path.join(engine, "node_modules", name);
    await mkdir(path.dirname(target), { recursive: true });
    await symlink(source, target, "junction");
  }
  const archives = await readdir(path.join(root, "local-packages"));
  for (const domain of domains) {
    const name = `agentlint-plugin-${domain}`;
    const files = archives.filter((file) => file.startsWith(`aurelienbbn-${name}-`) && file.endsWith(".tgz"));
    assert.equal(files.length, 1, `Expected one current archive for ${name}`);
    const target = await unpack(path.join(root, "local-packages", files[0]), name);
    const pluginManifest = JSON.parse(await readFile(path.join(target, "package.json"), "utf8"));
    for (const dependency of Object.keys(pluginManifest.dependencies ?? {})) {
      const source = await realpath(path.join(root, "packages", name, "node_modules", dependency));
      const destination = path.join(target, "node_modules", dependency);
      await mkdir(path.dirname(destination), { recursive: true });
      await symlink(source, destination, "junction");
    }
  }
  await writeFile(
    path.join(folder, "package.json"),
    '{"name":"agentlint-current-consumer","private":true,"type":"module"}',
  );
  await mkdir(path.join(folder, "node_modules/@types"), { recursive: true });
  await symlink(
    await realpath(path.join(root, "node_modules/@types/node")),
    path.join(folder, "node_modules/@types/node"),
    "junction",
  );
  const imports = domains
    .map(
      (domain, index) =>
        `import { ${presets[index]} as preset${index} } from "@aurelienbbn/agentlint-plugin-${domain}";`,
    )
    .join("\n");
  await writeFile(
    path.join(folder, "consumer.mts"),
    imports +
      `
import { defineConfig } from "@aurelienbbn/agentlint";
import { testRuleFixtures } from "@aurelienbbn/agentlint/testing";
const config=defineConfig({extends:[${domains.map((_, index) => `preset${index}`).join(",")}]});
for(const preset of config.extends) for(const rule of preset.rules) {
 const result=await testRuleFixtures(rule); if(result.failures.length)throw new Error(JSON.stringify(result));
}
`,
  );
  run(process.execPath, [
    path.join(root, "node_modules/typescript/bin/tsc"),
    "consumer.mts",
    "--noEmit",
    "--strict",
    "--module",
    "NodeNext",
    "--target",
    "ESNext",
  ]);
  run(process.execPath, ["consumer.mts"]);
  await writeFile(path.join(folder, ".gitignore"), "node_modules/\nconsumer.mts\n");
  run("git", ["init", "--quiet"]);
  run("git", [
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
  ]);
  await mkdir(path.join(folder, ".agentlint"));
  await mkdir(path.join(folder, "blocks"));
  await writeFile(
    path.join(folder, ".agentlint/config.ts"),
    imports + `\nexport default {extends:[${domains.map((_, index) => `preset${index}`).join(",")}]};`,
  );
  await writeFile(
    path.join(folder, "sample.ts"),
    'export interface IUser {id:string}\nfetch("/api"); useQuery({}); createActor(machine); const copy="Hurry!";',
  );
  const bin = path.join(engine, "dist/bin.mjs");
  const findings = run(process.execPath, [bin, "check", "sample.ts", "--base", "HEAD", "--format", "jsonl"], 1)
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.deepEqual(new Set(findings.map((finding) => finding.rule.id.split("/")[0])), new Set(domains));
  assert.ok(
    findings.every(
      (finding) =>
        finding.identity.fingerprint.scheme === "source-structure" && finding.identity.fingerprint.version === 3,
    ),
  );
  await rm(path.join(folder, ".agentlint/config.ts"));
  run(process.execPath, [
    bin,
    "init",
    ...domains.flatMap((domain) => ["--preset", `@aurelienbbn/agentlint-plugin-${domain}#starterPreset`]),
  ]);
  run(process.execPath, [bin, "rules", "test"]);
  const next = JSON.parse(run(process.execPath, [bin, "next", "--format", "json", "--base", "HEAD"], 1));
  assert.equal(next.version, 1);
  assert.equal(next.scope, "complete");
  assert.ok(next.remaining > 0);
  assert.equal(next.actions.at(-1).argv[0], "check");
  assert.equal(new Set(next.executedBindings).size, next.executedBindings.length);
  console.log(
    "Passed: explicit starter initialization and fixture validation; six packed archives, typed consumer, real parser fixtures and CLI across all five plugins, using the exact local runtime dependency graph. This is not a fresh registry installation.",
  );
} finally {
  assert.equal(path.dirname(path.resolve(folder)), path.resolve(tmpdir()));
  await rm(folder, { recursive: true, force: true });
}
