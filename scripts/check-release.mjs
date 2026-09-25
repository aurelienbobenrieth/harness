import assert from "node:assert/strict";
import path from "node:path";
import { readReleaseInputs, readWorkflows, validateReleasePolicy, validateWorkflowPolicy } from "./release-policy.mjs";

try {
  assert.equal(process.argv.length, 2, "release:check does not accept arguments.");
  const root = path.resolve(import.meta.dirname, "..");
  const inputs = await readReleaseInputs(root);
  validateReleasePolicy(inputs);
  validateWorkflowPolicy(await readWorkflows(root));
  assert.equal(
    inputs.rootManifest.scripts.release,
    "node scripts/release.mjs",
    "The release entrypoint must prepare without publishing.",
  );
  assert.equal(
    inputs.rootManifest.scripts["security:check"],
    "pnpm audit --audit-level=low",
    "Audit all dependency classes without ignoring known advisories or registry errors.",
  );
  console.log(
    `Release policy valid: ${inputs.manifests.length} classified packages; publishing ${inputs.policy.publicationEnabled ? "enabled through the reviewed npm environment" : "disabled"}.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
