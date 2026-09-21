import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const versionPattern = "(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)";

function compareVersions(left, right) {
  const difference = left.findIndex((value, index) => value !== right[index]);
  return difference === -1 ? 0 : left[difference] < right[difference] ? -1 : 1;
}

/**
 * Check only the exact, caret, and bounded stable ranges admitted by this repository's policy.
 * @attribution https://github.com/npm/node-semver#caret-ranges-123-025-004 (ISC; range semantics, independent implementation)
 */
function supportedIntervals(range, owner) {
  assert.equal(typeof range, "string", `${owner}: declare a bounded compatibility range`);
  return range.split(" || ").map((branch) => {
    const match = branch.match(new RegExp(`^(\\^?)(${versionPattern})$|^>=(${versionPattern}) <(${versionPattern})$`));
    assert.ok(match, `${owner}: every supported range must have an upper bound`);
    const minimum = (match[2] ?? match[3]).split(".").map(BigInt);
    if (match[4]) {
      const maximum = match[4].split(".").map(BigInt);
      assert.ok(compareVersions(minimum, maximum) < 0, `${owner}: the upper bound must exceed the lower bound`);
      return { minimum, maximum };
    }
    if (!match[1]) return { minimum, maximum: null };
    const boundary = minimum.findIndex((value) => value !== 0n);
    const index = boundary === -1 ? 2 : boundary;
    const maximum = minimum.map((value, position) => (position < index ? value : position === index ? value + 1n : 0n));
    return { minimum, maximum };
  });
}

export function validateCompatibility({ policy, rootManifest, packages, agentlintArchive }) {
  assert.equal(policy.schemaVersion, 1);
  assert.equal(
    policy.localAgentlint.registryCompatible,
    false,
    "Audit the public agentlint API before changing readiness",
  );
  assert.notEqual(policy.localAgentlint.integrity, policy.localAgentlint.registryIntegrity);
  assert.equal(
    `sha512-${createHash("sha512").update(agentlintArchive).digest("base64")}`,
    policy.localAgentlint.integrity,
    "The local agentlint archive changed; review its API and update compatibility evidence",
  );
  assert.equal(rootManifest.engines.node, policy.node, "Root Node support must match compatibility policy");
  const intervals = Object.fromEntries(
    Object.entries({ node: policy.node, ...policy.peerRanges }).map(([peer, range]) => [
      peer,
      supportedIntervals(range, peer),
    ]),
  );
  assert.deepEqual(
    Object.keys(policy.profiles).toSorted(),
    ["baseline", "current"],
    "Keep both baseline and current compatibility profiles",
  );
  for (const [name, profile] of Object.entries(policy.profiles)) {
    assert.deepEqual(
      Object.keys(profile).toSorted(),
      Object.keys(policy.peerRanges)
        .filter((peer) => peer !== "@aurelienbbn/agentlint")
        .toSorted(),
      `${name}: every public peer needs an explicit test version`,
    );
    for (const [dependency, version] of Object.entries({
      ...policy.sharedDependencies,
      ...profile,
    }))
      assert.match(version, new RegExp(`^${versionPattern}$`), `${name}/${dependency}: pin an exact reviewed release`);
    for (const [dependency, version] of Object.entries(profile)) {
      const selected = version.split(".").map(BigInt);
      assert.ok(
        intervals[dependency].some(({ minimum, maximum }) =>
          maximum === null
            ? compareVersions(selected, minimum) === 0
            : compareVersions(selected, minimum) >= 0 && compareVersions(selected, maximum) < 0,
        ),
        `${name}/${dependency}: the tested version must satisfy its declared peer range`,
      );
    }
  }
  for (const [name, version] of Object.entries(policy.profiles.baseline))
    if (rootManifest.devDependencies[name])
      assert.equal(
        rootManifest.devDependencies[name],
        version,
        `${name}: baseline must match the development toolchain`,
      );

  for (const { directory, manifest } of packages) {
    assert.equal(manifest.engines.node, policy.node, `${directory}: Node support must match compatibility policy`);
    const expectedPeers = directory.startsWith("agentlint-plugin-")
      ? ["@aurelienbbn/agentlint"]
      : directory.startsWith("oxlint-plugin-")
        ? ["oxlint"]
        : directory.startsWith("conformance-")
          ? ["vitest"]
          : directory === "oxlint-config"
            ? ["oxlint", "oxlint-tsgolint"]
            : directory === "oxfmt-config"
              ? ["oxfmt"]
              : directory.startsWith("stylelint-plugin-")
                ? ["stylelint"]
                : [];
    assert.deepEqual(
      Object.keys(manifest.peerDependencies ?? {}).toSorted(),
      expectedPeers.toSorted(),
      `${directory}: declare every consumer host as a peer`,
    );
    for (const [peer, range] of Object.entries(manifest.peerDependencies ?? {})) {
      assert.ok(
        Object.hasOwn(policy.peerRanges, peer),
        `${directory}/${peer}: add compatibility evidence for new peers`,
      );
      assert.equal(range, policy.peerRanges[peer], `${directory}/${peer}: use the reviewed bounded peer contract`);
    }
    if (directory.startsWith("agentlint-plugin-"))
      assert.equal(manifest.devDependencies["@aurelienbbn/agentlint"], policy.localAgentlint.developmentDependency);
  }
}
