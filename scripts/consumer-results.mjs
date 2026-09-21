import assert from "node:assert/strict";
import path from "node:path";

/** Validates executed consumer evidence, including each explicitly allowed unavailable check. */
export function validateConsumerResults(report, { root, expectedFiles, allowedSkips = [] }) {
  assert.equal(report.success, true, "Consumer report must record a successful run");
  assert.equal(report.numFailedTestSuites, 0, "Consumer suites must not fail");
  assert.equal(report.numFailedTests, 0, "Consumer tests must not fail");
  assert.equal(report.numTodoTests, 0, "Consumer evidence must not contain unfinished tests");
  assert.ok(Array.isArray(report.testResults), "Consumer report must include test results");
  const observedFiles = [];
  const observedSkips = new Set();
  let passed = 0;
  let skipped = 0;
  for (const file of report.testResults) {
    const relative = path.relative(root, file.name).replaceAll("\\", "/");
    observedFiles.push(relative);
    assert.equal(file.status, "passed", `${relative}: consumer suite must pass`);
    assert.ok(Array.isArray(file.assertionResults) && file.assertionResults.length > 0, `${relative}: execute tests`);
    for (const result of file.assertionResults) {
      if (result.status === "passed") {
        passed += 1;
        continue;
      }
      assert.ok(
        result.status === "pending" || result.status === "skipped",
        `${relative}: unsupported consumer result ${result.status}`,
      );
      const allowance = allowedSkips.findIndex(
        (entry) =>
          entry.file === relative &&
          JSON.stringify(entry.ancestorTitles) === JSON.stringify(result.ancestorTitles) &&
          result.title.startsWith(`${entry.check}:`),
      );
      assert.ok(allowance >= 0, `${relative}: unexpected skipped test ${result.fullName}`);
      assert.ok(!observedSkips.has(allowance), `${relative}: a skip allowance must identify one check`);
      observedSkips.add(allowance);
      skipped += 1;
    }
  }
  assert.ok(passed > 0, "Consumer evidence must execute passing tests");
  assert.deepEqual(observedFiles.toSorted(), expectedFiles.toSorted(), "Execute every selected consumer test file");
  assert.equal(report.numPassedTests, passed, "Consumer passing count must match executed results");
  assert.equal(report.numPendingTests, skipped, "Consumer skipped count must match approved exclusions");
  assert.equal(report.numTotalTests, passed + skipped, "Consumer total must match executed and excluded results");
  return { files: observedFiles.length, passed, skipped };
}
