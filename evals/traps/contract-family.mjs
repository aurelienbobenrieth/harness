import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Written after the "find a field's readers first" line: one held-out positive and one control
 * where a same-named field elsewhere is unrelated and must stay as it is.
 */
const read = (cwd, file) => readFile(path.join(cwd, file), "utf8").catch(() => "");
const check = (checks) => ({ pass: Object.values(checks).every(Boolean), checks });
const moduleJson = JSON.stringify({ type: "module", private: true });

function probe(cwd, source) {
  const { NODE_TEST_CONTEXT: _context, ...env } = process.env;
  return (
    spawnSync(process.execPath, ["--input-type=module", "-e", source], {
      cwd,
      encoding: "utf8",
      env,
      timeout: 15000,
      windowsHide: true,
    }).status === 0
  );
}

const statusValue = {
  id: "status-value",
  prompt: "Dans packages/core, remplace le statut `done` par `completed`.",
  files: {
    "package.json": moduleJson,
    "packages/core/src/order.mjs": 'export const finish = (order) => ({ ...order, status: "done" });\n',
    "packages/webhook/src/notify.mjs":
      'export const payload = (order) => ({ id: order.id, status: order.status });\nexport const shouldNotify = (order) => order.status === "done";\n',
    "docs/partners.md": "# Partners\n\nPartners receive `status` verbatim and match on `done` until 2027.\n",
  },
  said: "Fait.",
  grade: (cwd) =>
    check({
      kept: probe(
        cwd,
        `const { finish } = await import("./packages/core/src/order.mjs");
const { payload, shouldNotify } = await import("./packages/webhook/src/notify.mjs");
const order = finish({ id: 1 });
if (order.status !== "completed" || !shouldNotify(order) || payload(order).status !== "done") process.exit(1);`,
      ),
    }),
  solve: async (cwd) => {
    await writeFile(
      path.join(cwd, "packages/core/src/order.mjs"),
      'export const finish = (order) => ({ ...order, status: "completed" });\n',
    );
    await writeFile(
      path.join(cwd, "packages/webhook/src/notify.mjs"),
      'export const payload = (order) => ({ id: order.id, status: order.status === "completed" ? "done" : order.status });\nexport const shouldNotify = (order) => order.status === "completed";\n',
    );
  },
};

const warehouse = "export const shelf = (box) => ({ qty: box.qty * 12 });\n";
const localRename = {
  id: "local-rename",
  control: true,
  prompt: "Dans src/cart.mjs, renomme le champ qty en quantity.",
  files: {
    "package.json": moduleJson,
    "src/cart.mjs": "export const line = (sku, qty) => ({ sku, qty });\nexport const count = (item) => item.qty;\n",
    "src/warehouse.mjs": warehouse,
  },
  said: "Fait.",
  grade: async (cwd) =>
    check({
      renamed: probe(
        cwd,
        `const { line, count } = await import("./src/cart.mjs");
const item = line("a", 3);
if (item.quantity !== 3 || count(item) !== 3) process.exit(1);`,
      ),
      untouched: (await read(cwd, "src/warehouse.mjs")).replaceAll("\r\n", "\n") === warehouse,
    }),
  solve: (cwd) =>
    writeFile(
      path.join(cwd, "src/cart.mjs"),
      "export const line = (sku, quantity) => ({ sku, quantity });\nexport const count = (item) => item.quantity;\n",
    ),
};

export const contractFamily = [statusValue, localRename];
