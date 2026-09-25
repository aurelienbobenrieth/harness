import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { validateCompatibility } from "./compatibility-policy.mjs";

const root = path.resolve(import.meta.dirname, "..");
const policy = JSON.parse(await readFile(path.join(root, "policy/compatibility.json"), "utf8"));
const sample = {
  policy,
  rootManifest: {
    engines: { node: policy.node },
    devDependencies: { ...policy.profiles.baseline },
  },
  packages: [
    {
      directory: "oxlint-plugin-core",
      manifest: {
        engines: { node: policy.node },
        peerDependencies: { oxlint: policy.peerRanges.oxlint },
      },
    },
    {
      directory: "agentlint-plugin-core",
      manifest: {
        engines: { node: policy.node },
        peerDependencies: { "@aurelienbbn/agentlint": policy.peerRanges["@aurelienbbn/agentlint"] },
        devDependencies: { "@aurelienbbn/agentlint": policy.profiles.baseline["@aurelienbbn/agentlint"] },
      },
    },
  ],
};
const fixture = () => structuredClone(sample);

test("accepts reviewed bounded hosts and the baseline agentlint engine", () => {
  assert.doesNotThrow(() => validateCompatibility(fixture()));
});

test("rejects removal of a required host peer", () => {
  const input = fixture();
  delete input.packages[0].manifest.peerDependencies.oxlint;
  assert.throws(() => validateCompatibility(input), /declare every consumer host as a peer/);
});

test("rejects unbounded compatibility even when a manifest matches the edited policy", () => {
  const input = fixture();
  input.policy.peerRanges.oxlint = ">=1.71.0";
  input.packages[0].manifest.peerDependencies.oxlint = ">=1.71.0";
  assert.throws(() => validateCompatibility(input), /every supported range must have an upper bound/);
});

test("rejects floating tool versions", () => {
  const input = fixture();
  input.policy.profiles.current.oxlint = "latest";
  assert.throws(() => validateCompatibility(input), /pin an exact reviewed release/);
});

for (const [range, version, accepted] of [
  [">=1.71.0 <2.0.0", "1.71.0", true],
  [">=1.71.0 <2.0.0", "1.70.9", false],
  [">=1.71.0 <2.0.0", "2.0.0", false],
  ["^1.71.0", "1.99.0", true],
  ["^1.71.0", "2.0.0", false],
  ["^0.23.0 || ^7.0.2001", "7.0.2001", true],
  ["^0.23.0 || ^7.0.2001", "0.24.0", false],
  ["^0.0.2", "0.0.2", true],
  ["^0.0.2", "0.0.3", false],
  ["^0.0.0", "0.0.1", false],
  ["1.71.0", "1.71.0", true],
  ["1.71.0", "1.71.1", false],
]) {
  test(`${accepted ? "accepts" : "rejects"} test host ${version} against declared support ${range}`, () => {
    const input = fixture();
    input.policy.peerRanges.oxlint = range;
    input.packages[0].manifest.peerDependencies.oxlint = range;
    const minimum = range.replace(/^(?:\^|>=)/, "").split(" ")[0];
    input.policy.profiles.baseline.oxlint = minimum;
    input.rootManifest.devDependencies.oxlint = minimum;
    input.policy.profiles.current.oxlint = version;
    if (accepted) assert.doesNotThrow(() => validateCompatibility(input));
    else assert.throws(() => validateCompatibility(input), /tested version must satisfy its declared peer range/);
  });
}

test("rejects an empty or reversed bounded interval", () => {
  for (const range of [">=2.0.0 <2.0.0", ">=2.0.0 <1.0.0"]) {
    const input = fixture();
    input.policy.peerRanges.oxlint = range;
    assert.throws(() => validateCompatibility(input), /upper bound must exceed the lower bound/);
  }
});

test("rejects versions with leading zeros instead of treating them as reviewed releases", () => {
  const input = fixture();
  input.policy.profiles.current.oxlint = "01.81.0";
  assert.throws(() => validateCompatibility(input), /pin an exact reviewed release/);
});

test("rejects an untested host in a profile", () => {
  const input = fixture();
  delete input.policy.profiles.current.stylelint;
  assert.throws(() => validateCompatibility(input), /every public peer needs an explicit test version/);
});

test("rejects removal of an entire compatibility profile", () => {
  const input = fixture();
  delete input.policy.profiles.current;
  assert.throws(() => validateCompatibility(input), /Keep both baseline and current compatibility profiles/);
});

test("rejects unbounded Node support even when all manifests agree", () => {
  const input = fixture();
  input.policy.node = ">=22";
  input.rootManifest.engines.node = ">=22";
  for (const entry of input.packages) entry.manifest.engines.node = ">=22";
  assert.throws(() => validateCompatibility(input), /every supported range must have an upper bound/);
});

test("rejects Node engine drift in root and package manifests", () => {
  const rootDrift = fixture();
  rootDrift.rootManifest.engines.node = ">=22";
  assert.throws(() => validateCompatibility(rootDrift), /Root Node support must match/);
  const packageDrift = fixture();
  packageDrift.packages[0].manifest.engines.node = ">=22";
  assert.throws(() => validateCompatibility(packageDrift), /Node support must match compatibility policy/);
});

test("rejects a development toolchain that no longer matches the tested baseline", () => {
  const input = fixture();
  input.rootManifest.devDependencies.oxlint = "1.72.0";
  assert.throws(() => validateCompatibility(input), /baseline must match the development toolchain/);
});

test("rejects an agentlint plugin developed against an engine other than the baseline", () => {
  const input = fixture();
  input.packages[1].manifest.devDependencies["@aurelienbbn/agentlint"] = "file:../../engine.tgz";
  assert.throws(() => validateCompatibility(input), /develop against the baseline agentlint engine/);
});

test("rejects an agentlint engine profile outside the declared plugin peer range", () => {
  const input = fixture();
  input.policy.profiles.current["@aurelienbbn/agentlint"] = "0.4.0";
  assert.throws(() => validateCompatibility(input), /tested version must satisfy its declared peer range/);
});
