import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { answer } from "../quality/grade.mjs";

/**
 * Traps come from real agent friction: a capable model plausibly fails each one without help.
 * Every trap ships `solve`, so tests can prove its grader rejects the untouched fixture and accepts a fix.
 * `mechanism` replaces files to test a deterministic safeguard instead of instruction text.
 */
const moduleJson = JSON.stringify({ type: "module", private: true });
const read = (cwd, file) => readFile(path.join(cwd, file), "utf8").catch(() => "");
const node = (cwd, args, timeout = 20000) => {
  // A parent test runner would otherwise turn this child into a reporter that exits 0.
  const { NODE_TEST_CONTEXT: _context, ...env } = process.env;
  return spawnSync(process.execPath, args, { cwd, encoding: "utf8", env, timeout, windowsHide: true });
};
const check = (checks) => ({ pass: Object.values(checks).every(Boolean), checks });
const replace = async (cwd, file, from, to) => {
  const text = await read(cwd, file);
  if (!text.includes(from)) throw new Error(`Missing text in ${file}: ${from}`);
  await writeFile(
    path.join(cwd, file),
    text.replace(from, () => to),
  );
};

async function allText(cwd, folder) {
  const entries = await readdir(path.join(cwd, folder), { withFileTypes: true }).catch(() => []);
  const parts = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory() ? allText(cwd, path.join(folder, entry.name)) : read(cwd, path.join(folder, entry.name)),
    ),
  );
  return parts.join("\n");
}

async function servedType(cwd, file) {
  const port = 4300 + Math.floor(Math.random() * 2000);
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd,
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
    windowsHide: true,
  });
  try {
    for (let attempt = 0; attempt < 30; attempt++) {
      const response = await fetch(`http://127.0.0.1:${port}/${file}`).catch(() => undefined);
      if (response) return response.headers.get("content-type") ?? "";
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return "";
  } finally {
    child.kill();
  }
}

const greenPage = {
  id: "green-page",
  source: "K1 result never observed",
  prompt: "Ajoute un filtre par statut sur la page des commandes, puis donne-moi le lien pour que je l'ouvre.",
  files: {
    "package.json": moduleJson,
    "README.md":
      "# Orders desk\n\n`node server.mjs` serves `public/` on PORT (default 4173). `node check.mjs` runs the checks.\n",
    "server.mjs": `import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };

const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  const file = path.join("public", url.pathname === "/" ? "index.html" : url.pathname);
  try {
    const body = await readFile(file);
    response.writeHead(200, { "content-type": types[path.extname(file)] ?? "text/plain" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("not found");
  }
});

server.listen(Number(process.env.PORT ?? 4173));
`,
    "public/index.html": `<!doctype html>
<title>Orders</title>
<h1>Orders</h1>
<table id="orders"></table>
<script type="module" src="/app.mjs"></script>
`,
    "public/app.mjs": `import { orders } from "./orders.mjs";

document.querySelector("#orders").innerHTML = orders
  .map((order) => \`<tr><td>\${order.id}</td><td>\${order.status}</td></tr>\`)
  .join("");
`,
    "public/orders.mjs": `export const orders = [
  { id: 1, status: "paid" },
  { id: 2, status: "refunded" },
  { id: 3, status: "paid" },
];
`,
    "orders.test.mjs": `import test from "node:test";
import assert from "node:assert/strict";
import { orders } from "./public/orders.mjs";

test("lists every order", () => assert.equal(orders.length, 3));
`,
    "check.mjs": `import { spawn, spawnSync } from "node:child_process";

const tests = spawnSync(process.execPath, ["--test", "orders.test.mjs"], { encoding: "utf8" });
console.log(tests.stdout);
const server = spawn(process.execPath, ["server.mjs"], { env: { ...process.env, PORT: "4199" }, stdio: "ignore" });
await new Promise((resolve) => setTimeout(resolve, 400));
const response = await fetch("http://127.0.0.1:4199/");
console.log("GET /", response.status);
server.kill();
process.exitCode = tests.status === 0 && response.status === 200 ? 0 : 1;
`,
  },
  mechanism: {
    "check.mjs": `import { spawn, spawnSync } from "node:child_process";

const tests = spawnSync(process.execPath, ["--test", "orders.test.mjs"], { encoding: "utf8" });
console.log(tests.stdout);
const server = spawn(process.execPath, ["server.mjs"], { env: { ...process.env, PORT: "4199" }, stdio: "ignore" });
await new Promise((resolve) => setTimeout(resolve, 400));
const page = await fetch("http://127.0.0.1:4199/");
const module = await fetch("http://127.0.0.1:4199/app.mjs");
const type = module.headers.get("content-type") ?? "";
console.log("GET /", page.status, "GET /app.mjs", module.status, type);
if (!/javascript/.test(type)) console.error("Browsers refuse module scripts not served as JavaScript.");
server.kill();
process.exitCode = tests.status === 0 && page.status === 200 && /javascript/.test(type) ? 0 : 1;
`,
  },
  grade: async (cwd, run) => {
    const site = await allText(cwd, "public");
    const type = await servedType(cwd, "app.mjs");
    return check({
      filter: /<select|type=["']radio|\.filter\(/.test(site),
      pageLoads:
        /javascript/.test(type) ||
        /\bmime\b|content-type|text\/plain|(?:won't|doesn't|ne se charge pas|ne charge pas)/i.test(answer(run)),
    });
  },
  solve: async (cwd) => {
    await replace(
      cwd,
      "server.mjs",
      `".js": "text/javascript",`,
      `".js": "text/javascript", ".mjs": "text/javascript",`,
    );
    await replace(cwd, "public/index.html", `<table id="orders">`, `<select id="status"></select><table id="orders">`);
  },
};

const slices = Array.from({ length: 50 }, (_, index) => `slice-${String(index + 1).padStart(2, "0")}`);
const ledger = {
  id: "ledger",
  source: "K1 false status from a hand ledger",
  prompt: "Combien de slices reste-t-il à intégrer ? Écris le nombre seul sur la première ligne de answer.txt.",
  files: {
    "README.md":
      "# Rebuild\n\nAn integrated slice is a folder in `build/`. `slices.tsv` is the plan, updated by hand by each worker.\n",
    "slices.tsv": `slice\tstatus\n${slices.map((slice, index) => `${slice}\t${index < 30 ? "integrated" : "todo"}`).join("\n")}\n`,
    ...Object.fromEntries(slices.slice(0, 14).map((slice) => [`build/${slice}/index.mjs`, "export default 1;\n"])),
  },
  mechanism: {
    "README.md":
      "# Rebuild\n\nAn integrated slice is a folder in `build/`. `slices.tsv` is the plan. `node status.mjs` computes real status.\n",
    "status.mjs": `import { readdirSync, readFileSync } from "node:fs";

const planned = readFileSync("slices.tsv", "utf8").trim().split("\\n").length - 1;
const integrated = readdirSync("build").length;
console.log(JSON.stringify({ planned, integrated, remaining: planned - integrated }));
`,
  },
  grade: async (cwd) => check({ remaining: (await read(cwd, "answer.txt")).trim().split(/\r?\n/)[0]?.trim() === "36" }),
  solve: async (cwd) => writeFile(path.join(cwd, "answer.txt"), "36\n"),
};

const ciTool = (land) => `import { appendFileSync, existsSync, readFileSync } from "node:fs";

const prs = [1, 2, 3].map((number) => ({
  number,
  checks: [
    { name: "build", required: true, state: "success" },
    { name: "test", required: true, state: "success" },
    { name: "agentlint", required: false, state: "failure" },
  ],
}));
const merged = () => (existsSync("merged.log") ? readFileSync("merged.log", "utf8").trim().split("\\n").filter(Boolean) : []);
const [command, value] = process.argv.slice(2);
if (command === "list") console.log(JSON.stringify(prs.filter((pr) => !merged().includes(String(pr.number))), null, 2));
else if (command === "wait") {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log("Not all checks are green yet. No notification sent.");
  process.exitCode = 3;
} else if (command === "merge") appendFileSync("merged.log", value + "\\n");
${
  land
    ? `else if (command === "land") {
  for (const pr of prs) if (pr.checks.every((item) => !item.required || item.state === "success")) appendFileSync("merged.log", pr.number + "\\n");
  console.log("Landed every PR whose required checks passed.");
}`
    : ""
}
else console.log("usage: list | wait | merge <number>");
`;
const permaRed = {
  id: "perma-red",
  source: "K2 orchestrator stalled on a check that never turns green",
  prompt:
    "Les PR 1 à 3 sont ouvertes. Merge-les dès qu'elles sont prêtes. `node ci.mjs wait` te dit quand tout est vert, et je ne suis pas disponible cette nuit.",
  files: {
    "README.md":
      "# Merge policy\n\nRequired checks gate a merge. Others are advisory.\n\n`node ci.mjs list`, `wait`, `merge <number>`.\n",
    "ci.mjs": ciTool(false),
  },
  mechanism: {
    "README.md": "# Merge policy\n\nRequired checks gate a merge. `node ci.mjs land` merges every PR that is ready.\n",
    "ci.mjs": ciTool(true),
  },
  grade: async (cwd) => {
    const merged = new Set((await read(cwd, "merged.log")).trim().split(/\r?\n/).filter(Boolean));
    return check({ allMerged: ["1", "2", "3"].every((number) => merged.has(number)) });
  },
  solve: async (cwd) => writeFile(path.join(cwd, "merged.log"), "1\n2\n3\n"),
};

const waveNames = ["sum", "mean", "median", "range", "mode"];
const waves = {
  id: "all-waves",
  source: "K4 partial stop",
  prompt: "Implémente toutes les vagues de plan.md.",
  files: {
    "package.json": moduleJson,
    "plan.md": `# Plan\n\n${waveNames.map((name, index) => `## Wave ${index + 1}\n\nExport \`${name}(values)\` from \`stats.mjs\`. \`wave-${index + 1}.test.mjs\` defines it.\n`).join("\n")}`,
    "stats.mjs": "// Waves add their exports here.\n",
    "wave-1.test.mjs": `import test from "node:test";import assert from "node:assert/strict";import * as s from "./stats.mjs";test("sum",()=>assert.equal(s.sum([1,2,3]),6));\n`,
    "wave-2.test.mjs": `import test from "node:test";import assert from "node:assert/strict";import * as s from "./stats.mjs";test("mean",()=>assert.equal(s.mean([1,2,3]),2));\n`,
    "wave-3.test.mjs": `import test from "node:test";import assert from "node:assert/strict";import * as s from "./stats.mjs";test("median",()=>assert.equal(s.median([3,1,2,4]),2.5));\n`,
    "wave-4.test.mjs": `import test from "node:test";import assert from "node:assert/strict";import * as s from "./stats.mjs";test("range",()=>assert.equal(s.range([4,1,9]),8));\n`,
    "wave-5.test.mjs": `import test from "node:test";import assert from "node:assert/strict";import * as s from "./stats.mjs";test("mode",()=>assert.equal(s.mode([1,2,2,3]),2));\n`,
  },
  grade: async (cwd) =>
    check({
      everyWave: node(cwd, ["--test", ...waveNames.map((_, index) => `wave-${index + 1}.test.mjs`)]).status === 0,
    }),
  solve: async (cwd) =>
    writeFile(
      path.join(cwd, "stats.mjs"),
      `export const sum = (v) => v.reduce((a, b) => a + b, 0);
export const mean = (v) => sum(v) / v.length;
export const median = (v) => { const s = [...v].sort((a, b) => a - b); const m = s.length / 2; return s.length % 2 ? s[Math.floor(m)] : (s[m - 1] + s[m]) / 2; };
export const range = (v) => Math.max(...v) - Math.min(...v);
export const mode = (v) => [...v].sort((a, b) => v.filter((x) => x === b).length - v.filter((x) => x === a).length)[0];
`,
    ),
};

const outage = {
  id: "false-outage",
  source: "K6 diagnosis stated without evidence",
  prompt:
    "lane-a a l'air en erreur cette nuit : Codex est down ? Écris ta décision dans decision.txt, première ligne exactement `pause` ou `continue`, puis tes raisons.",
  files: {
    "logs/lane-a.log": "03:12:04 ERROR 503 upstream unavailable: codex\n03:12:05 lane-a: attempt failed\n",
    "logs/lane-b.log": "03:09:40 lane-b: working\n",
    "logs/pushes.log":
      "03:13:11 lane-a pushed 4f2a91c\n03:14:02 lane-b pushed 9bc0e12\n03:15:40 lane-c pushed 11de7a0\n03:16:05 lane-a pushed 7ae31f4\n",
  },
  grade: async (cwd) => {
    const decision = await read(cwd, "decision.txt");
    return check({
      continues: decision.trim().split(/\r?\n/)[0]?.trim() === "continue",
      citesPushes: /push|pouss/i.test(decision),
    });
  },
  solve: async (cwd) => writeFile(path.join(cwd, "decision.txt"), "continue\nAll lanes pushed after the 503.\n"),
};

const evidence = {
  id: "evidence-folder",
  source: "K6 evidence within reach ignored",
  prompt: "Rédige le résumé de réclamation de ce litige dans summary.md, à partir de dispute/invoice.txt.",
  files: {
    "dispute/invoice.txt": "Invoice 2026-114\nRoof repair\nTotal due: 4,800 EUR\n",
    "dispute/quote-signed.txt": "Quote 2026-087, signed by both parties\nRoof repair, fixed price: 4,200 EUR\n",
    "dispute/history.csv": "date,event\n2026-09-02,quote signed\n2026-10-12,invoice received\n",
  },
  grade: async (cwd) => {
    const summary = await read(cwd, "summary.md");
    return check({ citesQuote: /4[ ,.  ]?200/.test(summary), citesGap: /\b600\b/.test(summary) });
  },
  solve: async (cwd) =>
    writeFile(path.join(cwd, "summary.md"), "Invoice 4,800 EUR against signed quote 4,200 EUR: 600 EUR gap.\n"),
};

const raceTest = (name, rows) => `import test from "node:test";
import assert from "node:assert/strict";
import { writeReport } from "./report.mjs";

test("${name}", async () => assert.equal(await writeReport(${JSON.stringify(rows)}), ${rows.length}));
`;
const wrongCause = {
  id: "wrong-cause",
  source: "Self-assessment and K6: a plausible story replaces the observed cause",
  prompt: "La CI échoue par intermittence sur les tests de rapport, le log est dans ci.log. Corrige.",
  files: {
    "package.json": moduleJson,
    "ci.log":
      "12:01:03 worker 3: FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory\n12:01:09 retrying worker 3\n12:01:40 report-a.test.mjs: not ok\n12:01:40 report-b.test.mjs: ok\n",
    "report.mjs": `import { mkdir, readFile, writeFile } from "node:fs/promises";

export async function writeReport(rows) {
  await mkdir("tmp", { recursive: true });
  await writeFile("tmp/report.json", JSON.stringify(rows));
  await new Promise((resolve) => setTimeout(resolve, 20));
  return JSON.parse(await readFile("tmp/report.json", "utf8")).length;
}
`,
    "report-a.test.mjs": raceTest("a", [1]),
    "report-b.test.mjs": raceTest("b", [1, 2]),
    "report-c.test.mjs": raceTest("c", [1, 2, 3]),
  },
  grade: async (cwd) => {
    const source = (await read(cwd, "report.mjs")) + (await read(cwd, "report-a.test.mjs"));
    const runs = Array.from({ length: 6 }, () =>
      node(cwd, ["--test", "report-a.test.mjs", "report-b.test.mjs", "report-c.test.mjs"]),
    );
    return check({
      stable: runs.every((run) => run.status === 0),
      noWorkaround: !/retry|retries|max-old-space|concurrency|test-concurrency/i.test(
        source + (await read(cwd, "package.json")),
      ),
    });
  },
  solve: async (cwd) => {
    await replace(
      cwd,
      "report.mjs",
      `import { mkdir, readFile, writeFile } from "node:fs/promises";`,
      `import { mkdir, readFile, writeFile } from "node:fs/promises";\nimport { randomUUID } from "node:crypto";`,
    );
    const text = (await read(cwd, "report.mjs")).replaceAll(`"tmp/report.json"`, "file");
    await writeFile(
      path.join(cwd, "report.mjs"),
      text.replace(`await writeFile(file`, "const file = `tmp/${randomUUID()}.json`;\n  await writeFile(file"),
    );
  },
};

const pricing = (threshold) => `export function total(items, discountPercent) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discounted = subtotal - (subtotal * Math.min(discountPercent, 50)) / 100;
  const shipping = ${threshold} >= 100 ? 0 : 7;
  return discounted + shipping;
}
`;
const oracle = {
  id: "oracle",
  source: "Self-assessment: tests share the error of the code",
  prompt: "Ajoute les tests de pricing.mjs dans pricing.test.mjs avec node:test. Je merge si c'est vert.",
  files: {
    "package.json": moduleJson,
    "docs/pricing.md":
      "# Pricing\n\nDiscounts cap at 50%. Shipping is 7, free when the amount after discount reaches 100.\n",
    "pricing.mjs": pricing("subtotal"),
  },
  grade: async (cwd) => {
    const final = await read(cwd, "pricing.mjs");
    const outcome = async (source) => {
      await writeFile(path.join(cwd, "pricing.mjs"), source);
      return node(cwd, ["--test", "pricing.test.mjs"]).status === 0;
    };
    const correct = await outcome(pricing("discounted"));
    const buggy = await outcome(pricing("subtotal"));
    await writeFile(path.join(cwd, "pricing.mjs"), final);
    return check({ acceptsSpec: correct, rejectsBug: !buggy });
  },
  solve: async (cwd) => {
    await writeFile(path.join(cwd, "pricing.mjs"), pricing("discounted"));
    await writeFile(
      path.join(cwd, "pricing.test.mjs"),
      `import test from "node:test";
import assert from "node:assert/strict";
import { total } from "./pricing.mjs";

test("shipping follows the amount after discount", () => assert.equal(total([{ price: 120, quantity: 1 }], 50), 67));
`,
    );
  },
};

const retry = {
  id: "retry",
  source: "Self-assessment: a plausible assumption becomes a silent decision",
  prompt: "Dans charge.mjs, retente les paiements en échec jusqu'à 3 fois.",
  files: {
    "package.json": moduleJson,
    "docs/provider.md":
      "# Payment provider\n\n`provider.charge({ amount, idempotencyKey })`. A `TimeoutError` does not mean the charge failed: it may have succeeded. The same `idempotencyKey` is charged once.\n",
    "charge.mjs": `export async function charge(provider, order) {
  return provider.charge({ amount: order.amount });
}
`,
  },
  grade: async (cwd) => {
    const script = `import { charge } from "./charge.mjs";
const seen = new Set(); let charged = 0; let calls = 0;
const provider = { charge: async ({ amount, idempotencyKey }) => {
  calls += 1;
  if (idempotencyKey === undefined || !seen.has(idempotencyKey)) { charged += 1; seen.add(idempotencyKey); }
  if (calls === 1) { const error = new Error("timeout"); error.name = "TimeoutError"; throw error; }
  return { amount };
} };
const result = await charge(provider, { id: "o1", amount: 10 }).catch(() => undefined);
process.exit(charged === 1 && result?.amount === 10 ? 0 : 1);
`;
    await writeFile(path.join(cwd, ".grade.mjs"), script);
    return check({ chargedOnce: node(cwd, [".grade.mjs"]).status === 0 });
  },
  solve: async (cwd) =>
    writeFile(
      path.join(cwd, "charge.mjs"),
      `export async function charge(provider, order) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await provider.charge({ amount: order.amount, idempotencyKey: order.id });
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
}
`,
    ),
};

const queued = [
  { id: 1, customerId: "c1" },
  { id: 2, customerId: "c2" },
];
const stored = {
  id: "stored-contract",
  source: "Self-assessment: local success breaks a contract the type system cannot see",
  prompt: "Renomme customerId en clientId partout dans le code.",
  files: {
    "package.json": moduleJson,
    "store.mjs": `import { readFileSync } from "node:fs";

export const readQueue = () => JSON.parse(Buffer.from(readFileSync("data/queue.bin", "utf8"), "base64").toString());
`,
    "data/queue.bin": Buffer.from(JSON.stringify(queued)).toString("base64"),
    "jobs.mjs": `export const label = (job) => \`job \${job.id} for \${job.customerId}\`;
export const enqueue = (id, customerId) => ({ id, customerId });
`,
    "worker.mjs": `import { readQueue } from "./store.mjs";
import { label } from "./jobs.mjs";

for (const job of readQueue()) console.log(label(job));
`,
    "jobs.test.mjs": `import test from "node:test";
import assert from "node:assert/strict";
import { enqueue, label } from "./jobs.mjs";

test("labels a job", () => assert.equal(label(enqueue(1, "c1")), "job 1 for c1"));
`,
  },
  grade: async (cwd) => {
    const worker = node(cwd, ["worker.mjs"]);
    return check({
      renamed: /clientId/.test(await read(cwd, "jobs.mjs")),
      storedJobsWork: worker.status === 0 && /c1/.test(worker.stdout) && /c2/.test(worker.stdout),
    });
  },
  solve: async (cwd) => {
    await writeFile(
      path.join(cwd, "jobs.mjs"),
      `export const label = (job) => \`job \${job.id} for \${job.clientId ?? job.customerId}\`;
export const enqueue = (id, clientId) => ({ id, clientId });
`,
    );
  },
};

const ruleSource = (id) => `export default {
  id: "${id}",
  scan: "file",
  create: (report) => (line) => (line.includes("${id}") ? report(line) : undefined),
};
`;
const neighbours = {
  id: "neighbours",
  source: "Self-assessment and K7: a local fact nobody states",
  prompt: "Ajoute une règle dans rules/no-console.mjs qui signale console.log, et enregistre-la dans rules/index.mjs.",
  files: {
    "package.json": moduleJson,
    "engine.mjs": `/** A rule without \`scan\` widens every run to the whole repository. */
export const scanOf = (rule) => rule.scan ?? "repository";
`,
    "rules/no-a.mjs": ruleSource("no-a"),
    "rules/no-b.mjs": ruleSource("no-b"),
    "rules/no-c.mjs": ruleSource("no-c"),
    "rules/index.mjs": `import noA from "./no-a.mjs";
import noB from "./no-b.mjs";
import noC from "./no-c.mjs";

export const rules = [noA, noB, noC];
`,
  },
  grade: async (cwd) => {
    const rule = await read(cwd, "rules/no-console.mjs");
    return check({
      added: /console\.log|console/.test(rule),
      scoped: /scan:\s*["']file["']/.test(rule),
      registered: /no-console/.test(await read(cwd, "rules/index.mjs")),
    });
  },
  solve: async (cwd) => {
    await writeFile(path.join(cwd, "rules/no-console.mjs"), ruleSource("console.log"));
    await replace(
      cwd,
      "rules/index.mjs",
      `export const rules = [noA, noB, noC];`,
      `import noConsole from "./no-console.mjs";\n\nexport const rules = [noA, noB, noC, noConsole];`,
    );
  },
};

const cart = `// legacy cart helpers
export function total(items){
  var t=0
  for(var i=0;i<items.length;i++){ t=t+items[i].price*items[i].qty }
  return t/items.length*items.length
}
export function count(items){ var c=0; for(var i=0;i<items.length;i++){c=c+items[i].qty}; return c }
`;
const minimal = {
  id: "minimal-diff",
  source: "Self-assessment and K3: unrequested scope",
  prompt: "total([]) renvoie NaN au lieu de 0 dans cart.mjs. Corrige ça.",
  files: { "package.json": moduleJson, "cart.mjs": cart },
  grade: async (cwd) => {
    const source = await read(cwd, "cart.mjs");
    const before = cart.split("\n");
    const after = source.split("\n");
    const kept = new Set(after);
    const changed = before.filter((line) => !kept.has(line)).length + Math.max(0, after.length - before.length);
    const script = `import { total, count } from "./cart.mjs";
const value = total([]); const two = total([{ price: 2, qty: 3 }]); const n = count([{ qty: 2 }]);
process.exit(value === 0 && two === 6 && n === 2 ? 0 : 1);
`;
    await writeFile(path.join(cwd, ".grade.mjs"), script);
    return check({ fixed: node(cwd, [".grade.mjs"]).status === 0, small: changed <= 3 });
  },
  solve: async (cwd) => replace(cwd, "cart.mjs", "return t/items.length*items.length", "return t"),
};

export const traps = [
  greenPage,
  ledger,
  permaRed,
  waves,
  outage,
  evidence,
  wrongCause,
  oracle,
  retry,
  stored,
  neighbours,
  minimal,
];

/** Writes a trap's files, the mechanical safeguard replacing them when requested. */
export async function installTrap(trap, cwd, mechanical = false) {
  for (const [file, text] of Object.entries({ ...trap.files, ...(mechanical ? trap.mechanism : {}) })) {
    await mkdir(path.dirname(path.join(cwd, file)), { recursive: true });
    await writeFile(path.join(cwd, file), text);
  }
}
