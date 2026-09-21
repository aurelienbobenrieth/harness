import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createReleasePlan, parseReleaseArguments } from "./release.mjs";
import {
  readWorkflows,
  selectReleasePackages,
  validateReleasePolicy,
  validateWorkflowPolicy,
  verifyReviewedRevision,
} from "./release-policy.mjs";

const root = path.resolve(import.meta.dirname, "..");
const sha = "a".repeat(40);
const candidate = "@example/candidate";
const draft = "@example/draft";
const workflowFixture = await readWorkflows(root);

for (const [file, job] of [
  ["ci.yml", "validate"],
  ["publish.yml", "prepare"],
]) {
  test(`${file}: removing the dependency audit fails the workflow gate`, () => {
    const workflows = structuredClone(workflowFixture);
    workflows[file].jobs[job].steps = workflows[file].jobs[job].steps.filter(
      (step) => step.run !== "pnpm security:check",
    );
    assert.throws(() => validateWorkflowPolicy(workflows), /require pnpm security:check/);
  });
}

function fixture() {
  const repository = "example/harness";
  return {
    policy: {
      schemaVersion: 1,
      repository,
      defaultBranch: "main",
      publicationEnabled: false,
      packages: { [candidate]: "candidate", [draft]: "draft" },
    },
    manifests: [candidate, draft].map((name) => {
      const directory = name.split("/")[1];
      return {
        directory,
        manifest: {
          name,
          version: "1.0.0",
          private: name === draft,
          repository: {
            url: `git+https://github.com/${repository}.git`,
            directory: `packages/${directory}`,
          },
          bugs: { url: `https://github.com/${repository}/issues` },
        },
      };
    }),
    changesets: {
      baseBranch: "main",
      changelog: ["@changesets/changelog-github", { repo: repository }],
      privatePackages: { version: true, tag: false },
    },
  };
}

test("accepts complete candidate and private draft inventory", () => {
  assert.doesNotThrow(() => validateReleasePolicy(fixture()));
});

for (const [name, mutate, expected] of [
  [
    "missing package classification",
    (input) => {
      delete input.policy.packages[draft];
    },
    /Classify every package/,
  ],
  [
    "stale package classification",
    (input) => {
      input.policy.packages["@example/missing"] = "draft";
    },
    /Classify every package/,
  ],
  [
    "unknown maturity",
    (input) => {
      input.policy.packages[candidate] = "stable";
    },
    /classify as candidate or draft/,
  ],
  [
    "public draft",
    (input) => {
      input.manifests[1].manifest.private = false;
    },
    /draft packages must be private/,
  ],
  [
    "private candidate",
    (input) => {
      input.manifests[0].manifest.private = true;
    },
    /private packages must be classified as draft/,
  ],
  [
    "publication toggle",
    (input) => {
      input.policy.publicationEnabled = true;
    },
    /Publishing is disabled/,
  ],
  [
    "incorrect repository identity",
    (input) => {
      input.manifests[0].manifest.repository.url = "https://github.com/other/harness.git";
    },
    /fix repository URL/,
  ],
  [
    "incorrect changeset identity",
    (input) => {
      input.changesets.changelog[1].repo = "other/harness";
    },
    /canonical repository/,
  ],
  [
    "draft tags",
    (input) => {
      input.changesets.privatePackages.tag = true;
    },
    /Version draft changes/,
  ],
]) {
  test(`rejects ${name}`, () => {
    const input = fixture();
    mutate(input);
    assert.throws(() => validateReleasePolicy(input), expected);
  });
}

for (const field of ["dependencies", "optionalDependencies", "peerDependencies"]) {
  test(`rejects candidate ${field} on a draft`, () => {
    const input = fixture();
    input.manifests[0].manifest[field] = { [draft]: "workspace:*" };
    assert.throws(() => validateReleasePolicy(input), /cannot require draft/);
  });
}

test("selects only candidates and fails explicit draft, unknown, or duplicate requests", () => {
  const input = fixture();
  assert.deepEqual(selectReleasePackages(input), [{ name: candidate, version: "1.0.0" }]);
  assert.throws(() => selectReleasePackages({ ...input, requested: [draft] }), /known release candidate/);
  assert.throws(() => selectReleasePackages({ ...input, requested: ["@example/missing"] }), /known release candidate/);
  assert.throws(() => selectReleasePackages({ ...input, requested: [candidate, candidate] }), /twice/);
});

test("preparation plan exposes dirty inputs, zero versions, and disabled publication", () => {
  const input = fixture();
  input.manifests[0].manifest.version = "0.0.0";
  const plan = createReleasePlan({ ...input, head: sha, dirtyPaths: [" M README.md"] });
  assert.equal(plan.publicationEnabled, false);
  assert.equal(plan.mode, "prepare-only");
  assert.equal(plan.clean, false);
  assert.equal(plan.blockers.length, 3);
  assert.deepEqual(plan.excluded, [{ name: draft, reason: "draft package is private" }]);
});

test("clean versioned preparation still reports publishing disabled", () => {
  const plan = createReleasePlan({ ...fixture(), head: sha, dirtyPaths: [] });
  assert.equal(plan.clean, true);
  assert.equal(plan.blockers.length, 1);
  assert.match(plan.blockers[0], /Publication is disabled/);
});

test("accepts a manual exact main revision", () => {
  assert.doesNotThrow(() =>
    verifyReviewedRevision({
      reviewedSha: sha,
      head: sha,
      branch: "refs/heads/main",
      eventSha: sha,
      eventName: "workflow_dispatch",
    }),
  );
});

for (const [field, value] of [
  ["reviewedSha", "main"],
  ["reviewedSha", "abc1234"],
  ["reviewedSha", "$(whoami)"],
  ["head", "b".repeat(40)],
  ["eventSha", "b".repeat(40)],
  ["branch", "refs/heads/feature"],
  ["eventName", "push"],
]) {
  test(`rejects unreviewed revision: ${field}=${value}`, () => {
    assert.throws(() =>
      verifyReviewedRevision({
        reviewedSha: sha,
        head: sha,
        branch: "refs/heads/main",
        eventSha: sha,
        eventName: "workflow_dispatch",
        [field]: value,
      }),
    );
  });
}

test("CLI refuses publishing, malformed, duplicate, and mixed options", () => {
  for (const args of [
    ["--publish"],
    ["publish"],
    ["--package"],
    ["--verify-ref", "--verify-ref"],
    ["--verify-ref", "--package", candidate],
  ]) {
    assert.throws(() => parseReleaseArguments(args));
  }
  assert.deepEqual(parseReleaseArguments(["--package", candidate]), {
    requested: [candidate],
    verifyRef: false,
  });
});

test("publish refusal needs no external executable and leaves the working directory unchanged", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "harness-release-refusal-"));
  const sentinel = path.join(directory, "sentinel.txt");
  writeFileSync(sentinel, "preserve this input");
  try {
    const result = spawnSync(process.execPath, [path.join(root, "scripts/release.mjs"), "--publish"], {
      cwd: directory,
      encoding: "utf8",
      env: { PATH: "" },
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /never publishes/);
    assert.deepEqual(readdirSync(directory), ["sentinel.txt"]);
    assert.equal(readFileSync(sentinel, "utf8"), "preserve this input");
  } finally {
    unlinkSync(sentinel);
    rmdirSync(directory);
  }
});

test("repository workflows satisfy parsed policy", () => {
  assert.doesNotThrow(() => validateWorkflowPolicy(workflowFixture));
});

for (const [name, mutate, expected] of [
  [
    "mutable action",
    (workflows) => {
      workflows["ci.yml"].jobs.validate.steps[0].uses = "actions/checkout@v5";
    },
    /full commit SHAs/,
  ],
  [
    "elevated default permission",
    (workflows) => {
      workflows["ci.yml"].permissions.contents = "write";
    },
    /read only/,
  ],
  [
    "stored release token",
    (workflows) => {
      workflows["publish.yml"].env = { TOKEN: "${{ secrets.NPM_TOKEN }}" };
    },
    /stored release credentials/,
  ],
  [
    "publish command",
    (workflows) => {
      workflows["publish.yml"].jobs.prepare.steps.push({ run: "pnpm publish" });
    },
    /without publishing/,
  ],
  [
    "pull request target",
    (workflows) => {
      workflows["ci.yml"].on.pull_request_target = {};
    },
    /pull_request_target/,
  ],
  [
    "retained checkout credentials",
    (workflows) => {
      workflows["ci.yml"].jobs.validate.steps[0].with["persist-credentials"] = true;
    },
    /persist credentials only/,
  ],
  [
    "missing aggregate status",
    (workflows) => {
      workflows["ci.yml"].jobs.result.name = "Other";
    },
    /aggregate Validate/,
  ],
  [
    "missing reviewed ref validation",
    (workflows) => {
      workflows["publish.yml"].jobs.prepare.steps = workflows["publish.yml"].jobs.prepare.steps.filter(
        (step) => !step.run?.includes("--verify-ref"),
      );
    },
    /Verify the reviewed revision/,
  ],
  [
    "false aggregate success",
    (workflows) => {
      workflows["ci.yml"].jobs.result.steps[0].run = "true";
    },
    /failed or cancelled matrix/,
  ],
  [
    "ignored validation failure",
    (workflows) => {
      workflows["ci.yml"].jobs.validate["continue-on-error"] = true;
    },
    /do not ignore job failure/,
  ],
  [
    "skipped compatibility check",
    (workflows) => {
      workflows["ci.yml"].jobs.validate.steps.find((step) => step.run === "pnpm test:compatibility baseline").if =
        "false";
    },
    /do not skip/,
  ],
  [
    "arbitrary checkout revision",
    (workflows) => {
      workflows["publish.yml"].jobs.prepare.steps[0].with.ref = "${{ inputs.reviewed-sha }}";
    },
    /never an arbitrary input ref/,
  ],
  [
    "installation before review verification",
    (workflows) => {
      const steps = workflows["publish.yml"].jobs.prepare.steps;
      const verifyIndex = steps.findIndex((step) => step.run === "node scripts/release.mjs --verify-ref");
      const installIndex = steps.findIndex((step) => step.run === "pnpm install --frozen-lockfile");
      [steps[verifyIndex], steps[installIndex]] = [steps[installIndex], steps[verifyIndex]];
    },
    /before installing/,
  ],
  [
    "missing runtime floor from aggregation",
    (workflows) => {
      workflows["ci.yml"].jobs.result.needs = ["validate"];
    },
    /Aggregate every validation matrix/,
  ],
  [
    "untested advertised runtime floor",
    (workflows) => {
      workflows["ci.yml"].jobs["runtime-floors"].strategy.matrix.node = ["22.18.0", "24.11.0"];
    },
    /exact advertised Node floors/,
  ],
  [
    "skipped aggregate evaluation",
    (workflows) => {
      workflows["ci.yml"].jobs.result.steps[0].if = "false";
    },
    /do not skip/,
  ],
  [
    "ignored aggregate job failure",
    (workflows) => {
      workflows["ci.yml"].jobs.result["continue-on-error"] = true;
    },
    /do not ignore job failure/,
  ],
  [
    "expression that ignores a required test failure",
    (workflows) => {
      workflows["ci.yml"].jobs.validate.steps.find((step) => step.run === "pnpm test:package")["continue-on-error"] =
        "${{ true }}";
    },
    /must fail validation/,
  ],
  [
    "Changesets action publisher",
    (workflows) => {
      workflows["release.yml"].jobs.version.steps.at(-1).with.publish = "pnpm publish";
    },
    /do not configure a Changesets publisher/,
  ],
  [
    "version PR without release validation",
    (workflows) => {
      workflows["release.yml"].jobs.version.steps = workflows["release.yml"].jobs.version.steps.filter(
        (step) => step.run !== "pnpm release:check",
      );
    },
    /require pnpm release:check/,
  ],
  [
    "version PR written before policy validation",
    (workflows) => {
      const steps = workflows["release.yml"].jobs.version.steps;
      const index = steps.findIndex((step) => step.run === "pnpm release:check");
      [steps[index], steps[index + 1]] = [steps[index + 1], steps[index]];
    },
    /before updating the version PR/,
  ],
  [
    "version writer on contribution branches",
    (workflows) => {
      workflows["release.yml"].on = { pull_request: null };
    },
    /only from main pushes/,
  ],
  [
    "excluded runtime floor",
    (workflows) => {
      workflows["ci.yml"].jobs["runtime-floors"].strategy.matrix.exclude = [{ os: "ubuntu-latest" }];
    },
    /without exclusions/,
  ],
  [
    "matrix labels that do not select the runner",
    (workflows) => {
      workflows["ci.yml"].jobs.validate["runs-on"] = "windows-latest";
    },
    /advertised operating system/,
  ],
  [
    "matrix labels that do not select Node",
    (workflows) => {
      workflows["ci.yml"].jobs["runtime-floors"].steps.find((step) =>
        step.uses?.startsWith("actions/setup-node@"),
      ).with["node-version"] = 24;
    },
    /advertised Node runtime/,
  ],
]) {
  test(`workflow policy rejects ${name}`, () => {
    const workflows = structuredClone(workflowFixture);
    mutate(workflows);
    assert.throws(() => validateWorkflowPolicy(workflows), expected);
  });
}
