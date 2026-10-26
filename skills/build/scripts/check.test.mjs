import test from "node:test";
import assert from "node:assert/strict";
import { check, compact } from "./check.mjs";

test("keeps the first diagnostic per file and removes repeated failures", () => {
  assert.equal(
    compact("noise\na.ts:2 error first\na.ts:3 error second\nb.ts:1 error next\nb.ts:1 error next"),
    "a.ts:2 error first\nb.ts:1 error next",
  );
});
test("preserves nonzero status and missing diagnostic output", () => {
  assert.deepEqual(check(["-e", "console.log('opaque');process.exit(7)"]), {
    status: 7,
    summary: "opaque\n",
  });
  assert.equal(check(["-e", "console.log('lots of passing output')"]).summary, "PASS");
  assert.throws(() => check([]), /Usage/u);
});
