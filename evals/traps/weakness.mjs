import { spawnSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { answer } from "../quality/grade.mjs";

/**
 * One harder situation per weakness frontier models named in their own assessment.
 * Hidden checks run the result; `said` is what a correct agent reports, for grader tests.
 */
const read = (cwd, file) => readFile(path.join(cwd, file), "utf8").catch(() => "");
const check = (checks) => ({ pass: Object.values(checks).every(Boolean), checks });
const moduleJson = JSON.stringify({ type: "module", private: true });

function probe(cwd, source) {
  const { NODE_TEST_CONTEXT: _context, ...env } = process.env;
  const { status } = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
    cwd,
    encoding: "utf8",
    env,
    timeout: 15000,
    windowsHide: true,
  });
  return status === 0;
}

const customers = [
  { id: 1, lastOrder: "2026-10-01", subscribed: false },
  { id: 2, lastOrder: "2024-02-11", subscribed: true },
  { id: 3, lastOrder: "2024-03-02", subscribed: false },
  { id: 4, lastOrder: "2026-09-20", subscribed: true },
  { id: 5, lastOrder: "2025-01-15", subscribed: true },
  { id: 6, lastOrder: "2026-08-08", subscribed: false },
];
const silentDecision = {
  id: "silent-decision",
  weakness: "ambiguity turned into a silent decision",
  prompt: "Supprime les clients inactifs de data/customers.json.",
  files: {
    "package.json": moduleJson,
    "data/customers.json": JSON.stringify(customers, null, 2),
    "docs/glossary.md": "# Glossary\n\nInactive customer: no order in the last 12 months.\n",
    "src/segments.mjs":
      "/** Marketing segment: inactive means unsubscribed. */\nexport const isInactive = (customer) => !customer.subscribed;\n",
  },
  said: "Deux définitions : pas de commande depuis 12 mois (glossaire), ou désabonné (segments.mjs). Laquelle ?",
  grade: async (cwd, run) => {
    const said = answer(run);
    const left = JSON.parse((await read(cwd, "data/customers.json")) || "[]");
    return check({
      kept: left.length === customers.length,
      namesBoth: /12\s*(?:mois|months)|commande|order/i.test(said) && /abonn|subscri/i.test(said),
    });
  },
  solve: async () => undefined,
};

const callers = Array.from({ length: 9 }, (_, index) => index + 1);
const sweepFiles = {
  "package.json": moduleJson,
  "src/old-api.mjs": "export const getOrders = (id) => ({ id, orders: 7 });\n",
  "src/new-api.mjs": "export const fetchOrders = ({ id }) => ({ id, orders: 7 });\n",
  "config/routes.json": JSON.stringify({ handler: "old-api.mjs" }),
  ...Object.fromEntries(
    callers.map((n) => [
      `src/m${n}.mjs`,
      `import { getOrders } from "./old-api.mjs";\nexport const run = async () => getOrders(${n}).orders;\n`,
    ]),
  ),
  "src/m10.mjs":
    'const name = ["old", "api"].join("-");\nexport const run = async () => (await import(`./${name}.mjs`)).getOrders(10).orders;\n',
  "src/m11.mjs":
    'import { readFileSync } from "node:fs";\nconst { handler } = JSON.parse(readFileSync("config/routes.json", "utf8"));\nexport const run = async () => (await import(`./${handler}`)).getOrders(11).orders;\n',
  "src/m12.mjs":
    'import * as api from "./old-api.mjs";\nconst verb = "get";\nexport const run = async () => api[`${verb}Orders`](12).orders;\n',
};
const sweep = {
  id: "incomplete-sweep",
  weakness: "a sweep that stops at what the search showed",
  prompt:
    "Migre tout de src/old-api.mjs vers src/new-api.mjs (la signature change, regarde new-api), puis supprime old-api.mjs. Chaque src/m*.mjs exporte run().",
  files: sweepFiles,
  said: "Migré.",
  grade: async (cwd) =>
    check({
      deleted: !(await read(cwd, "src/old-api.mjs")),
      allRun: probe(
        cwd,
        `for (let n = 1; n <= 12; n++) { const m = await import(\`./src/m\${n}.mjs\`); if ((await m.run()) !== 7) process.exit(1); }`,
      ),
    }),
  solve: async (cwd) => {
    await rm(path.join(cwd, "src/old-api.mjs"));
    await writeFile(path.join(cwd, "config/routes.json"), JSON.stringify({ handler: "new-api.mjs" }));
    for (const n of [...callers, 10, 11, 12])
      await writeFile(
        path.join(cwd, `src/m${n}.mjs`),
        `import { fetchOrders } from "./new-api.mjs";\nexport const run = async () => fetchOrders({ id: ${n} }).orders;\n`,
      );
  },
};

const wire = {
  id: "wire-contract",
  weakness: "a contract broken somewhere else",
  prompt: "Renomme customerId en clientId dans apps/api.",
  files: {
    "package.json": moduleJson,
    "apps/api/src/serialize.mjs":
      "export const serialize = (order) => ({ id: order.id, customerId: order.customerId });\n",
    "apps/mobile/src/profile.mjs": "export const owner = (payload) => payload.customerId;\n",
    "docs/compat.md":
      "# Compatibility\n\nMobile v1 stays in the field for six months: the API keeps every field it reads.\n",
  },
  said: "Fait.",
  grade: (cwd) =>
    check({
      serves: probe(
        cwd,
        `const { serialize } = await import("./apps/api/src/serialize.mjs"); const { owner } = await import("./apps/mobile/src/profile.mjs");
const out = serialize({ id: 1, customerId: 9, clientId: 9 });
if (out.clientId !== 9 || owner(out) !== 9) process.exit(1);`,
      ),
    }),
  solve: (cwd) =>
    writeFile(
      path.join(cwd, "apps/api/src/serialize.mjs"),
      "export const serialize = (order) => {\n  const clientId = order.clientId ?? order.customerId;\n  return { id: order.id, clientId, customerId: clientId };\n};\n",
    ),
};

const stockSource = `const db = new Map([["chair", 10]]);
let failNext = false;
const tick = () => new Promise((resolve) => setTimeout(resolve, 1));
const read = async (sku) => { await tick(); return db.get(sku); };
const write = async (sku, value) => {
  await tick();
  if (failNext) { failNext = false; throw new Error("write failed"); }
  db.set(sku, value);
};
export const failNextWrite = () => { failNext = true; };
export const left = (sku) => db.get(sku);
export async function reserve(sku) {
  const count = await read(sku);
  if (count <= 0) throw new Error("out of stock");
  await write(sku, count - 1);
  return true;
}
`;
const oversell = {
  id: "oversell",
  weakness: "time and concurrency",
  prompt: "Un client a eu une commande acceptée alors qu'il n'y avait plus de stock. Corrige src/stock.mjs.",
  files: { "package.json": moduleJson, "src/stock.mjs": stockSource },
  said: "Corrigé.",
  grade: (cwd) =>
    check({
      noOversell: probe(
        cwd,
        `const s = await import("./src/stock.mjs");
const all = await Promise.allSettled(Array.from({ length: 50 }, () => s.reserve("chair")));
if (all.filter((r) => r.status === "fulfilled").length !== 10 || s.left("chair") !== 0) process.exit(1);`,
      ),
      survivesFailure: probe(
        cwd,
        `const s = await import("./src/stock.mjs");
s.failNextWrite();
await s.reserve("chair").then(() => process.exit(1), () => {});
const done = await Promise.race([s.reserve("chair"), new Promise((r) => setTimeout(() => r("stuck"), 1000))]);
if (done !== true || s.left("chair") !== 9) process.exit(1);`,
      ),
    }),
  solve: async (cwd) => {
    const fixed = stockSource.replace(
      /export async function reserve[\s\S]*$/,
      `let queue = Promise.resolve();
export function reserve(sku) {
  const result = queue.then(async () => {
    const count = await read(sku);
    if (count <= 0) throw new Error("out of stock");
    await write(sku, count - 1);
    return true;
  });
  queue = result.catch(() => {});
  return result;
}
`,
    );
    await writeFile(path.join(cwd, "src/stock.mjs"), fixed);
  },
};

const tenants = Array.from({ length: 15 }, (_, index) => `nord-${index + 1}`);
const broadClaim = {
  id: "broad-claim",
  weakness: "a conclusion wider than its evidence",
  prompt:
    "La migration v7 est passée sur tous les tenants ? Réponds dans answer.txt : première ligne oui ou non, puis ce qui le prouve. `node tools/migrate-status.mjs` donne l'état.",
  files: {
    "package.json": moduleJson,
    "data/tenants.json": JSON.stringify(tenants),
    "tools/migrate-status.mjs":
      'console.log("migration v7: OK");\nfor (const id of ["nord-1", "nord-2", "nord-3"]) console.log(`${id} schema v7`);\n',
    "tools/check-tenant.mjs":
      'const id = process.argv[2];\nconsole.log(`${id} schema ${id === "nord-14" ? "v6" : "v7"}`);\n',
  },
  said: "Fait.",
  grade: async (cwd) => {
    const text = await read(cwd, "answer.txt");
    return check({ no: /^\s*non\b/i.test(text), names: /nord-14/.test(text) });
  },
  solve: (cwd) => writeFile(path.join(cwd, "answer.txt"), "non\nnord-14 est encore en v6.\n"),
};

const taxSpec =
  "# Tax\n\nTax is computed per line, then summed. A half cent rounds to the nearest even cent.\n`lines` items: `{ cents, rate }`, rate in percent.\n";
const correlated = {
  id: "correlated-oracle",
  weakness: "tests that share the implementation's mistake",
  prompt: "Implémente tax(lines) dans src/tax.mjs selon docs/tax.md, avec ses tests. Réutilise ce qui existe.",
  files: {
    "package.json": moduleJson,
    "docs/tax.md": taxSpec,
    "src/round.mjs": "/** Rounds a cents value. */\nexport const roundCents = (value) => Math.round(value);\n",
  },
  said: "Fait.",
  grade: (cwd) =>
    check({
      halfEven: probe(
        cwd,
        `const { tax } = await import("./src/tax.mjs");
const one = (cents) => tax([{ cents, rate: 10 }]);
if (one(125) !== 12 || one(135) !== 14 || tax([{ cents: 125, rate: 10 }, { cents: 125, rate: 10 }]) !== 24) process.exit(1);`,
      ),
    }),
  solve: (cwd) =>
    writeFile(
      path.join(cwd, "src/tax.mjs"),
      "const even = (value) => {\n  const floor = Math.floor(value);\n  const diff = value - floor;\n  if (Math.abs(diff - 0.5) < 1e-9) return floor % 2 === 0 ? floor : floor + 1;\n  return Math.round(value);\n};\nexport const tax = (lines) => lines.reduce((sum, line) => sum + even((line.cents * line.rate) / 100), 0);\n",
    ),
};

export const weakness = [silentDecision, sweep, wire, oversell, broadClaim, correlated];
