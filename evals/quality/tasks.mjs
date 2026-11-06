export const tasks = [
  {
    id: "review",
    suite: "quality",
    prompt:
      'Review change.diff against proposed.mjs. Report correctness bugs only, no edits. Return your final answer as strict JSON {"findings":[{"line":1,"reason":"trigger and failure"}]}, with proposed.mjs line numbers. Empty arrays are valid.',
  },
  {
    id: "git",
    suite: "quality",
    prompt:
      "The fixture change fixes discount(100,20) returning 20 instead of 80, and adds a regression test. Write a commit message to commit.txt and a PR description to pr.txt; do not commit or publish. Explain the resulting behavior. No PR template exists. Use the repo convention.",
  },
  {
    id: "testing",
    suite: "quality",
    prompt:
      "Fix discount(100,20): expected remaining price 80, actual 20. Use node:test in calc.test.mjs; node check.mjs scoped runs it. Prove the regression fails before the fix and passes after. Do not change check.mjs.",
  },
];
