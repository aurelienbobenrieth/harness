import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const keyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const shopifySurfaces = new Set([
  "app-home",
  "admin-extension",
  "checkout",
  "customer-account",
  "functions",
  "server",
  "sidekick",
  "storefront",
  "listing",
]);
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const mapping = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Validate coverage references independently of whether any app has passed review. */
export function validateShopifyPolicy(policy) {
  assert.equal(policy.schemaVersion, 1, "Shopify policy schemaVersion must be 1");
  assert.match(policy.reviewedAt, /^\d{4}-\d{2}-\d{2}$/u, "Record the source review date");
  assert.ok(mapping(policy.programs) && Object.keys(policy.programs).length === 2, "Record both requirement programs");
  assert.ok(mapping(policy.protocols) && Object.keys(policy.protocols).length > 0, "Record evidence protocols");
  assert.ok(mapping(policy.tools), "Record the tool inventory");
  const sources = new Map();
  for (const source of policy.sources) {
    assert.match(source.id, keyPattern);
    assert.ok(!sources.has(source.id), `Duplicate source ${source.id}`);
    const url = new URL(source.url);
    assert.ok(
      url.protocol === "https:" &&
        url.hostname === "shopify.dev" &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash,
      `${source.id}: use a canonical official source`,
    );
    assert.match(source.sha256, /^[a-f0-9]{64}$/u, `${source.id}: record the normalized Markdown hash`);
    assert.equal(source.reviewedAt, policy.reviewedAt, `${source.id}: review dates must agree`);
    assert.ok(Array.isArray(source.requirementIds), `${source.id}: enumerate requirement IDs`);
    assert.equal(
      new Set(source.requirementIds).size,
      source.requirementIds.length,
      `${source.id}: duplicate requirement IDs`,
    );
    for (const id of source.requirementIds) assert.match(id, /^\d+\.\d+\.\d+$/u);
    sources.set(source.id, source);
  }
  for (const id of ["app-store", "bfs"]) {
    assert.ok(mapping(policy.programs[id]), `Missing program ${id}`);
    assert.ok(sources.get(id)?.requirementIds.length > 0, `${id}: missing source requirement inventory`);
    assert.equal(policy.programs[id].url, sources.get(id).url, `${id}: source URL differs`);
    const categories = policy.programs[id].categories;
    assert.ok(
      Array.isArray(categories) && categories.length > 0 && categories.every((category) => keyPattern.test(category)),
      `${id}: define category applicability`,
    );
    assert.equal(new Set(categories).size, categories.length, `${id}: duplicate categories`);
  }
  for (const [id, protocol] of Object.entries(policy.protocols)) {
    assert.match(id, keyPattern);
    assert.ok(["review", "runtime", "external"].includes(protocol.kind), `${id}: invalid protocol kind`);
    assert.ok(nonempty(protocol.evidence), `${id}: missing evidence instructions`);
  }
  for (const [id, tool] of Object.entries(policy.tools)) {
    assert.match(id, keyPattern);
    assert.ok(["rule", "check", "export", "upstream"].includes(tool.kind), `${id}: invalid tool kind`);
    assert.ok(nonempty(tool.boundary), `${id}: state the partial coverage boundary`);
    if (tool.kind !== "upstream") {
      assert.match(tool.package, /^(?:oxlint|agentlint)-plugin-shopify-app$|^conformance-shopify-app$/u);
      assert.ok(nonempty(tool.member), `${id}: identify a registered member`);
    } else assert.ok(nonempty(tool.reference), `${id}: identify the upstream configuration`);
  }
  const expected = [...sources.values()]
    .flatMap((source) => source.requirementIds.map((id) => `${source.id}/${id}`))
    .toSorted();
  const actual = policy.requirements.map((entry) => entry.id).toSorted();
  assert.deepEqual(actual, expected, "Every source requirement needs exactly one disposition");
  const usedTools = new Set();
  const usedSources = new Set(["app-store", "bfs"]);
  for (const entry of [...policy.requirements, ...policy.guidance]) {
    assert.ok(sources.has(entry.source), `${entry.id}: unknown source`);
    usedSources.add(entry.source);
    assert.ok(Object.hasOwn(policy.protocols, entry.protocol), `${entry.id}: unknown evidence protocol`);
    assert.ok(
      Array.isArray(entry.tools) && new Set(entry.tools).size === entry.tools.length,
      `${entry.id}: tools must be a distinct list`,
    );
    for (const id of entry.tools) {
      assert.ok(Object.hasOwn(policy.tools, id), `${entry.id}: unknown tool ${id}`);
      usedTools.add(id);
    }
  }
  for (const entry of policy.requirements) {
    assert.equal(entry.id.split("/")[0], entry.source, `${entry.id}: source mismatch`);
    const requirementId = entry.id.split("/")[1];
    const category = requirementId.startsWith("5.")
      ? policy.programs[entry.source].categories[Number(requirementId.split(".")[1]) - 1]
      : "general";
    assert.ok(nonempty(category), `${entry.id}: source category has no applicability mapping`);
    assert.equal(entry.category, category, `${entry.id}: category mapping differs from source order`);
  }
  assert.equal(new Set(policy.guidance.map((entry) => entry.id)).size, policy.guidance.length, "Duplicate guidance ID");
  for (const entry of policy.guidance) {
    assert.match(entry.id, keyPattern, "Guidance IDs must be nonempty kebab-case identifiers");
    assert.ok(!actual.includes(entry.id), `${entry.id}: guidance collides with a requirement`);
    assert.ok(
      Array.isArray(entry.surfaces) &&
        entry.surfaces.length > 0 &&
        new Set(entry.surfaces).size === entry.surfaces.length &&
        entry.surfaces.every((surface) => shopifySurfaces.has(surface)),
      `${entry.id}: identify distinct supported surfaces`,
    );
  }
  assert.deepEqual(
    [...usedTools].toSorted(),
    Object.keys(policy.tools).toSorted(),
    "Every tool needs a source mapping",
  );
  assert.deepEqual(
    [...usedSources].toSorted(),
    [...sources.keys()].toSorted(),
    "Every reviewed source needs a disposition",
  );
  return {
    requirements: actual.length,
    sources: sources.size,
    tools: usedTools.size,
    guidance: policy.guidance.length,
  };
}

/** Explicit category selection narrows applicability; unspecified categories remain included. */
export function createShopifyReviewPlan(policy, profile) {
  validateShopifyPolicy(policy);
  assert.ok(mapping(profile), "Provide a review profile object");
  assert.ok(
    Array.isArray(profile.programs) &&
      profile.programs.length > 0 &&
      new Set(profile.programs).size === profile.programs.length &&
      profile.programs.every((id) => Object.hasOwn(policy.programs, id)),
    "Select distinct known programs",
  );
  for (const key of Object.keys(profile))
    assert.ok(["programs", "categories", "surfaces"].includes(key), `Unknown profile key ${key}`);
  assert.ok(
    profile.surfaces === undefined ||
      (Array.isArray(profile.surfaces) &&
        new Set(profile.surfaces).size === profile.surfaces.length &&
        profile.surfaces.every((surface) => shopifySurfaces.has(surface))),
    "Select distinct known surfaces",
  );
  const programs = new Set(profile.programs.includes("bfs") ? [...profile.programs, "app-store"] : profile.programs);
  assert.ok(profile.categories === undefined || mapping(profile.categories), "categories must be a program mapping");
  for (const [program, categories] of Object.entries(profile.categories ?? {})) {
    assert.ok(programs.has(program), `Categories for unselected program ${program}`);
    assert.ok(
      Array.isArray(categories) &&
        new Set(categories).size === categories.length &&
        categories.every((category) => policy.programs[program].categories.includes(category)),
      `${program}: select distinct known categories`,
    );
  }
  const selected = policy.requirements.filter(
    (entry) =>
      programs.has(entry.source) &&
      (entry.category === "general" ||
        profile.categories?.[entry.source] === undefined ||
        profile.categories[entry.source].includes(entry.category)),
  );
  const sources = new Map(policy.sources.map((source) => [source.id, source.url]));
  return {
    schemaVersion: 1,
    sourceReviewDate: policy.reviewedAt,
    status: "unreviewed",
    surfaces: profile.surfaces ?? "all-until-triaged",
    applicability: Object.fromEntries(
      [...programs].map((program) => [program, profile.categories?.[program] ?? "all-until-triaged"]),
    ),
    requirements: selected.map((entry) => ({
      ...entry,
      status: "pending",
      url: sources.get(entry.source),
      evidence: policy.protocols[entry.protocol],
      tools: entry.tools.map((id) => ({ id, ...policy.tools[id] })),
    })),
    guidance: policy.guidance
      .filter(
        (entry) =>
          profile.surfaces === undefined || entry.surfaces.some((surface) => profile.surfaces.includes(surface)),
      )
      .map((entry) => ({
        ...entry,
        status: "pending",
        url: sources.get(entry.source),
        evidence: policy.protocols[entry.protocol],
      })),
  };
}

/** Detect text changes as well as renumbered/added/removed requirements. */
export function compareShopifySource(source, markdown) {
  const normalized = markdown.replaceAll("\r\n", "\n");
  const sha256 = createHash("sha256").update(normalized).digest("hex");
  const pattern = source.id === "bfs" ? /^#### (\d+\.\d+\.\d+) /gmu : /^(\d+\.\d+\.\d+)\*\*/gmu;
  const currentIds = source.requirementIds.length > 0 ? [...normalized.matchAll(pattern)].map((match) => match[1]) : [];
  return {
    source: source.id,
    changed: sha256 !== source.sha256,
    sha256,
    added: currentIds.filter((id) => !source.requirementIds.includes(id)),
    removed: source.requirementIds.filter((id) => !currentIds.includes(id)),
  };
}
