/* eslint-disable no-await-in-loop -- Validate one installed package at a time with deterministic export indexes. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { validateConsumerResults } from "./consumer-results.mjs";

const execute = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const compatibility = JSON.parse(await readFile(path.join(root, "policy/compatibility.json"), "utf8"));
const agentlintArchive = path.join(root, compatibility.localAgentlint.path);
assert.equal(
  `sha512-${createHash("sha512")
    .update(await readFile(agentlintArchive))
    .digest("base64")}`,
  compatibility.localAgentlint.integrity,
  "Local agentlint archive differs from the reviewed compatibility artifact",
);
const packageManager = process.env.npm_execpath;
assert.ok(packageManager, "Run with pnpm test:package");
const temporary = await mkdtemp(path.join(tmpdir(), "harness-packed-consumer-"));
const archives = path.join(temporary, "archives");
const consumer = path.join(temporary, "consumer");
async function packageBin(packageName, binName) {
  const packageFolder = path.join(root, "node_modules", ...packageName.split("/"));
  const manifest = JSON.parse(await readFile(path.join(packageFolder, "package.json"), "utf8"));
  const relative = typeof manifest.bin === "string" ? manifest.bin : manifest.bin[binName];
  assert.ok(relative, `${packageName} does not expose ${binName}`);
  return path.join(packageFolder, relative);
}
async function run(args, cwd = consumer, expectedExit = 0) {
  try {
    const output = await execute(process.execPath, args, {
      cwd,
      windowsHide: true,
      timeout: 180_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    assert.equal(expectedExit, 0, "Consumer command unexpectedly succeeded");
    return output;
  } catch (error) {
    if (expectedExit !== 0 && error.code === expectedExit) return { stdout: error.stdout, stderr: error.stderr };
    throw new Error(`Consumer command failed: ${args.join(" ")}\n${error.stdout ?? ""}\n${error.stderr ?? ""}`, {
      cause: error,
    });
  }
}
try {
  await mkdir(archives);
  await mkdir(consumer);
  console.log("Packing workspace artifacts without rebuilding them...");
  await run(
    [
      packageManager,
      "--filter",
      "./packages/*",
      "--recursive",
      "--config.ignore-scripts=true",
      "pack",
      "--pack-destination",
      archives,
    ],
    root,
  );
  const packages = [];
  for (const directory of (await readdir(path.join(root, "packages"))).toSorted())
    packages.push(JSON.parse(await readFile(path.join(root, "packages", directory, "package.json"), "utf8")));
  const dependencies = {
    ...compatibility.sharedDependencies,
    ...compatibility.profiles.baseline,
    "@aurelienbbn/agentlint": `file:${agentlintArchive.replaceAll("\\", "/")}`,
  };
  for (const manifest of packages) {
    const archive = path.join(archives, `${manifest.name.replace("@", "").replace("/", "-")}-${manifest.version}.tgz`);
    await access(archive);
    console.log(`Validating ${manifest.name} package metadata and type resolution...`);
    await run([await packageBin("publint", "publint"), "run", archive, "--strict"], root);
    await run(
      [
        await packageBin("@arethetypeswrong/cli", "attw"),
        archive,
        "--profile",
        "esm-only",
        "--no-summary",
        "--no-emoji",
        "--no-color",
      ],
      root,
    );
    dependencies[manifest.name] = `file:${archive.replaceAll("\\", "/")}`;
  }
  await writeFile(
    path.join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module", dependencies }, null, 2),
  );
  await writeFile(
    path.join(consumer, "pnpm-workspace.yaml"),
    `overrides:\n  vite: "npm:@voidzero-dev/vite-plus-core@${compatibility.profiles.baseline["vite-plus"]}"\n`,
  );
  await writeFile(
    path.join(consumer, ".npmrc"),
    "strict-peer-dependencies=true\nengine-strict=true\nauto-install-peers=false\n",
  );
  console.log(
    `Installing ${packages.length} tarballs in an isolated local-draft consumer (reviewed agentlint archive and Vite Plus alias)...`,
  );
  await run([packageManager, "install", "--ignore-scripts", "--no-frozen-lockfile"]);
  console.log("Auditing the fresh draft consumer dependency graph...");
  await run([packageManager, "audit", "--audit-level=low"]);
  const fixtures = await readdir(path.join(root, "scripts/fixtures/consumer"));
  await copyFile(
    path.join(root, "examples/shopify/app-home.oxlintrc.json"),
    path.join(consumer, "shopify-oxlint.json"),
  );
  const expectedTests = fixtures.filter((fixture) => fixture.endsWith(".test.ts"));
  for (const fixture of fixtures)
    await copyFile(path.join(root, "scripts/fixtures/consumer", fixture), path.join(consumer, fixture));

  await copyFile(
    path.join(root, "examples/conformance-core/closed-design-system-probe.example.ts"),
    path.join(consumer, "closed-design-system-probe.example.ts"),
  );
  await writeFile(
    path.join(consumer, "shopify.app.production.toml"),
    'embedded = true\napplication_url = "https://app.example.com"\n[webhooks]\napi_version = "2026-07"\n[[webhooks.subscriptions]]\ncompliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]\nuri = "/webhooks"\n',
  );
  await writeFile(path.join(consumer, "shopify.app.local.toml"), "embedded = false\n");
  await writeFile(
    path.join(consumer, "index.html"),
    '<html><head><script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script></head><body></body></html>',
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
    path.join(consumer, "consumer.test.ts"),
    `import { expect, it } from "vitest";\n${imports.join("\n")}\nit("loads every packed public export", () => { ${assertions.join("\n")} });\n`,
  );
  expectedTests.push("consumer.test.ts");
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
  console.log("Checking consumer declaration resolution and runtime exports...");
  const compiler = path.join(consumer, "node_modules/typescript/bin/tsc");
  await run([compiler]);
  const validation = await run([
    path.join(consumer, "node_modules/vitest/vitest.mjs"),
    "run",
    "--testTimeout",
    "45000",
    "--reporter=default",
    "--reporter=json",
    "--outputFile=consumer-results.json",
  ]);
  console.log(validation.stdout);
  const evidence = validateConsumerResults(
    JSON.parse(await readFile(path.join(consumer, "consumer-results.json"), "utf8")),
    {
      root: consumer,
      expectedFiles: expectedTests,
      allowedSkips: ["dead-exports", "duplication-budget", "closed-design-system-probe", "tsconfig-strictness"].map(
        (check) => ({
          file: "acceptance.test.ts",
          ancestorTitles: ["core conformance"],
          check,
        }),
      ),
    },
  );
  console.log(
    `Validated executed evidence: ${evidence.passed} passed, ${evidence.skipped} skipped in ${evidence.files} files.`,
  );
  console.log(
    `Verified ${packages.length} tarballs, ${imports.length} exports, consumer API types, the oxlint and agentlint runners, and conformance registration.`,
  );
} finally {
  assert.equal(path.dirname(path.resolve(temporary)), path.resolve(tmpdir()));
  await rm(temporary, { recursive: true, force: true });
}
