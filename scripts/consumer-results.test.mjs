import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { validateConsumerResults } from "./consumer-results.mjs";

const root = path.resolve("consumer");
const options = { root, expectedFiles: ["acceptance.test.ts"] };
const result = (status = "passed") => ({
  ancestorTitles: ["core conformance"],
  fullName: "core conformance dead-exports: checks unused exports",
  title: "dead-exports: checks unused exports",
  status,
});
const report = () => ({
  success: true,
  numFailedTestSuites: 0,
  numFailedTests: 0,
  numTodoTests: 0,
  numPassedTests: 1,
  numPendingTests: 0,
  numTotalTests: 1,
  testResults: [{ name: path.join(root, "acceptance.test.ts"), status: "passed", assertionResults: [result()] }],
});
const skippedReport = () => {
  const input = report();
  input.testResults[0].assertionResults.push(result("pending"));
  input.numPendingTests = 1;
  input.numTotalTests = 2;
  return input;
};
const skipOptions = {
  ...options,
  allowedSkips: [{ file: "acceptance.test.ts", ancestorTitles: ["core conformance"], check: "dead-exports" }],
};

test("accepts actual passing evidence without fixing the number of future cases", () => {
  assert.deepEqual(validateConsumerResults(report(), options), { files: 1, passed: 1, skipped: 0 });
  const input = report();
  input.testResults[0].assertionResults.push({ ...result(), title: "another behavior" });
  input.numPassedTests += 1;
  input.numTotalTests += 1;
  assert.equal(validateConsumerResults(input, options).passed, 2);
});

test("rejects zero tests and missing selected test files even with success=true", () => {
  const empty = { ...report(), numPassedTests: 0, numTotalTests: 0, testResults: [] };
  assert.throws(() => validateConsumerResults(empty, options), /must execute passing tests/);
  assert.throws(
    () =>
      validateConsumerResults(report(), {
        ...options,
        expectedFiles: ["acceptance.test.ts", "exports.test.ts"],
      }),
    /Execute every selected consumer test file/,
  );
});

test("rejects skipped or unfinished registry evidence", () => {
  assert.throws(() => validateConsumerResults(skippedReport(), options), /unexpected skipped test/);
  assert.throws(() => validateConsumerResults({ ...report(), numTodoTests: 1 }, options), /unfinished tests/);
});

test("allows a named draft exclusion only in its original suite and file", () => {
  assert.deepEqual(validateConsumerResults(skippedReport(), skipOptions), {
    files: 1,
    passed: 1,
    skipped: 1,
  });
  const runtimeSkip = skippedReport();
  runtimeSkip.testResults[0].assertionResults[1].status = "skipped";
  assert.equal(validateConsumerResults(runtimeSkip, skipOptions).skipped, 1);
  assert.throws(() => validateConsumerResults(runtimeSkip, options), /unexpected skipped test/);
  const unrelatedSuite = skippedReport();
  unrelatedSuite.testResults[0].assertionResults[1].ancestorTitles = ["generated scaffold"];
  assert.throws(() => validateConsumerResults(unrelatedSuite, skipOptions), /unexpected skipped test/);
  const unrelatedFile = skippedReport();
  unrelatedFile.testResults[0].name = path.join(root, "generated.test.ts");
  assert.throws(() => validateConsumerResults(unrelatedFile, skipOptions), /unexpected skipped test/);
});

test("does not allow one approved skip to hide multiple excluded checks", () => {
  const input = skippedReport();
  input.testResults[0].assertionResults.push(result("pending"));
  input.numPendingTests += 1;
  input.numTotalTests += 1;
  assert.throws(() => validateConsumerResults(input, skipOptions), /must identify one check/);
});

test("rejects failed files, unknown result states, and inconsistent summaries", () => {
  const failed = report();
  failed.testResults[0].status = "failed";
  assert.throws(() => validateConsumerResults(failed, options), /consumer suite must pass/);
  const unknown = report();
  unknown.testResults[0].assertionResults[0].status = "unknown";
  assert.throws(() => validateConsumerResults(unknown, options), /unsupported consumer result/);
  assert.throws(() => validateConsumerResults({ ...report(), numPassedTests: 9 }, options), /passing count/);
  assert.throws(() => validateConsumerResults({ ...report(), numPendingTests: 9 }, options), /skipped count/);
  assert.throws(() => validateConsumerResults({ ...report(), numTotalTests: 9 }, options), /total must match/);
});
