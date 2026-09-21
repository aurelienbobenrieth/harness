import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  readReleaseInputs,
  selectReleasePackages,
  validateReleasePolicy,
  verifyReviewedRevision,
} from "./release-policy.mjs";

/** Parse preparation-only arguments; there is deliberately no publish command. */
export function parseReleaseArguments(args) {
  const options = { requested: [], verifyRef: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--verify-ref") {
      assert.equal(options.verifyRef, false, "Use --verify-ref once.");
      options.verifyRef = true;
    } else if (arg === "--package") {
      const name = args[++index];
      assert.ok(name && !name.startsWith("--"), "Supply a package name after --package.");
      options.requested.push(name);
    } else {
      throw new Error(`Unknown release option ${arg}; this command prepares plans and never publishes.`);
    }
  }
  assert.ok(
    !options.verifyRef || options.requested.length === 0,
    "Verify the revision separately from package selection.",
  );
  return options;
}

/** Produce an honest local inventory; dirty or unversioned candidates remain visible as blockers. */
export function createReleasePlan({ policy, manifests, requested, head, dirtyPaths }) {
  const candidates = selectReleasePackages({ policy, manifests, requested });
  const blockers = [
    "Publication is disabled; registry authentication and release approval are outside this preparation command.",
  ];
  if (dirtyPaths.length > 0)
    blockers.push("Commit and review the working tree before preparing an exact release revision.");
  const unversioned = candidates.filter(({ version }) => version === "0.0.0" || version.includes("-"));
  if (unversioned.length > 0)
    blockers.push(
      `Assign reviewed stable release versions before publication: ${unversioned.map(({ name }) => name).join(", ")}.`,
    );
  return {
    schemaVersion: 1,
    mode: "prepare-only",
    publicationEnabled: false,
    repository: policy.repository,
    head,
    clean: dirtyPaths.length === 0,
    candidates,
    excluded: manifests
      .filter(({ manifest }) => policy.packages[manifest.name] === "draft")
      .map(({ manifest }) => ({ name: manifest.name, reason: "draft package is private" })),
    blockers,
    evidenceRequired: [
      "pnpm check",
      "pnpm test:package",
      "pnpm test:compatibility baseline",
      "pnpm test:compatibility current",
      "All CI validation and runtime-floor matrix legs pass for this exact revision",
      "Review candidate changesets and consumer migrations",
    ],
  };
}

async function main() {
  const options = parseReleaseArguments(process.argv.slice(2));
  const root = path.resolve(import.meta.dirname, "..");
  const git = (args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const head = git(["rev-parse", "HEAD"]);
  if (options.verifyRef) {
    verifyReviewedRevision({
      reviewedSha: process.env.HARNESS_REVIEWED_SHA,
      head,
      branch: process.env.GITHUB_REF,
      eventSha: process.env.GITHUB_SHA,
      eventName: process.env.GITHUB_EVENT_NAME,
    });
    console.log(`Reviewed main revision verified: ${head}`);
    return;
  }
  const inputs = await readReleaseInputs(root);
  validateReleasePolicy(inputs);
  const dirtyPaths = git(["status", "--porcelain", "--untracked-files=normal"]).split("\n").filter(Boolean);
  console.log(JSON.stringify(createReleasePlan({ ...inputs, ...options, head, dirtyPaths }), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
