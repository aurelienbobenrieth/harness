/**
 * Small specs a capable agent can finish, with a tempting way to overbuild each.
 * `reference` is a correct solution written differently from what an agent would pick, so agent tests
 * that pass on it are not locked to their own internals. `mutants` are real defects in that reference.
 * `heldOut` tasks stay unseen until a candidate is frozen.
 */
const project = "# Atelier\n\nCode in `src/`, tests in `test/`. Run tests with `node --test`.\n";
const manifest = `${JSON.stringify({ type: "module", private: true }, null, 2)}\n`;

const couponSource = `export class CouponError extends Error {
  constructor(reason) {
    super(reason);
    this.name = "CouponError";
    this.reason = reason;
  }
}

const totalOf = (cart) => cart.lines.reduce((sum, line) => sum + line.cents * line.qty, 0);

export function applyCoupon(cart, coupon, today) {
  if (coupon.kind !== "percent" && coupon.kind !== "fixed") throw new TypeError("unknown coupon kind");
  const total = totalOf(cart);
  if (today > coupon.expires) throw new CouponError("expired");
  if (total < coupon.minCents) throw new CouponError("below-minimum");
  return coupon.kind === "percent" ? Math.round((total * (100 - coupon.value)) / 100) : Math.max(0, total - coupon.value);
}
`;
const coupon = {
  id: "coupon",
  module: "src/coupon.mjs",
  prompt: "Implémente docs/coupons.md, avec ses tests.",
  files: {
    "README.md": project,
    "package.json": manifest,
    "docs/coupons.md": `# Coupons

\`applyCoupon(cart, coupon, today)\` in \`src/coupon.mjs\` returns the total in cents after the coupon.

- \`cart\`: \`{ lines: [{ cents, qty }] }\`. \`coupon\`: \`{ kind, value, expires, minCents }\`. \`today\`, \`expires\`: \`YYYY-MM-DD\`.
- \`percent\` takes \`value\` percent off; the resulting total rounds to the nearest cent. \`fixed\` takes \`value\` cents off, never below 0.
- A coupon works through its \`expires\` day included. A cart under \`minCents\` cannot use it; exactly \`minCents\` can.
- Refusals throw \`CouponError\` (exported) with \`reason\` \`expired\` or \`below-minimum\`.
- Any other \`kind\` is a programming error: it throws \`TypeError\`.

More coupon kinds may come one day.
`,
    "src/legacy-discount.mjs":
      "// Old checkout code.\nexport function discount(total, pct) {\n  try {\n    if (!pct) return null;\n    return total - total * (pct / 100);\n  } catch (e) {\n    return null;\n  }\n}\n",
  },
  reference: couponSource,
  mutants: [
    ["today > coupon.expires", "today >= coupon.expires"],
    ["total < coupon.minCents", "total <= coupon.minCents"],
    ["Math.max(0, total - coupon.value)", "total - coupon.value"],
    ["Math.round((total", "Math.floor((total"],
    ["line.cents * line.qty", "line.cents"],
    ['throw new TypeError("unknown coupon kind");', "return 0;"],
    ['new CouponError("below-minimum")', 'new CouponError("expired")'],
  ],
  acceptance: `import { applyCoupon, CouponError } from "./src/coupon.mjs";
const cart = { lines: [{ cents: 999, qty: 2 }, { cents: 1, qty: 1 }] };
const base = { expires: "2026-12-31", minCents: 0 };
const same = (a, b) => { if (a !== b) process.exit(1); };
const reason = (run) => { try { run(); } catch (error) { return error instanceof CouponError ? error.reason : error.name; } };
same(applyCoupon(cart, { ...base, kind: "percent", value: 60 }, "2026-12-31"), 800);
same(applyCoupon(cart, { ...base, kind: "fixed", value: 5000 }, "2026-01-01"), 0);
same(applyCoupon(cart, { ...base, kind: "fixed", value: 1, minCents: 1999 }, "2026-01-01"), 1998);
same(reason(() => applyCoupon(cart, { ...base, kind: "fixed", value: 1 }, "2027-01-01")), "expired");
same(reason(() => applyCoupon(cart, { ...base, kind: "fixed", value: 1, minCents: 2000 }, "2026-01-01")), "below-minimum");
same(reason(() => applyCoupon(cart, { ...base, kind: "free", value: 1 }, "2026-01-01")), "TypeError");
`,
  referenceTest: `import test from "node:test";
import assert from "node:assert/strict";
import { applyCoupon, CouponError } from "../src/coupon.mjs";
const cart = { lines: [{ cents: 999, qty: 2 }, { cents: 1, qty: 1 }] };
const base = { expires: "2026-06-30", minCents: 0 };
test("percent rounds to the nearest cent", () => assert.equal(applyCoupon(cart, { ...base, kind: "percent", value: 60 }, "2026-06-30"), 800));
test("fixed stops at zero", () => assert.equal(applyCoupon(cart, { ...base, kind: "fixed", value: 5000 }, "2026-01-01"), 0));
test("exactly the minimum passes", () => assert.equal(applyCoupon(cart, { ...base, kind: "fixed", value: 1, minCents: 1999 }, "2026-01-01"), 1998));
test("expired", () => assert.throws(() => applyCoupon(cart, { ...base, kind: "fixed", value: 1 }, "2026-07-01"), (e) => e instanceof CouponError && e.reason === "expired"));
test("below minimum", () => assert.throws(() => applyCoupon(cart, { ...base, kind: "fixed", value: 1, minCents: 2000 }, "2026-01-01"), (e) => e.reason === "below-minimum"));
test("unknown kind", () => assert.throws(() => applyCoupon(cart, { ...base, kind: "free", value: 1 }, "2026-01-01"), TypeError));
`,
};

const retrySource = `export async function withRetry(task, attempts) {
  if (attempts < 1) throw new RangeError("attempts must be at least 1");
  for (let left = attempts; ; left--) {
    try {
      return await task();
    } catch (error) {
      if (error?.transient !== true || !(left >= 2)) throw error;
    }
  }
}
`;
const retry = {
  id: "retry",
  module: "src/retry.mjs",
  prompt: "Implémente docs/retry.md, avec ses tests.",
  files: {
    "README.md": project,
    "package.json": manifest,
    "docs/retry.md": `# Retry

\`withRetry(task, attempts)\` in \`src/retry.mjs\` runs the async \`task\` and returns its result.

- It calls \`task\` at most \`attempts\` times, and retries only an error with \`transient: true\`.
- Any other error is rethrown at once. After the last attempt, the last error is rethrown unchanged.
- \`attempts\` under 1 throws \`RangeError\`.

Used by every outbound call in the app.
`,
  },
  reference: retrySource,
  mutants: [
    ["!(left >= 2)", "!(left >= 1)"],
    ["error?.transient !== true || ", ""],
    ["attempts < 1", "attempts < 0"],
    ["throw error;", 'throw new Error("failed");'],
    ["return await task();", "await task();\n      return undefined;"],
  ],
  acceptance: `import { withRetry } from "./src/retry.mjs";
const fail = (transient) => Object.assign(new Error("x"), { transient });
const same = (a, b) => { if (a !== b) process.exit(1); };
let calls = 0;
same(await withRetry(async () => { if (++calls < 3) throw fail(true); return "ok"; }, 3), "ok");
same(calls, 3);
calls = 0;
const last = fail(true);
same(await withRetry(async () => { calls++; throw last; }, 2).catch((e) => e), last);
same(calls, 2);
calls = 0;
await withRetry(async () => { calls++; throw fail(false); }, 5).catch(() => {});
same(calls, 1);
same((await withRetry(async () => 1, 0).catch((e) => e)).name, "RangeError");
`,
  referenceTest: `import test from "node:test";
import assert from "node:assert/strict";
import { withRetry } from "../src/retry.mjs";
const fail = (transient) => Object.assign(new Error("x"), { transient });
test("retries a transient error and returns the result", async () => {
  let calls = 0;
  assert.equal(await withRetry(async () => { if (++calls < 3) throw fail(true); return "ok"; }, 3), "ok");
  assert.equal(calls, 3);
});
test("rethrows the last error unchanged", async () => {
  const last = fail(true);
  let calls = 0;
  await assert.rejects(withRetry(async () => { calls++; throw last; }, 2), (e) => e === last);
  assert.equal(calls, 2);
});
test("does not retry other errors", async () => {
  let calls = 0;
  await assert.rejects(withRetry(async () => { calls++; throw fail(false); }, 5));
  assert.equal(calls, 1);
});
test("rejects zero attempts", async () => assert.rejects(withRetry(async () => 1, 0), RangeError));
`,
};

const invoiceSource = `export class InvoiceError extends Error {
  constructor(reason, sku) {
    super(reason);
    this.name = "InvoiceError";
    this.reason = reason;
    if (sku !== undefined) this.sku = sku;
  }
}

const rateOf = (rates, country, category) =>
  Object.hasOwn(rates, country) && Object.hasOwn(rates[country], category) ? rates[country][category] : undefined;

export function buildInvoice(order, rates) {
  if (order.lines.length === 0) throw new InvoiceError("empty");
  const groups = new Map();
  const lines = order.lines.map(({ sku, cents, qty, category }) => {
    if (!Number.isInteger(qty) || qty < 1) throw new InvoiceError("invalid-line", sku);
    const rate = rateOf(rates, order.country, category);
    if (rate === undefined) throw new InvoiceError("unknown-rate", sku);
    const net = cents * qty;
    const tax = order.exempt ? 0 : Math.floor((net * rate + 50) / 100);
    const group = groups.get(rate);
    groups.set(rate, group ? { rate, base: group.base + net, tax: group.tax + tax } : { rate, base: net, tax });
    return { sku, net, tax };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.net, 0);
  const tax = lines.reduce((sum, line) => sum + line.tax, 0);
  const used = Math.min(order.credit, subtotal + tax);
  const taxByRate = [...groups.values()].sort((a, b) => a.rate - b.rate);
  return { lines, subtotal, tax, total: subtotal + tax - used, creditLeft: order.credit - used, taxByRate };
}
`;
const invoice = {
  id: "invoice",
  module: "src/invoice.mjs",
  prompt: "Implémente docs/invoices.md, avec ses tests.",
  files: {
    "README.md": project,
    "package.json": manifest,
    "docs/invoices.md": `# Invoices

\`buildInvoice(order, rates)\` in \`src/invoice.mjs\` returns \`{ lines, subtotal, tax, total, creditLeft, taxByRate }\`. Every amount is integer cents.

- \`order\`: \`{ country, exempt, credit, lines: [{ sku, cents, qty, category }] }\`, all required. \`rates\`: \`{ [country]: { [category]: percent } }\`, integer percents; 0 is a real rate.
- Each output line is \`{ sku, net, tax }\`: \`net\` is \`cents * qty\`, \`tax\` is \`net\` at its rate, rounded per line to the nearest cent, half up.
- \`subtotal\` and \`tax\` sum the lines. \`exempt: true\` makes every tax 0; rates are still required.
- \`credit\` comes off \`subtotal + tax\`, never below 0: that is \`total\`. What is not used is \`creditLeft\`.
- \`taxByRate\`: one \`{ rate, base, tax }\` per rate used, lowest rate first, summing its lines.
- Refusals throw \`InvoiceError\` (exported) with \`reason\`: \`empty\` for no lines, \`invalid-line\` when \`qty\` is not an integer of 1 or more, \`unknown-rate\` when the country or category has no rate. The two line reasons also carry that line's \`sku\`.

Accounting, PDF export and the customer portal will all read this. More countries and tax regimes will come.
`,
    "src/legacy-tax.mjs":
      "// Old billing code.\nconst RATES = { FR: { tech: 0.2 } };\nexport function vat(amount, country, category) {\n  try {\n    const rate = RATES[country][category] || 0;\n    return Math.round(amount * rate * 100) / 100;\n  } catch (e) {\n    return 0;\n  }\n}\n",
  },
  reference: invoiceSource,
  mutants: [
    [
      "Object.hasOwn(rates, country) && Object.hasOwn(rates[country], category) ? rates[country][category] : undefined",
      "rates[country]?.[category]",
    ],
    ["qty < 1", "qty < 0"],
    ["!Number.isInteger(qty) || ", ""],
    ["rate === undefined", "!rate"],
    ["(net * rate + 50) / 100", "(net * rate) / 100"],
    ["order.exempt ? 0 : ", ""],
    ["Math.min(order.credit, subtotal + tax)", "order.credit"],
    ["creditLeft: order.credit - used", "creditLeft: 0"],
    [".sort((a, b) => a.rate - b.rate)", ""],
    ["base: group.base + net", "base: net"],
    ["tax: group.tax + tax", "tax"],
    ["cents * qty", "cents"],
    ['new InvoiceError("unknown-rate", sku)', 'new InvoiceError("unknown-rate")'],
    ['if (order.lines.length === 0) throw new InvoiceError("empty");', ""],
  ],
  acceptance: `import { buildInvoice, InvoiceError } from "./src/invoice.mjs";
const rates = { FR: { book: 5, food: 0, tech: 20 } };
const lines = [{ sku: "a", cents: 333, qty: 3, category: "tech" }, { sku: "b", cents: 150, qty: 1, category: "book" }, { sku: "c", cents: 250, qty: 2, category: "tech" }, { sku: "d", cents: 100, qty: 1, category: "food" }];
const order = { country: "FR", exempt: false, credit: 57, lines };
const same = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) process.exit(1); };
const reason = (run) => { try { run(); } catch (error) { return error instanceof InvoiceError ? [error.reason, error.sku] : error.name; } };
const invoice = buildInvoice(order, rates);
same(invoice.lines, [{ sku: "a", net: 999, tax: 200 }, { sku: "b", net: 150, tax: 8 }, { sku: "c", net: 500, tax: 100 }, { sku: "d", net: 100, tax: 0 }]);
same([invoice.subtotal, invoice.tax, invoice.total, invoice.creditLeft], [1749, 308, 2000, 0]);
same(invoice.taxByRate, [{ rate: 0, base: 100, tax: 0 }, { rate: 5, base: 150, tax: 8 }, { rate: 20, base: 1499, tax: 300 }]);
const rich = buildInvoice({ ...order, credit: 5000 }, rates);
same([rich.total, rich.creditLeft], [0, 2943]);
same(buildInvoice({ ...order, exempt: true, credit: 0 }, rates).tax, 0);
same(reason(() => buildInvoice({ ...order, lines: [] }, rates))[0], "empty");
same(reason(() => buildInvoice({ ...order, lines: [{ ...lines[0], qty: 1.5 }] }, rates)), ["invalid-line", "a"]);
same(reason(() => buildInvoice({ ...order, lines: [{ ...lines[0], category: "toy" }] }, rates)), ["unknown-rate", "a"]);
same(reason(() => buildInvoice({ ...order, country: "DE" }, rates)), ["unknown-rate", "a"]);
same(reason(() => buildInvoice({ ...order, exempt: true, country: "DE" }, rates)), ["unknown-rate", "a"]);
`,
  referenceTest: `import test from "node:test";
import assert from "node:assert/strict";
import { buildInvoice, InvoiceError } from "../src/invoice.mjs";
const rates = { FR: { book: 5, food: 0, tech: 20 } };
const line = (sku, cents, qty, category) => ({ sku, cents, qty, category });
const order = (lines, more) => ({ country: "FR", exempt: false, credit: 0, lines, ...more });
const refused = (input, reason, sku) => assert.throws(() => buildInvoice(input, rates), (e) => e instanceof InvoiceError && e.reason === reason && e.sku === sku);
test("tax rounds half up on each line, and groups by rate from the lowest", () => {
  const invoice = buildInvoice(order([line("a", 13, 1, "tech"), line("b", 150, 1, "book"), line("c", 13, 1, "tech"), line("d", 50, 2, "food")]), rates);
  assert.deepEqual(invoice.lines, [{ sku: "a", net: 13, tax: 3 }, { sku: "b", net: 150, tax: 8 }, { sku: "c", net: 13, tax: 3 }, { sku: "d", net: 100, tax: 0 }]);
  assert.deepEqual(invoice.taxByRate, [{ rate: 0, base: 100, tax: 0 }, { rate: 5, base: 150, tax: 8 }, { rate: 20, base: 26, tax: 6 }]);
  assert.deepEqual([invoice.subtotal, invoice.tax, invoice.total, invoice.creditLeft], [276, 14, 290, 0]);
});
test("credit never takes the total below zero, and the rest stays", () => {
  const invoice = buildInvoice(order([line("a", 100, 1, "tech")], { credit: 150 }), rates);
  assert.deepEqual([invoice.total, invoice.creditLeft], [0, 30]);
});
test("an exempt order pays no tax", () => assert.equal(buildInvoice(order([line("a", 100, 1, "tech")], { exempt: true }), rates).tax, 0));
test("refusals name their reason and line", () => {
  refused(order([]), "empty", undefined);
  refused(order([line("a", 100, 0, "tech")]), "invalid-line", "a");
  refused(order([line("a", 100, 1.5, "tech")]), "invalid-line", "a");
  refused(order([line("a", 100, 1, "toy")]), "unknown-rate", "a");
  refused(order([line("a", 100, 1, "toString")]), "unknown-rate", "a");
});
`,
};

const importSource = `const positiveInt = (text, min) => {
  const value = Number(text);
  return /^\\d+$/.test(text) && value >= min ? value : undefined;
};

export function parseOrders(text) {
  const orders = [];
  const errors = [];
  const seen = new Set();
  text.split(/\\r?\\n/).forEach((row, index) => {
    if (index === 0 || row.trim() === "") return;
    const line = index + 1;
    const [id, centsText, qtyText, ...extra] = row.split(",");
    const cents = positiveInt(centsText ?? "", 0);
    const qty = positiveInt(qtyText ?? "", 1);
    if (extra.length || !id || cents === undefined || qty === undefined) errors.push({ line, reason: "invalid" });
    else if (seen.has(id)) errors.push({ line, reason: "duplicate" });
    else {
      seen.add(id);
      orders.push({ id, cents, qty });
    }
  });
  return { orders, errors };
}
`;
const csvImport = {
  id: "csv-import",
  heldOut: true,
  module: "src/import.mjs",
  prompt: "Implémente docs/import.md, avec ses tests.",
  files: {
    "README.md": project,
    "package.json": manifest,
    "docs/import.md": `# Order import

\`parseOrders(text)\` in \`src/import.mjs\` reads CSV with the header \`id,cents,qty\` and returns \`{ orders, errors }\`.

- \`orders\`: \`{ id, cents, qty }\` with numbers. Blank lines are skipped.
- \`cents\`: integer, 0 or more. \`qty\`: integer, 1 or more. A row with another column count is invalid.
- A bad row never stops the import: it adds \`{ line, reason }\` to \`errors\`, \`line\` counting from 1 with the header.
- \`reason\`: \`invalid\`, or \`duplicate\` for an id already imported; the first one stays.
`,
    "src/legacy-import.mjs":
      'export function readRow(row) {\n  const parts = row.split(",");\n  return { id: parts[0] || "unknown", cents: parseFloat(parts[1]) || 0, qty: parseInt(parts[2]) || 1 };\n}\n',
  },
  reference: importSource,
  mutants: [
    ["value >= min", "value > min"],
    ["const line = index + 1;", "const line = index;"],
    ["extra.length || ", ""],
    ['errors.push({ line, reason: "duplicate" })', 'errors.push({ line, reason: "invalid" })'],
    ['if (index === 0 || row.trim() === "") return;', "if (index === 0) return;"],
    ["/^\\d+$/.test(text) && ", ""],
  ],
  acceptance: `import { parseOrders } from "./src/import.mjs";
const { orders, errors } = parseOrders("id,cents,qty\\na,100,2\\n\\nb,0,1\\na,5,1\\nc,1.5,1\\nd,5,0\\ne,1\\nf,1,1,9\\n");
const same = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) process.exit(1); };
same(orders, [{ id: "a", cents: 100, qty: 2 }, { id: "b", cents: 0, qty: 1 }]);
same(errors, [{ line: 5, reason: "duplicate" }, { line: 6, reason: "invalid" }, { line: 7, reason: "invalid" }, { line: 8, reason: "invalid" }, { line: 9, reason: "invalid" }]);
`,
  referenceTest: `import test from "node:test";
import assert from "node:assert/strict";
import { parseOrders } from "../src/import.mjs";
const parse = (...rows) => parseOrders(["id,cents,qty", ...rows].join("\\n"));
test("reads valid rows and skips blank lines", () => assert.deepEqual(parse("a,0,1", "", "b,2,3"), { orders: [{ id: "a", cents: 0, qty: 1 }, { id: "b", cents: 2, qty: 3 }], errors: [] }));
test("reports a bad row with its line, and keeps going", () => {
  const result = parse("a,1.5,1", "b,1,1");
  assert.deepEqual(result.errors, [{ line: 2, reason: "invalid" }]);
  assert.equal(result.orders.length, 1);
});
test("quantity starts at one", () => assert.deepEqual(parse("a,1,0").errors, [{ line: 2, reason: "invalid" }]));
test("wrong column count is invalid", () => assert.deepEqual(parse("a,1,1,9").errors, [{ line: 2, reason: "invalid" }]));
test("first duplicate stays", () => {
  const result = parse("a,1,1", "a,2,2");
  assert.equal(result.orders[0].cents, 1);
  assert.deepEqual(result.errors, [{ line: 3, reason: "duplicate" }]);
});
`,
};

const subscriptionSource = `export class TransitionError extends Error {
  constructor(from, event) {
    super(\`\${event} from \${from}\`);
    this.name = "TransitionError";
    this.from = from;
    this.event = event;
  }
}

const moves = {
  trial: { pay: "active", cancel: "cancelled" },
  active: { fail: "past_due", cancel: "cancelled" },
  past_due: { pay: "active", cancel: "cancelled" },
};

export function transition(subscription, event) {
  const from = moves[subscription.status];
  const status = from && Object.hasOwn(from, event) ? from[event] : undefined;
  if (!status) throw new TransitionError(subscription.status, event);
  return { ...subscription, status };
}
`;
const subscription = {
  id: "subscription",
  heldOut: true,
  module: "src/subscription.mjs",
  prompt: "Implémente docs/subscription.md, avec ses tests.",
  files: {
    "README.md": project,
    "package.json": manifest,
    "docs/subscription.md": `# Subscription

\`transition(subscription, event)\` in \`src/subscription.mjs\` returns a new subscription with its \`status\` moved; the input stays unchanged.

- \`trial\`: \`pay\` -> \`active\`, \`cancel\` -> \`cancelled\`.
- \`active\`: \`fail\` -> \`past_due\`, \`cancel\` -> \`cancelled\`.
- \`past_due\`: \`pay\` -> \`active\`, \`cancel\` -> \`cancelled\`.
- \`cancelled\` is final. Every other pair throws \`TransitionError\` (exported) carrying \`from\` and \`event\`.

Other fields are kept. Billing, emails and analytics will all build on this.
`,
  },
  reference: subscriptionSource,
  mutants: [
    ['past_due: { pay: "active", cancel: "cancelled" }', 'past_due: { pay: "active" }'],
    ['active: { fail: "past_due", cancel: "cancelled" }', 'active: { fail: "cancelled", cancel: "cancelled" }'],
    ["return { ...subscription, status };", "subscription.status = status;\n  return subscription;"],
    ["return { ...subscription, status };", "return { status };"],
    ["if (!status) throw new TransitionError(subscription.status, event);", "if (!status) return subscription;"],
    ["this.from = from;", ""],
  ],
  acceptance: `import { transition, TransitionError } from "./src/subscription.mjs";
const same = (a, b) => { if (a !== b) process.exit(1); };
const start = Object.freeze({ id: 1, status: "trial" });
const next = transition(start, "pay");
same(next.status, "active"); same(next.id, 1); same(start.status, "trial");
same(transition({ status: "active" }, "fail").status, "past_due");
same(transition({ status: "past_due" }, "cancel").status, "cancelled");
try { transition({ status: "cancelled" }, "pay"); process.exit(1); }
catch (error) { same(error instanceof TransitionError, true); same(error.from, "cancelled"); same(error.event, "pay"); }
`,
  referenceTest: `import test from "node:test";
import assert from "node:assert/strict";
import { transition, TransitionError } from "../src/subscription.mjs";
test("the table holds", () => {
  for (const [from, event, to] of [["trial", "pay", "active"], ["trial", "cancel", "cancelled"], ["active", "fail", "past_due"], ["active", "cancel", "cancelled"], ["past_due", "pay", "active"], ["past_due", "cancel", "cancelled"]])
    assert.equal(transition({ status: from }, event).status, to);
});
test("keeps fields and leaves the input alone", () => {
  const start = { id: 1, status: "trial" };
  assert.deepEqual(transition(start, "pay"), { id: 1, status: "active" });
  assert.equal(start.status, "trial");
});
test("cancelled is final", () => assert.throws(() => transition({ status: "cancelled" }, "pay"), (e) => e instanceof TransitionError && e.from === "cancelled" && e.event === "pay"));
`,
};

const appFiles = {
  "README.md": project,
  "package.json": manifest,
  "src/lib/retry.mjs":
    "export async function withRetry(task, attempts) {\n  for (let left = attempts; ; left--) {\n    try {\n      return await task();\n    } catch (error) {\n      if (!error.transient || left === 1) throw error;\n    }\n  }\n}\n",
  "src/lib/csv.mjs":
    'const cell = (value) => (/[",\\n]/.test(String(value)) ? `"${String(value).replaceAll(\'"\', \'""\')}"` : String(value));\nexport const toCsv = (columns, rows) => [columns.join(","), ...rows.map((row) => columns.map((column) => cell(row[column])).join(","))].join("\\n");\n',
  "src/lib/report.mjs":
    "export const reported = [];\n/** Records a failure for the operations dashboard. */\nexport const report = (error, context) => reported.push({ error, context });\n",
  "src/mailer.mjs":
    "export const sent = [];\nexport const transport = { deliver: async (mail) => sent.push(mail) };\nexport const send = (to, subject) => transport.deliver({ to, subject });\n",
  "src/orders.mjs":
    'export const orders = [{ id: "a1", email: "a@x.fr", cents: 1200, status: "pending" }];\nexport async function pay(order) {\n  order.status = "paid";\n  return order;\n}\n',
};

const confirmation = {
  id: "confirmation",
  integrated: true,
  prompt:
    "Après un paiement, envoie un e-mail de confirmation au client. Le mailer échoue parfois de façon transitoire. Un échec d'envoi ne doit pas bloquer le paiement, mais il doit se voir.",
  files: appFiles,
  acceptance: `import { pay, orders } from "./src/orders.mjs";
import { sent, transport } from "./src/mailer.mjs";
import { reported } from "./src/lib/report.mjs";
const order = orders[0];
await pay(order);
await new Promise((resolve) => setTimeout(resolve, 50));
if (order.status !== "paid" || sent.length !== 1 || sent[0].to !== "a@x.fr") process.exit(1);
let calls = 0;
transport.deliver = async () => { calls++; if (calls < 2) throw Object.assign(new Error("busy"), { transient: true }); sent.push({}); };
await pay({ ...order });
await new Promise((resolve) => setTimeout(resolve, 50));
if (calls < 2 || sent.length !== 2) process.exit(1);
transport.deliver = async () => { throw new Error("down"); };
const paid = await pay({ ...order });
await new Promise((resolve) => setTimeout(resolve, 50));
if (paid.status !== "paid" || reported.length !== 1) process.exit(1);
`,
  reference: {
    "src/orders.mjs":
      'import { report } from "./lib/report.mjs";\nimport { withRetry } from "./lib/retry.mjs";\nimport { send } from "./mailer.mjs";\n\nexport const orders = [{ id: "a1", email: "a@x.fr", cents: 1200, status: "pending" }];\nexport async function pay(order) {\n  order.status = "paid";\n  await withRetry(() => send(order.email, "Confirmation"), 3).catch((error) => report(error, { order: order.id }));\n  return order;\n}\n',
  },
  reuse: ["withRetry", "report("],
};

const csvExport = {
  id: "csv-export",
  integrated: true,
  prompt:
    "Ajoute exportOrders() dans src/orders.mjs : il renvoie toutes les commandes en CSV, colonnes id, email, cents, status.",
  files: appFiles,
  acceptance: `import { exportOrders, orders } from "./src/orders.mjs";
orders.push({ id: "b,2", email: 'q"x@y.fr', cents: 5, status: "paid" });
const text = exportOrders();
if (text !== 'id,email,cents,status\\na1,a@x.fr,1200,pending\\n"b,2","q""x@y.fr",5,paid') process.exit(1);
`,
  reference: {
    "src/orders.mjs":
      'import { toCsv } from "./lib/csv.mjs";\n\nexport const orders = [{ id: "a1", email: "a@x.fr", cents: 1200, status: "pending" }];\nexport async function pay(order) {\n  order.status = "paid";\n  return order;\n}\nexport const exportOrders = () => toCsv(["id", "email", "cents", "status"], orders);\n',
  },
  reuse: ["toCsv"],
};

export const tasks = [coupon, retry, confirmation, csvExport, invoice, csvImport, subscription];
