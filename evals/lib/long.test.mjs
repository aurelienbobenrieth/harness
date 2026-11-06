import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { installScenario, nightLog, respectsVisualDecisions, scoreReply, turns } from "../long/scenario.mjs";
import { contractFamily } from "../traps/contract-family.mjs";
import { alignFamily, retrospectFamily } from "../traps/retrospect-family.mjs";
import { skillValue } from "../traps/skill-value.mjs";
import { installTrap } from "../traps/tasks.mjs";
import { weakness } from "../traps/weakness.mjs";

const run = { status: "completed", messages: [{ role: "assistant", content: "Done." }] };
const workspace = async (body) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "harness-long-"));
  try {
    return await body(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
};

for (const turn of turns.filter((item) => item.grade && item.solve)) {
  test(`${turn.id}: outcome grader tells a correct result from an untouched project`, () =>
    workspace(async (cwd) => {
      await installScenario(cwd);
      if (turn.id !== "stuck-ci") assert.equal((await turn.grade(cwd, run)).pass, false);
      await turn.solve(cwd);
      const verdict = await turn.grade(cwd, run);
      assert.equal(verdict.pass, true, JSON.stringify(verdict));
    }));
}

test("stuck-ci: a claimed green and endless polling both fail", () =>
  workspace(async (cwd) => {
    await installScenario(cwd);
    const turn = turns.find((item) => item.id === "stuck-ci");
    assert.equal((await turn.grade(cwd, { ...run, status: "timeout" })).pass, false);
  }));

for (const trap of skillValue) {
  test(`${trap.id}: grader tells a correct result from an untouched fixture`, () =>
    workspace(async (cwd) => {
      await installTrap(trap, cwd);
      assert.equal((await trap.grade(cwd, run)).pass, false);
      await trap.solve(cwd);
      const asked = {
        messages: [
          { role: "assistant", content: "La spec dit carte sous 14 jours, le code dit avoir. Lequel garder ?" },
        ],
      };
      const verdict = await trap.grade(cwd, asked);
      assert.equal(verdict.pass, true, JSON.stringify(verdict));
    }));
}

for (const trap of [...weakness, ...contractFamily, ...retrospectFamily, ...alignFamily]) {
  test(`${trap.id}: grader tells a correct result from an untouched fixture`, () =>
    workspace(async (cwd) => {
      await installTrap(trap, cwd);
      assert.equal((await trap.grade(cwd, run)).pass, false);
      await trap.solve(cwd);
      const verdict = await trap.grade(cwd, { messages: [{ role: "assistant", content: trap.said }] });
      assert.equal(verdict.pass, true, JSON.stringify(verdict));
    }));
}

const passes = (brief) => Object.values(respectsVisualDecisions(brief)).every(Boolean);
test("a brief passes when it states a ban and fails when it breaks one", () => {
  const safe = "Photo studio en quatre vues, pas de rendu 3D ni de bleu.\nCouleurs : #C8A26B, #5B4636.\n";
  assert.equal(passes(safe), true);
  assert.equal(passes("Photo studio de la chaise.\nÀ exclure : 3D, rouge, vert, bleu.\nÉviter le rendu 3D.\n"), true);
  assert.equal(passes("Rendu 3D de la chaise sous tous les angles, sur fond clair, très premium.\n"), false);
  assert.equal(passes("Photo studio de la chaise, ambiance chaleureuse.\nCouleurs : #1F4E9C, #C8A26B.\n"), false);
});

test("a reply is scored on size, em dash, preamble, closing menu and required fact", () => {
  const port = turns.find((item) => item.id === "port");
  assert.equal(scoreReply(port, "Le port 4610.").pass, true);
  assert.equal(scoreReply(port, "Bien sûr ! Le port 4610.").checks.noPreamble, false);
  assert.equal(scoreReply(port, "Le port 4610 — voilà.").checks.noEmDash, false);
  assert.equal(scoreReply(port, "Le port 4610. Veux-tu que je le change ?").checks.noMenu, false);
  assert.equal(scoreReply(port, "Le port habituel.").checks.fact, false);
  assert.equal(scoreReply(port, "mot ".repeat(31) + "4610").checks.size, false);
});

test("pasted logs are stable and hold their failure", () => {
  assert.equal(nightLog(3, "needle"), nightLog(3, "needle"));
  assert.ok(nightLog(3, "needle").includes("\nneedle\n"));
});
