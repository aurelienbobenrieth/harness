import { budget, judge } from "../lib/runner.mjs";
import { out, load, save } from "./common.mjs";
import { existsSync } from "node:fs";
import path from "node:path";
const ledgerPath = path.join(out, "ledger.json");
const ledger = existsSync(ledgerPath) ? load("ledger") : [];
budget.limit = Math.min(10, Number(process.env.EVALS_MAX_USD ?? 10));
budget.spent = ledger.reduce((n, r) => n + r.usd, 0);
async function attempt(key, rubric, input, maxUsd = 0.3) {
  const hit = ledger.find((r) => r.key === key);
  if (hit) {
    if (hit.error) throw Error(hit.error);
    return hit.value;
  }
  try {
    const result = await judge({ rubric, input, maxUsd, timeoutMs: 120000, maxTurns: 4 });
    ledger.push({
      key,
      usd: result.run.costEstimateUsd,
      tokens: result.run.tokens,
      model: result.run.model,
      value: result.value,
    });
    save("ledger", ledger);
    return result.value;
  } catch (error) {
    ledger.push({ key, usd: error.run?.costEstimateUsd ?? 0, error: String(error) });
    save("ledger", ledger);
    throw error;
  }
}

export async function cachedJudge(key, rubric, input, maxUsd = 0.3) {
  try {
    return await attempt(key, rubric, input, maxUsd);
  } catch (error) {
    if (!String(error).match(/strict JSON|Judge timeout/)) throw error;
    return await attempt(
      key + "-retry1",
      rubric + " Validate JSON syntax, including every closing brace and quotation mark. Return no Markdown.",
      input,
      maxUsd,
    );
  }
}
