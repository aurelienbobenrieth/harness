/* eslint-disable no-await-in-loop -- Install and validate one isolated, explicitly selected toolchain at a time. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { validateConsumerResults } from "./consumer-results.mjs";

const execute = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const policy = JSON.parse(await readFile(path.join(root, "policy/compatibility.json"), "utf8"));
const releasePolicy = JSON.parse(await readFile(path.join(root, "policy/release.json"), "utf8"));
const profile = process.argv[2] ?? "baseline";
assert.ok(Object.hasOwn(policy.profiles, profile), `Unknown compatibility profile: ${profile}`);
assert.ok(process.argv.length <= 3, "Usage: pnpm test:compatibility [baseline|current]");
const packageManager = process.env.npm_execpath;
assert.ok(packageManager, "Run with pnpm test:compatibility [baseline|current]");
const temporary = await mkdtemp(path.join(tmpdir(), "harness-registry-consumer-"));
const archives = path.join(temporary, "archives");
const consumer = path.join(temporary, "consumer");
async function run(args, cwd = consumer) {
  try {
    return await execute(process.execPath, args, {
      cwd,
      windowsHide: true,
      timeout: 240_000,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(`Compatibility command failed: ${args.join(" ")}\n${error.stdout ?? ""}\n${error.stderr ?? ""}`, {
      cause: error,
    });
  }
}

try {
  await mkdir(archives);
  await mkdir(consumer);
  const packages = [];
  for (const directory of (await readdir(path.join(root, "packages"))).toSorted()) {
    const manifest = JSON.parse(await readFile(path.join(root, "packages", directory, "package.json"), "utf8"));
    assert.ok(Object.hasOwn(releasePolicy.packages, manifest.name), `${manifest.name}: record release maturity`);
    if (releasePolicy.packages[manifest.name] === "candidate") packages.push(manifest);
  }
  assert.ok(packages.length > 0, "The registry compatibility suite must exercise release candidates");
  console.log(`Testing registry ${profile}: ${JSON.stringify(policy.profiles[profile])}`);
  await run(
    [
      packageManager,
      ...packages.flatMap((manifest) => ["--filter", manifest.name]),
      "--config.ignore-scripts=true",
      "pack",
      "--pack-destination",
      archives,
    ],
    root,
  );
  const dependencies = { ...policy.sharedDependencies, ...policy.profiles[profile] };
  for (const manifest of packages) {
    const archive = path.join(archives, `${manifest.name.replace("@", "").replace("/", "-")}-${manifest.version}.tgz`);
    await access(archive);
    dependencies[manifest.name] = `file:${archive.replaceAll("\\", "/")}`;
  }
  await writeFile(
    path.join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module", dependencies }, null, 2),
  );
  await writeFile(
    path.join(consumer, ".npmrc"),
    "registry=https://registry.npmjs.org/\nstrict-peer-dependencies=true\nengine-strict=true\nauto-install-peers=false\n",
  );
  console.log(`Installing ${packages.length} packed packages with public registry dependencies and no overrides...`);
  await run([packageManager, "install", "--ignore-scripts", "--no-frozen-lockfile"]);
  console.log("Auditing the fresh public-registry consumer dependency graph...");
  await run([packageManager, "audit", "--audit-level=low"]);
  for (const [name, version] of Object.entries({
    ...policy.sharedDependencies,
    ...policy.profiles[profile],
  })) {
    const installed = JSON.parse(await readFile(path.join(consumer, "node_modules", name, "package.json"), "utf8"));
    assert.equal(installed.version, version, `${name}: consumer must run the pinned version`);
  }
  for (const fixture of ["lint-runners.test.ts", "runner-support.ts", "compatibility.test.ts"])
    await copyFile(path.join(root, "scripts/fixtures/consumer", fixture), path.join(consumer, fixture));
  await copyFile(
    path.join(root, "examples/shopify/app-home.oxlintrc.json"),
    path.join(consumer, "shopify-oxlint.json"),
  );
  await copyFile(
    path.join(root, "skills/closed-design-system/closed-design-system-probe.example.ts"),
    path.join(consumer, "closed-design-system-probe.example.ts"),
  );
  const imports = [];
  const assertions = [];
  for (const manifest of packages) {
    const installed = path.join(consumer, "node_modules", manifest.name);
    assert.equal(
      await readFile(path.join(installed, "LICENSE"), "utf8"),
      await readFile(path.join(root, "LICENSE"), "utf8"),
    );
    await access(path.join(installed, "README.md"));
    for (const subpath of Object.keys(manifest.exports)) {
      const name = `package${imports.length}`;
      const specifier = manifest.name + (subpath === "." ? "" : subpath.slice(1));
      imports.push(`import * as ${name} from ${JSON.stringify(specifier)};`);
      assertions.push(`expect(Object.keys(${name}).length, ${JSON.stringify(specifier)}).toBeGreaterThan(0);`);
    }
  }
  await writeFile(
    path.join(consumer, "exports.test.ts"),
    `import { expect, it } from "vitest";\n${imports.join("\n")}\nit("loads every registry-compatible public export", () => { ${assertions.join("\n")} });\n`,
  );
  await writeFile(
    path.join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2023",
        types: ["node"],
        skipLibCheck: false,
      },
      include: ["*.test.ts", "*.example.ts"],
    }),
  );
  console.log("Checking complete public declaration resolution with skipLibCheck=false...");
  await run([path.join(consumer, "node_modules/typescript/bin/tsc")]);
  const result = await run([
    path.join(consumer, "node_modules/vitest/vitest.mjs"),
    "run",
    "--testTimeout",
    "45000",
    "--reporter=default",
    "--reporter=json",
    "--outputFile=consumer-results.json",
  ]);
  console.log(result.stdout);
  const evidence = validateConsumerResults(
    JSON.parse(await readFile(path.join(consumer, "consumer-results.json"), "utf8")),
    {
      root: consumer,
      expectedFiles: ["exports.test.ts", "lint-runners.test.ts", "compatibility.test.ts"],
    },
  );
  console.log(
    `Validated executed evidence: ${evidence.passed} passed, ${evidence.skipped} skipped in ${evidence.files} files.`,
  );
  console.log(
    `Verified registry ${profile}: ${packages.length} tarballs, ${imports.length} exports, strict dependency types, peer/engine installation, and positive/negative runner behavior. Node ${process.version} on ${process.platform}/${process.arch}.`,
  );
} finally {
  assert.equal(path.dirname(path.resolve(temporary)), path.resolve(tmpdir()));
  await rm(temporary, { recursive: true, force: true });
}
