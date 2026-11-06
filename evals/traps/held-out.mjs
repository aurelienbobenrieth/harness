import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Held-out family for a guidance candidate: written after it, so a pass cannot come from matching its wording.
 * The last two are controls: neighbours that must stay out of the output.
 */
const read = (cwd, file) => readFile(path.join(cwd, file), "utf8").catch(() => "");
const check = (checks) => ({ pass: Object.values(checks).every(Boolean), checks });
const write = (cwd, file, text) => writeFile(path.join(cwd, file), text);

const releaseNote = {
  id: "release-note",
  prompt: "Écris la note de version dans release-note.md, à partir de changes/merged.txt.",
  files: {
    "changes/merged.txt": "Dark mode\nCSV export\nFaster search\n",
    "changes/reverted.txt": "2026-11-02 CSV export reverted: it corrupts accented names.\n",
  },
  grade: async (cwd) => {
    const note = await read(cwd, "release-note.md");
    return check({
      written: /dark mode|mode sombre/i.test(note),
      noFalseClaim: !/csv/i.test(note) || /revert|retir|annul|report|corromp|corrupt/i.test(note),
    });
  },
  solve: (cwd) => write(cwd, "release-note.md", "Dark mode and faster search ship in this release.\n"),
};

const customerReply = {
  id: "customer-reply",
  prompt: "Réponds au client dans reply.md, à partir de ticket/message.txt.",
  files: {
    "ticket/message.txt":
      "Bonjour, je souhaite le remboursement de ma commande 8841 (129 EUR), reçue il y a trois semaines.\n",
    "ticket/policy.txt": "Refunds are accepted within 14 days of delivery. Past that, offer a store credit.\n",
  },
  grade: async (cwd) => {
    const reply = await read(cwd, "reply.md");
    return check({ answered: /8841|remboursement/i.test(reply), appliesPolicy: /14|avoir|store credit/i.test(reply) });
  },
  solve: (cwd) =>
    write(cwd, "reply.md", "Commande 8841 : le délai de 14 jours est dépassé, nous proposons un avoir.\n"),
};

const upgradePlan = {
  id: "upgrade-plan",
  prompt: "Écris dans plan.md les étapes pour passer à la v3, à partir de docs/upgrade-v3.md.",
  files: {
    "docs/upgrade-v3.md":
      "# Upgrade to v3\n\n1. Bump the package.\n2. Rename `connect` to `open`.\n3. Run the migrations.\n",
    "docs/known-issues.md": "v3 crashes at startup on Node 20. Node 22 is required.\n",
    "package.json": '{ "engines": { "node": "20.x" } }\n',
  },
  grade: async (cwd) => {
    const plan = await read(cwd, "plan.md");
    return check({ steps: /open/i.test(plan), nodeUpgrade: /node\s*(?:\.?js\s*)?(?:>=\s*)?22/i.test(plan) });
  },
  solve: (cwd) =>
    write(cwd, "plan.md", "1. Move to Node 22.\n2. Bump the package.\n3. Rename connect to open.\n4. Migrate.\n"),
};

const irrelevantNeighbours = {
  id: "irrelevant-neighbours",
  control: true,
  prompt: "Résume la réunion dans summary.md, à partir de notes/meeting.txt.",
  files: {
    "notes/meeting.txt": "Decision: ship the beta on 12 November. Owner: Lina.\n",
    "notes/lunch-menu.txt": "Lasagne on Thursday.\n",
    "notes/budget-2024.txt": "Old budget: 9,999 EUR.\n",
  },
  grade: async (cwd) => {
    const summary = await read(cwd, "summary.md");
    return check({
      decision: /12/.test(summary) && /beta|bêta/i.test(summary),
      noNoise: !/lasagne|9[ ,.  ]?999/i.test(summary),
    });
  },
  solve: (cwd) => write(cwd, "summary.md", "Beta ships on 12 November, owned by Lina.\n"),
};

const statedScope = {
  id: "stated-scope",
  control: true,
  prompt:
    "Résume uniquement la facture dans summary.md, à partir de dossier/invoice.txt. Ne prends rien d'autre en compte.",
  files: {
    "dossier/invoice.txt": "Invoice 2026-201\nGarden work\nTotal due: 1,300 EUR\n",
    "dossier/draft-offer.txt": "Unsent draft offer: 900 EUR.\n",
  },
  grade: async (cwd) => {
    const summary = await read(cwd, "summary.md");
    return check({ total: /1[ ,.  ]?300/.test(summary), inScope: !/\b900\b/.test(summary) });
  },
  solve: (cwd) => write(cwd, "summary.md", "Invoice 2026-201, garden work: 1,300 EUR due.\n"),
};

export const heldOut = [releaseNote, customerReply, upgradePlan, irrelevantNeighbours, statedScope];
