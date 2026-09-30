import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

function requiredRun(job, command, owner) {
  const steps = job.steps.filter((step) => step.run?.replace("pnpm run ", "pnpm ") === command);
  assert.equal(steps.length, 1, `${owner}: require ${command} exactly once.`);
  assert.equal(steps[0].if, undefined, `${owner}: do not skip ${command}.`);
  assert.ok(
    steps[0]["continue-on-error"] === undefined || steps[0]["continue-on-error"] === false,
    `${owner}: failures in ${command} must fail validation.`,
  );
}

/** Pull requests validate Node 24 only; every other event validates both supported majors. */
const pullRequestNodes = "${{ fromJSON(github.event_name == 'pull_request' && '[24]' || '[22, 24]') }}";
/** Pull requests narrow typecheck and unit tests to changed packages; every other event runs the full suite. */
const pullRequestAffectedBase =
  "${{ github.event_name == 'pull_request' && format('origin/{0}', github.base_ref) || '' }}";
const aggregate =
  'test "$RESULT" = success && { test "$FLOORS" = success || { test "$EVENT" = pull_request && test "$FLOORS" = skipped; }; }';
const releaseAppConfigured = "${{ secrets.RELEASE_APP_CLIENT_ID != '' && secrets.RELEASE_APP_PRIVATE_KEY != '' }}";
const releaseAppCredentials = {
  "client-id": "${{ secrets.RELEASE_APP_CLIENT_ID }}",
  "private-key": "${{ secrets.RELEASE_APP_PRIVATE_KEY }}",
};

/** Removes the version PR writer's App credentials from a copy, only where expected and verbatim. */
function withoutReleaseAppCredentials(file, workflow) {
  if (file !== "release.yml") return workflow;
  const copy = structuredClone(workflow);
  const job = copy.jobs?.version;
  if (job?.env?.RELEASE_APP_CONFIGURED === releaseAppConfigured) delete job.env.RELEASE_APP_CONFIGURED;
  for (const step of job?.steps ?? [])
    if (step.uses?.startsWith("actions/create-github-app-token@"))
      for (const [input, value] of Object.entries(releaseAppCredentials))
        if (step.with?.[input] === value) delete step.with[input];
  return copy;
}

function requiredRuntimeMatrix(job, versions, owner) {
  assert.deepEqual(
    job.strategy.matrix,
    { os: ["ubuntu-latest", "windows-latest"], node: versions },
    `${owner}: execute every advertised runtime on both operating systems without exclusions.`,
  );
  assert.equal(job["runs-on"], "${{ matrix.os }}", `${owner}: run each leg on its advertised operating system.`);
  const setup = job.steps.filter((step) => step.uses?.startsWith("actions/setup-node@"));
  assert.equal(setup.length, 1, `${owner}: set up one explicit Node runtime.`);
  assert.equal(setup[0].with?.["node-version"], "${{ matrix.node }}", `${owner}: install the advertised Node runtime.`);
  assert.equal(setup[0].if, undefined, `${owner}: do not skip runtime setup.`);
  assert.ok(
    setup[0]["continue-on-error"] === undefined || setup[0]["continue-on-error"] === false,
    `${owner}: runtime setup failures must fail validation.`,
  );
}

/** Evaluate the checked-in preparation policy without invoking a registry or changing files. */
export function validateReleasePolicy({ policy, manifests, changesets }) {
  assert.equal(policy.schemaVersion, 1, "Use release policy schema version 1.");
  assert.equal(typeof policy.publicationEnabled, "boolean", "Set publicationEnabled explicitly.");
  assert.match(policy.repository, /^[\w.-]+\/[\w.-]+$/, "Set a GitHub owner/repository identity.");
  assert.equal(policy.defaultBranch, "main", "Release preparation must use main.");
  assert.ok(policy.packages && typeof policy.packages === "object" && !Array.isArray(policy.packages));
  const names = manifests.map(({ manifest }) => manifest.name).toSorted();
  assert.equal(new Set(names).size, names.length, "Package names must be unique.");
  assert.deepEqual(
    Object.keys(policy.packages).toSorted(),
    names,
    "Classify every package; remove stale policy entries.",
  );
  assert.equal(changesets.baseBranch, policy.defaultBranch, "Changesets must use the release branch.");
  assert.equal(changesets.changelog?.[1]?.repo, policy.repository, "Changesets must use the canonical repository.");
  assert.deepEqual(
    changesets.privatePackages,
    { version: true, tag: false },
    "Version draft changes without publishing or tagging them.",
  );
  for (const { directory, manifest } of manifests) {
    const maturity = policy.packages[manifest.name];
    assert.ok(["candidate", "draft"].includes(maturity), `${manifest.name}: classify as candidate or draft.`);
    assert.equal(
      manifest.repository?.url,
      `git+https://github.com/${policy.repository}.git`,
      `${manifest.name}: fix repository URL.`,
    );
    assert.equal(
      manifest.repository?.directory,
      `packages/${directory}`,
      `${manifest.name}: fix repository directory.`,
    );
    assert.equal(
      manifest.bugs?.url,
      `https://github.com/${policy.repository}/issues`,
      `${manifest.name}: fix issue URL.`,
    );
    if (maturity === "candidate") {
      assert.ok(manifest.description?.trim(), `${manifest.name}: add a description for npm search.`);
      assert.ok(
        Array.isArray(manifest.keywords) && manifest.keywords.length >= 3,
        `${manifest.name}: add at least three npm keywords.`,
      );
      assert.equal(
        manifest.homepage,
        `https://github.com/${policy.repository}/tree/main/packages/${directory}#readme`,
        `${manifest.name}: point homepage at the package README.`,
      );
      assert.ok(manifest.author?.name?.trim(), `${manifest.name}: name the author.`);
      assert.ok(manifest.files?.includes("CHANGELOG.md"), `${manifest.name}: publish CHANGELOG.md.`);
      assert.equal(manifest.publishConfig?.access, "public", `${manifest.name}: publish with public access.`);
    }
    if (maturity === "draft") assert.equal(manifest.private, true, `${manifest.name}: draft packages must be private.`);
    else assert.notEqual(manifest.private, true, `${manifest.name}: private packages must be classified as draft.`);
    for (const field of ["dependencies", "optionalDependencies", "peerDependencies"]) {
      for (const dependency of Object.keys(manifest[field] ?? {})) {
        if (maturity === "candidate") {
          assert.notEqual(
            policy.packages[dependency],
            "draft",
            `${manifest.name}: a release candidate cannot require draft ${dependency}.`,
          );
        }
      }
    }
  }
}

/** Select explicitly classified candidates; unknown and draft selections fail before preparation. */
export function selectReleasePackages({ policy, manifests, requested = [] }) {
  assert.equal(new Set(requested).size, requested.length, "Do not select a package twice.");
  for (const name of requested)
    assert.equal(policy.packages[name], "candidate", `${name}: select a known release candidate.`);
  return manifests
    .filter(
      ({ manifest }) =>
        policy.packages[manifest.name] === "candidate" && (requested.length === 0 || requested.includes(manifest.name)),
    )
    .map(({ manifest }) => ({ name: manifest.name, version: manifest.version }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

/** Bind manual preparation to the exact main revision supplied by the maintainer. */
export function verifyReviewedRevision({ reviewedSha, head, branch, eventSha, eventName }) {
  assert.match(reviewedSha ?? "", /^[a-f0-9]{40}$/, "Supply the full lowercase 40-character reviewed commit SHA.");
  assert.equal(branch, "refs/heads/main", "Prepare releases only from main.");
  assert.equal(eventName, "workflow_dispatch", "Prepare reviewed releases only through a manual workflow.");
  assert.equal(reviewedSha, eventSha, "The supplied reviewed SHA must equal the workflow's main revision.");
  assert.equal(head, reviewedSha, "The checkout must equal the supplied reviewed SHA.");
}

/** Enforce the repository's workflow boundaries on parsed YAML rather than shell-text heuristics. */
export function validateWorkflowPolicy(workflows) {
  for (const [file, workflow] of Object.entries(workflows)) {
    assert.deepEqual(workflow.permissions, { contents: "read" }, `${file}: default to contents read only.`);
    assert.ok(
      !Object.hasOwn(workflow.on ?? {}, "pull_request_target"),
      `${file}: do not execute contributions with elevated pull_request_target permissions.`,
    );
    assert.ok(workflow.concurrency?.group, `${file}: define a concurrency group.`);
    assert.equal(
      typeof workflow.concurrency["cancel-in-progress"],
      "boolean",
      `${file}: choose cancellation behavior explicitly.`,
    );
    assert.ok(workflow.jobs && Object.keys(workflow.jobs).length > 0, `${file}: define jobs.`);
    for (const [id, job] of Object.entries(workflow.jobs)) {
      assert.ok(
        job["continue-on-error"] === undefined || job["continue-on-error"] === false,
        `${file}/${id}: do not ignore job failure.`,
      );
      if (job.permissions) {
        const expected =
          file === "release.yml" && id === "version"
            ? { contents: "write", "pull-requests": "write" }
            : file === "publish.yml" && id === "publish"
              ? { contents: "read", "id-token": "write" }
              : { contents: "read" };
        assert.deepEqual(job.permissions, expected, `${file}/${id}: grant only the required permissions.`);
      }
      assert.ok(
        Number.isInteger(job["timeout-minutes"]) && job["timeout-minutes"] > 0 && job["timeout-minutes"] <= 45,
        `${file}/${id}: bound job duration to 45 minutes.`,
      );
      for (const step of job.steps ?? []) {
        if (step.uses)
          assert.match(
            step.uses,
            /^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/,
            `${file}/${id}: pin actions to full commit SHAs.`,
          );
        if (step.uses?.startsWith("actions/checkout@")) {
          assert.equal(
            step.with?.["persist-credentials"],
            file === "release.yml" && id === "version",
            `${file}/${id}: persist credentials only for the version PR writer.`,
          );
        }
        if (step.uses?.startsWith("changesets/action@"))
          assert.ok(
            step.with?.publish === undefined && step.with?.["publish-script"] === undefined,
            `${file}/${id}: do not configure a Changesets publisher.`,
          );
        assert.doesNotMatch(
          step.run ?? "",
          /\b(?:npm|pnpm|changeset|changesets)\s+(?:--\S+\s+)*publish\b/,
          `${file}/${id}: publish only through the reviewed scripts/publish.mjs.`,
        );
      }
    }
    assert.doesNotMatch(
      JSON.stringify(withoutReleaseAppCredentials(file, workflow)),
      /secrets\.|NODE_AUTH_TOKEN|NPM_TOKEN/,
      `${file}: no stored release credentials; only the version PR's App token step reads stored secrets.`,
    );
  }
  const prepare = workflows["publish.yml"];
  assert.ok(prepare, "Keep the explicit manual release preparation workflow.");
  assert.deepEqual(Object.keys(prepare.on), ["workflow_dispatch"], "Release preparation must be manual.");
  assert.equal(prepare.on.workflow_dispatch.inputs["reviewed-sha"].required, true, "Require a reviewed SHA.");
  assert.equal(prepare.jobs.prepare.if, "github.ref == 'refs/heads/main'", "Prepare only the main workflow revision.");
  assert.ok(
    prepare.jobs.prepare.steps.some((step) => step.run === "node scripts/release.mjs --verify-ref"),
    "Verify the reviewed revision before validation.",
  );
  assert.equal(prepare.concurrency["cancel-in-progress"], false, "Do not interrupt release preparation.");
  requiredRun(prepare.jobs.prepare, "node scripts/release.mjs --verify-ref", "release preparation");
  assert.doesNotMatch(
    JSON.stringify(prepare),
    /HARNESS_AFFECTED_BASE/,
    "Release preparation runs the full validation suite, never an affected subset.",
  );
  const verifyIndex = prepare.jobs.prepare.steps.findIndex(
    (step) => step.run === "node scripts/release.mjs --verify-ref",
  );
  const installIndex = prepare.jobs.prepare.steps.findIndex((step) => step.run === "pnpm install --frozen-lockfile");
  assert.ok(verifyIndex < installIndex, "Verify the reviewed SHA before installing project dependencies.");
  assert.equal(
    prepare.jobs.prepare.steps[verifyIndex].env?.HARNESS_REVIEWED_SHA,
    "${{ inputs.reviewed-sha }}",
    "Pass the reviewed SHA through the declared environment variable.",
  );
  const checkout = prepare.jobs.prepare.steps.find((step) => step.uses?.startsWith("actions/checkout@"));
  assert.equal(
    checkout?.with?.ref,
    "${{ github.sha }}",
    "Check out the workflow revision, never an arbitrary input ref.",
  );
  const publish = prepare.jobs.publish;
  assert.ok(publish, "Keep the reviewed publish job.");
  assert.equal(publish.needs, "prepare", "Publish only after release preparation passes.");
  assert.equal(publish.if, "github.ref == 'refs/heads/main'", "Publish only the main workflow revision.");
  assert.equal(publish.environment, "npm", "Publish through the approval-gated npm environment.");
  for (const command of [
    "node scripts/release.mjs --verify-ref",
    "pnpm install --frozen-lockfile",
    "pnpm build",
    "node scripts/publish.mjs",
  ])
    requiredRun(publish, command, "publish");
  assert.equal(
    publish.steps.find((step) => step.run === "node scripts/release.mjs --verify-ref").env?.HARNESS_REVIEWED_SHA,
    "${{ inputs.reviewed-sha }}",
    "Verify the reviewed SHA before publishing.",
  );
  assert.equal(
    publish.steps.find((step) => step.uses?.startsWith("actions/checkout@"))?.with?.ref,
    "${{ github.sha }}",
    "Publish the workflow revision, never an input ref.",
  );
  const ci = workflows["ci.yml"];
  assert.equal(ci?.jobs?.result?.name, "Validate", "Preserve the protected branch's aggregate Validate status.");
  assert.equal(ci.jobs.result.if, "always()", "Report a failing aggregate when a matrix leg fails or is cancelled.");
  assert.deepEqual(ci.jobs.result.needs, ["validate", "runtime-floors"], "Aggregate every validation matrix leg.");
  assert.equal(ci.jobs.result.steps[0].env.RESULT, "${{ needs.validate.result }}", "Aggregate the validation result.");
  assert.equal(
    ci.jobs.result.steps[0].env.FLOORS,
    "${{ needs.runtime-floors.result }}",
    "Aggregate the runtime floor result.",
  );
  assert.equal(
    ci.jobs.result.steps[0].env.EVENT,
    "${{ github.event_name }}",
    "Aggregate against the triggering event.",
  );
  assert.equal(
    ci.jobs.result.steps[0].run,
    aggregate,
    "A failed or cancelled matrix must fail the aggregate; only pull requests may skip runtime floors.",
  );
  requiredRun(ci.jobs.result, aggregate, "aggregate status");
  assert.equal(ci.jobs.validate.if, undefined, "Run validation on every event.");
  assert.deepEqual(
    ci.jobs.validate.strategy.matrix.os,
    ["ubuntu-latest", "windows-latest"],
    "Test both supported operating systems.",
  );
  requiredRuntimeMatrix(ci.jobs.validate, pullRequestNodes, "CI");
  assert.equal(
    ci.jobs.validate.steps.find((step) => step.run?.replace("pnpm run ", "pnpm ") === "pnpm check")?.env
      ?.HARNESS_AFFECTED_BASE,
    pullRequestAffectedBase,
    "Narrow validation only on pull requests; pushes and manual runs run the full suite.",
  );
  const floors = ci.jobs["runtime-floors"];
  assert.deepEqual(
    floors.strategy.matrix.os,
    ["ubuntu-latest", "windows-latest"],
    "Test runtime floors on both operating systems.",
  );
  assert.deepEqual(floors.strategy.matrix.node, ["22.19.0", "24.11.0"], "Test the exact advertised Node floors.");
  requiredRuntimeMatrix(floors, ["22.19.0", "24.11.0"], "runtime floors");
  assert.equal(floors.if, "github.event_name != 'pull_request'", "Skip runtime floors only on pull requests.");
  for (const command of [
    "pnpm install --frozen-lockfile",
    "pnpm build",
    "pnpm test:compatibility baseline",
    "pnpm test:compatibility current",
  ]) {
    requiredRun(floors, command, "runtime floors");
  }
  for (const [owner, job] of [
    ["CI", ci.jobs.validate],
    ["release preparation", prepare.jobs.prepare],
  ]) {
    for (const command of [
      "pnpm install --frozen-lockfile",
      "pnpm check",
      "pnpm security:check",
      "pnpm test:package",
      "pnpm test:compatibility baseline",
      "pnpm test:compatibility current",
    ]) {
      requiredRun(job, command, owner);
    }
  }
  const versionWorkflow = workflows["release.yml"];
  assert.deepEqual(versionWorkflow?.on, { push: { branches: ["main"] } }, "Create version PRs only from main pushes.");
  assert.equal(versionWorkflow.concurrency["cancel-in-progress"], false, "Do not interrupt the version PR writer.");
  const versionJob = versionWorkflow.jobs.version;
  assert.ok(versionJob, "Keep the version PR job.");
  requiredRun(versionJob, "pnpm install --frozen-lockfile", "version PR");
  requiredRun(versionJob, "pnpm release:check", "version PR");
  const versionSteps = versionJob.steps.filter((step) => step.uses?.startsWith("changesets/action@"));
  assert.equal(versionSteps.length, 1, "Require one Changesets version PR action.");
  const versionStep = versionSteps[0];
  assert.equal(
    versionStep.with?.["version-script"],
    "bash scripts/version.sh",
    "Use the reviewed version-only command.",
  );
  const checkIndex = versionJob.steps.findIndex((step) => step.run === "pnpm release:check");
  const writerIndex = versionJob.steps.indexOf(versionStep);
  assert.ok(checkIndex < writerIndex, "Validate release policy before updating the version PR.");
  const tokenSteps = versionJob.steps.filter((step) => step.uses?.startsWith("actions/create-github-app-token@"));
  assert.equal(tokenSteps.length, 1, "Mint one release App token for the version PR.");
  const tokenIndex = versionJob.steps.indexOf(tokenSteps[0]);
  assert.ok(
    checkIndex < tokenIndex && tokenIndex < writerIndex,
    "Mint the release App token after release validation, just before the version PR writer.",
  );
  assert.equal(tokenSteps[0].id, "app-token", "Name the release App token step app-token.");
  assert.equal(tokenSteps[0].if, "env.RELEASE_APP_CONFIGURED == 'true'", "Mint the token only once the App is set up.");
  assert.equal(versionJob.env?.RELEASE_APP_CONFIGURED, releaseAppConfigured, "Expose only whether the App is set up.");
  assert.deepEqual(
    tokenSteps[0].with,
    { ...releaseAppCredentials, "permission-contents": "write", "permission-pull-requests": "write" },
    "release App token: grant only contents and pull-requests write.",
  );
  assert.equal(
    versionStep.with?.["github-token"],
    "${{ steps.app-token.outputs.token || github.token }}",
    "Write the version PR with the release App token when configured, so its CI starts on its own.",
  );
}

/** Read policy inputs in deterministic order; consumers supply the root explicitly for fixtures. */
export async function readReleaseInputs(root) {
  const directories = (await readdir(path.join(root, "packages"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted();
  const manifests = await Promise.all(
    directories.map(async (directory) => ({
      directory,
      manifest: JSON.parse(await readFile(path.join(root, "packages", directory, "package.json"), "utf8")),
    })),
  );
  const [policy, changesets, rootManifest] = await Promise.all([
    readFile(path.join(root, "policy/release.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, ".changeset/config.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "package.json"), "utf8").then(JSON.parse),
  ]);
  return { policy, changesets, manifests, rootManifest };
}

/** Parse all workflow files so additional workflows receive the same policy checks. */
export async function readWorkflows(root) {
  const { parse } = await import("yaml");
  const directory = path.join(root, ".github/workflows");
  const files = (await readdir(directory)).filter((file) => /\.ya?ml$/.test(file)).toSorted();
  return Object.fromEntries(
    await Promise.all(files.map(async (file) => [file, parse(await readFile(path.join(directory, file), "utf8"))])),
  );
}
