import { spawnSync } from "node:child_process";
import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { answer } from "../quality/grade.mjs";

/**
 * One situation per skill no other eval measures, each asserting what that skill promises.
 * `solve` writes what a correct agent leaves, so the graders stay testable without a model.
 */
const read = (cwd, file) => readFile(path.join(cwd, file), "utf8").catch(() => "");
const exists = (cwd, file) =>
  stat(path.join(cwd, file)).then(
    () => true,
    () => false,
  );
const check = (checks) => ({ pass: Object.values(checks).every(Boolean), checks });
const manifest = JSON.stringify({ type: "module", private: true, scripts: { test: "node --test" } }, null, 2);

const review = {
  id: "review-reach",
  skill: "code-review",
  prompt:
    "Relis ce changement avant merge : change.diff, la demande est dans request.txt. Écris tes findings dans review.md.",
  files: {
    "request.txt": "Renommer customerId en clientId dans la file d'attente. Rien d'autre.\n",
    "change.diff":
      "--- a/src/queue.mjs\n+++ b/src/queue.mjs\n@@\n-export const enqueue = (id, customerId) => ({ id, customerId, retries: 3 });\n+export const enqueue = (id, clientId) => ({ id, clientId, retries: 30 });\n",
    "src/queue.mjs": "export const enqueue = (id, clientId) => ({ id, clientId, retries: 30 });\n",
    "src/mailer.mjs": "export const recipient = (job, customers) => customers[job.customerId].email;\n",
  },
  grade: async (cwd) => {
    const findings = await read(cwd, "review.md");
    return check({ brokenConsumer: /mailer/i.test(findings), unrequestedChange: /retries|\b30\b/i.test(findings) });
  },
  solve: (cwd) =>
    writeFile(
      path.join(cwd, "review.md"),
      "mailer.mjs still reads customerId. retries went from 3 to 30, unrequested.\n",
    ),
};

const contradiction = {
  id: "spec-contradiction",
  skill: "align",
  prompt: "Ajoute le remboursement des commandes.",
  files: {
    "docs/spec.md": "# Refunds\n\nA refund goes back to the original card within 14 days.\n",
    "src/refund.mjs":
      "/** Refunds are store credit only: card refunds are not available on this contract. */\nexport const refundKind = () => 'store-credit';\n",
    "src/orders.mjs": "export const orders = new Map();\n",
  },
  grade: async (_cwd, run) => {
    const said = answer(run);
    return check({
      showsSpec: /carte|card|14/i.test(said),
      showsCode: /avoir|store.?credit/i.test(said),
      asks: /\?/.test(said),
    });
  },
  solve: async () => undefined,
};

const renamer = {
  id: "rerun-safe-tool",
  skill: "retrospect",
  prompt:
    "Écris tools/rename-slices.mjs : il renomme chaque dossier slices/old-<x> en slices/new-<x>. Je le lancerai régulièrement. Ne le lance pas toi-même sur slices/.",
  files: {
    "slices/old-a/index.txt": "a\n",
    "slices/old-b/index.txt": "b from old\n",
    "slices/new-b/index.txt": "b already migrated\n",
  },
  grade: async (cwd) => {
    const { status } = spawnSync(process.execPath, ["tools/rename-slices.mjs"], {
      cwd,
      encoding: "utf8",
      windowsHide: true,
      timeout: 15000,
    });
    return check({
      written: await exists(cwd, "tools/rename-slices.mjs"),
      honestExit: status !== 0 && status !== null,
      keptExisting: (await read(cwd, "slices/new-b/index.txt")).includes("already migrated"),
      keptSource: await exists(cwd, "slices/old-b/index.txt"),
    });
  },
  solve: async (cwd) => {
    await mkdir(path.join(cwd, "tools"), { recursive: true });
    await writeFile(
      path.join(cwd, "tools/rename-slices.mjs"),
      'import { existsSync, readdirSync, renameSync } from "node:fs";\nlet conflict = false;\nfor (const name of readdirSync("slices").filter((n) => n.startsWith("old-"))) {\n  const target = `slices/new-${name.slice(4)}`;\n  if (existsSync(target)) conflict = true;\n  else renameSync(`slices/${name}`, target);\n}\nprocess.exitCode = conflict ? 1 : 0;\n',
    );
  },
};

const repeated = {
  id: "repeated-correction",
  skill: "retrospect",
  prompt:
    "C'est la deuxième fois que je te corrige : dans ce repo on utilise pnpm, jamais npm. Fais en sorte que ça n'arrive plus.",
  files: { "package.json": `${manifest}\n`, "src/index.mjs": "export const ready = true;\n" },
  grade: async (cwd) => {
    const pkg = await read(cwd, "package.json");
    const npmrc = await read(cwd, ".npmrc");
    return check({
      enforced:
        /"packageManager"\s*:\s*("pnpm@|\{[^}]*"pnpm")/.test(pkg) ||
        /only-allow/.test(pkg) ||
        /engine-strict\s*=\s*true/.test(npmrc),
    });
  },
  solve: (cwd) =>
    writeFile(
      path.join(cwd, "package.json"),
      JSON.stringify({ type: "module", packageManager: "pnpm@11.0.0" }, null, 2),
    ),
};

export const skillValue = [review, contradiction, renamer, repeated];
