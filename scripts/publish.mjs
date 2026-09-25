import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readReleaseInputs, validateReleasePolicy } from "./release-policy.mjs";

const stableVersion = /^\d+\.\d+\.\d+$/u;

/**
 * Choose the reviewed candidates that still need publishing. Drafts never publish, an unversioned or prerelease
 * candidate stops the release, and versions already on the registry are skipped so a rerun is safe.
 */
export function selectPublishable({ policy, manifests, published }) {
  assert.equal(policy.publicationEnabled, true, "Publishing is disabled in policy/release.json.");
  const candidates = manifests.filter(({ manifest }) => policy.packages[manifest.name] === "candidate");
  for (const { manifest } of candidates)
    assert.ok(
      stableVersion.test(manifest.version) && manifest.version !== "0.0.0",
      `${manifest.name}@${manifest.version}: merge the version PR before publishing.`,
    );
  return candidates
    .filter(({ manifest }) => !published.has(`${manifest.name}@${manifest.version}`))
    .map(({ directory, manifest }) => ({ directory, name: manifest.name, version: manifest.version }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

/**
 * Windows exposes npm and pnpm as .cmd shims, which Node only spawns through a shell; arguments here are fixed.
 * `quiet` hides expected stderr (a 404 for an unpublished version).
 */
function run(command, args, cwd, { quiet = false } = {}) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", quiet ? "ignore" : "inherit"],
  }).trim();
}

/** Hands npm the terminal so a local publish can complete npm's two-factor web confirmation. */
function runInteractive(command, args, cwd) {
  execFileSync(command, args, { cwd, shell: process.platform === "win32", stdio: "inherit" });
}

function isPublished(name, version) {
  try {
    return run("npm", ["view", `${name}@${version}`, "version"], process.cwd(), { quiet: true }) === version;
  } catch {
    return false;
  }
}

async function main() {
  assert.equal(process.argv.length, 2, "publish takes no arguments; versions come from the merged version PR.");
  const root = path.resolve(import.meta.dirname, "..");
  const inputs = await readReleaseInputs(root);
  validateReleasePolicy(inputs);
  assert.equal(run("git", ["status", "--porcelain"], root), "", "Publish only a clean, reviewed checkout.");
  const inCi = process.env.GITHUB_ACTIONS === "true";
  const published = new Set(
    inputs.manifests
      .filter(({ manifest }) => inputs.policy.packages[manifest.name] === "candidate")
      .filter(({ manifest }) => isPublished(manifest.name, manifest.version))
      .map(({ manifest }) => `${manifest.name}@${manifest.version}`),
  );
  const targets = selectPublishable({ ...inputs, published });
  if (targets.length === 0) {
    console.log("Every candidate version is already on the registry.");
    return;
  }
  const output = mkdtempSync(path.join(os.tmpdir(), "harness-publish-"));
  try {
    for (const target of targets) {
      const folder = path.join(root, "packages", target.directory);
      run("pnpm", ["pack", "--pack-destination", output], folder);
      const tarball = readdirSync(output).find(
        (file) => file === `aurelienbbn-${target.directory}-${target.version}.tgz`,
      );
      assert.ok(tarball, `${target.name}: pnpm pack produced no tarball.`);
      const args = ["publish", path.join(output, tarball), "--access", "public"];
      if (inCi) args.push("--provenance");
      runInteractive("npm", args, root);
      console.log(`Published ${target.name}@${target.version}${inCi ? " with provenance" : ""}.`);
    }
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
