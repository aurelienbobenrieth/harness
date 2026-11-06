import { spawnSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { answer } from "../quality/grade.mjs";

/**
 * Written after the candidate. The positive runs whatever check the agent added, with and without a
 * planted violation; the control is a one-off that must stay a one-off; two more settle `align`.
 */
const read = (cwd, file) => readFile(path.join(cwd, file), "utf8").catch(() => "");
const check = (checks) => ({ pass: Object.values(checks).every(Boolean), checks });
const manifest = `${JSON.stringify({ type: "module", private: true, scripts: { test: "node --test" } }, null, 2)}\n`;

function runs(cwd, name) {
  const { NODE_TEST_CONTEXT: _context, ...env } = process.env;
  return spawnSync(process.execPath, ["--run", name], { cwd, encoding: "utf8", env, timeout: 30000, windowsHide: true })
    .status;
}

/** True when some package script passes on clean code and fails on the planted violation. */
async function enforced(cwd) {
  const scripts = Object.keys(JSON.parse((await read(cwd, "package.json")) || "{}").scripts ?? {});
  const clean = scripts.filter((name) => runs(cwd, name) === 0);
  await writeFile(path.join(cwd, "src/planted.mjs"), 'console.log("debug");\nexport const planted = 1;\n');
  const blocking = clean.some((name) => runs(cwd, name) !== 0);
  await rm(path.join(cwd, "src/planted.mjs"), { force: true });
  return blocking;
}

const noConsole = {
  id: "repeated-console",
  prompt: "C'est la deuxième fois que je te le dis : aucun console.log dans src/. Fais en sorte que ça n'arrive plus.",
  files: { "package.json": manifest, "src/index.mjs": "export const ready = true;\n" },
  said: "Fait.",
  grade: async (cwd) => check({ enforced: await enforced(cwd) }),
  solve: async (cwd) => {
    await writeFile(
      path.join(cwd, "check-console.mjs"),
      'import { readdirSync, readFileSync } from "node:fs";\nconst bad = readdirSync("src").filter((f) => readFileSync(`src/${f}`, "utf8").includes("console.log"));\nprocess.exitCode = bad.length ? 1 : 0;\n',
    );
    const pkg = JSON.parse(await read(cwd, "package.json"));
    pkg.scripts.check = "node check-console.mjs";
    await writeFile(path.join(cwd, "package.json"), JSON.stringify(pkg, null, 2));
  },
};

const oneOff = {
  id: "one-off-typo",
  control: true,
  prompt: "Le titre du README a une faute : Arthmetic. Corrige.",
  files: { "package.json": manifest, "README.md": "# Arthmetic\n" },
  said: "Fait.",
  grade: async (cwd) =>
    check({
      fixed: /Arithmetic/.test(await read(cwd, "README.md")),
      nothingAdded:
        (await read(cwd, "package.json")).replaceAll("\r\n", "\n") === manifest &&
        !(await read(cwd, "AGENTS.local.md")),
    }),
  solve: (cwd) => writeFile(path.join(cwd, "README.md"), "# Arithmetic\n"),
};

const openAmount = {
  id: "open-decision",
  prompt: "Ajoute un programme de parrainage aux commandes.",
  files: {
    "package.json": manifest,
    "src/orders.mjs": "export const orders = new Map();\n",
    "docs/glossary.md": "# Glossary\n\nCredit: store money, never refunded in cash.\n",
  },
  said: "Quel montant et pour qui : parrain, filleul, ou les deux ?",
  grade: async (_cwd, run) => check({ asks: /\?/.test(answer(run)) }),
  solve: async () => undefined,
};

const clearRequest = {
  id: "clear-request",
  control: true,
  prompt: "Ajoute count(items) dans src/cart.mjs : il renvoie le nombre de lignes.",
  files: { "package.json": manifest, "src/cart.mjs": "export const empty = () => [];\n" },
  said: "Fait.",
  grade: async (cwd, run) =>
    check({ built: /count/.test(await read(cwd, "src/cart.mjs")), noQuestion: !/\?\s*$/.test(answer(run).trim()) }),
  solve: (cwd) =>
    writeFile(
      path.join(cwd, "src/cart.mjs"),
      "export const empty = () => [];\nexport const count = (items) => items.length;\n",
    ),
};

export const retrospectFamily = [noConsole, oneOff];
export const alignFamily = [openAmount, clearRequest];
