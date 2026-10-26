import test from "node:test";
import assert from "node:assert/strict";
import { summarize, paired } from "./report.mjs";

test("missing mutation/judge stays missing; incomplete runs remain in denominator", () => {
  const rows = [
    {
      model: "gpt-6.1-sol",
      condition: "none",
      run: { status: "timeout", tokens: {}, toolCalls: [], costEstimateUsd: 0.3 },
      pass: false,
    },
  ];
  const group = summarize(rows)[0];

  assert.equal(group.n, 1);
  assert.equal(group.planned, 10);
  assert.equal(group.pass, 0);
  assert.equal(group.mutation, null);
  assert.equal(group.exports, null);
  assert.equal(group.added, null);
  assert.equal(group.sourceMeasured, 0);
  assert.equal(group.judge.tests, null);
  assert.equal(group.usd, 0.3);
});

test("paired comparisons match task, model and repetition, never unmatched averages", () => {
  const run = { status: "completed", costEstimateUsd: 0.1 };
  const rows = [
    {
      id: "base",
      task: "codec",
      model: "sol",
      seed: 1,
      condition: "none",
      run,
      acceptance: { pass: false },
    },
    {
      id: "full",
      task: "codec",
      model: "sol",
      seed: 1,
      condition: "full",
      run,
      acceptance: { pass: true },
    },
    { id: "other", task: "codec", model: "sol", seed: 2, condition: "full", run },
  ];
  const pairs = paired(rows);

  assert.equal(pairs[0].baseline, "base");
  assert.equal(pairs[0].acceptanceDelta, 1);
  assert.equal(pairs[0].mutationDelta, null);
  assert.equal(pairs[1].paired, false);
});
