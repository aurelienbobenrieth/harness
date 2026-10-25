export function reviewMetrics(findings, bugs = [1, 2, 3, 4, 5]) {
  const found = new Set(findings.filter((f) => bugs.includes(f.line)).map((f) => f.line));
  return {
    recall: found.size / bugs.length,
    precision: findings.length ? found.size / findings.length : 0,
    tp: found.size,
    fp: findings.length - found.size,
  };
}
export function answer(run) {
  const c = run.messages?.findLast((m) => m.role === "assistant")?.content;
  return typeof c === "string"
    ? c
    : (c ?? [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
}
export function grade(id, run, artifacts) {
  const calls = run.toolCalls ?? [],
    text = answer(run);
  const delegated = calls.filter((c) => /^(Agent|Task)$|delegate_task|spawn_agent/i.test(c.name));
  const journal = id === "testing" && artifacts.direct?.length ? artifacts.direct : (artifacts.journal ?? []);
  if (id === "review") {
    try {
      const m = reviewMetrics(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")).findings);
      return { ...m, pass: m.recall === 1 && m.precision === 1 };
    } catch {
      return { pass: false, error: "invalid findings JSON" };
    }
  }
  if (id === "scoped") {
    const gates = journal.flatMap((e, i) => (e.scope === "full" ? [i] : []));
    return {
      pass:
        artifacts.checkUnchanged !== false &&
        artifacts.fixed === true &&
        journal[0]?.scope === "scoped" &&
        gates.length === 1 &&
        gates[0] === journal.length - 1 &&
        journal.at(-1).status === 0,
      fullGates: gates.length,
    };
  }
  if (id === "testing") {
    const red = journal.findIndex(
      (e) =>
        e.status !== 0 &&
        /AssertionError|ERR_ASSERTION/.test(e.output) &&
        e.source === artifacts.original &&
        /assert/.test(e.test),
    );
    const green = journal.findIndex(
      (e, i) =>
        i > red && red >= 0 && e.status === 0 && e.source !== artifacts.original && e.test === journal[red].test,
    );
    const gates = journal.flatMap((e, i) => (e.scope === "full" ? [i] : []));
    return {
      pass:
        artifacts.checkUnchanged !== false &&
        red >= 0 &&
        green > red &&
        artifacts.fixed === true &&
        (id !== "scoped" ||
          (gates.length === 1 &&
            gates[0] === journal.length - 1 &&
            journal.at(-1).status === 0 &&
            journal.at(-1).test === journal[red].test &&
            journal[0]?.scope === "scoped")),
      red,
      green,
      fullGates: gates.length,
    };
  }
  if (id === "git") {
    const commit = artifacts["commit.txt"] ?? "",
      pr = artifacts["pr.txt"] ?? "";
    const checks = {
      conventional: /^(fix|feat|refactor|test|docs|chore)(\([\w-]+\))?!?: .+/.test(commit),
      resultFirst:
        /discount|remaining|price/i.test(pr.split("\n")[0] ?? "") &&
        /80|correct|fix|return/i.test(pr.split("\n")[0] ?? ""),
      bounded: pr.trim().split("\n").length <= 100,
      noCredit: !/(co-authored-by:.*(?:claude|gpt|agent)|generated with)/i.test(commit + pr),
      noFiller: !/(## (summary|test plan)|all tests pass|CI passed)/i.test(pr),
    };
    return { pass: Object.values(checks).every(Boolean), checks };
  }
  if (id === "tiny") return { pass: artifacts["title.txt"]?.trim() === "Arithmetic" && delegated.length === 0 };
  if (id === "long") {
    const command = calls.find((c) => /node slow\.mjs/.test(JSON.stringify(c.arguments)));
    return {
      pass:
        !!command &&
        /LONG_OK/.test(JSON.stringify(run.events ?? [])) &&
        !calls.some(
          (c) =>
            /wait|sleep/i.test(c.name) || /sleep|Start-Sleep|run_in_background.*true/.test(JSON.stringify(c.arguments)),
        ) &&
        /timeout[^\d]*[1-9]\d{4,}/i.test(JSON.stringify(command.arguments)),
    };
  }
  if (id === "owner") {
    const d = artifacts["decision.txt"] ?? "";
    return {
      pass:
        /10%|10 percent/.test(d) &&
        /owner|decision|pending/i.test(d) &&
        /revers|rollback|change/i.test(d) &&
        artifacts.unrelated === false,
    };
  }
  if (id === "broad") {
    const brief = delegated.map((c) => JSON.stringify(c.arguments)).join("\n") || artifacts["brief.txt"] || "";
    return {
      pass:
        delegated.length > 0 &&
        artifacts.briefQuality === true &&
        ["GOAL", "DONE-WHEN", "BUDGET"].every((s) => brief.includes(s)),
      capability: delegated.length ? "available" : "unavailable",
      brief,
      labels: ["GOAL", "DONE-WHEN", "BUDGET"].every((s) => brief.includes(s)),
    };
  }
  return { pass: false, error: "unknown task" };
}
