const sum = (rows, value) => rows.reduce((total, row) => total + value(row), 0);
const tokens = (row) => Object.values(row.tokens).reduce((a, b) => a + b, 0);
const key = (row) => `${row.provider}/${row.suite}/${row.task}/${row.seed}`;
const scope = {
  draft: (row) => row.suite === "quality" && row.task === "git",
  affected: (row) => row.suite === "shape" || row.task === "testing",
  check: (row) => row.suite === "shape" || row.task === "scoped" || row.task === "testing",
};
const called = (row, name) =>
  row.helperCalls.some((call) => new RegExp(`scripts[\\\\/]+${name}\\.mjs`, "u").test(JSON.stringify(call.arguments)));
const score = (rows) => {
  const values = rows.flatMap((row) => row.judgment?.rules.map((rule) => rule.score) ?? []);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
};

/** Conservative paired retention: no pass-rate loss on either model; ambiguous attribution is not a win. */
export function retention(evidence) {
  const shapes = evidence.filter((row) => row.suite === "shape");
  const proseShape = score(shapes.filter((row) => row.condition === "prose"));
  const scriptedShape = score(shapes.filter((row) => row.condition === "scripted"));
  const wordingImproved = proseShape !== null && scriptedShape !== null && scriptedShape > proseShape;
  return Object.entries(scope).map(([helper, relevant]) => {
    const prose = evidence.filter((row) => row.condition === "prose" && relevant(row));
    const scripted = evidence.filter((row) => row.condition === "scripted" && relevant(row));
    const baseline = new Map(prose.map((row) => [key(row), row]));
    const matched =
      scripted.length === prose.length && scripted.length >= 4 && scripted.every((row) => baseline.has(key(row)));
    const used = scripted.filter((row) => called(row, helper)).length;
    const confounded = scripted.some(
      (row) => called(row, helper) && Object.keys(scope).some((other) => other !== helper && called(row, other)),
    );
    const passLoss = ["claude", "codex"].some(
      (provider) =>
        sum(
          scripted.filter((row) => row.provider === provider),
          (row) => Number(row.pass),
        ) <
        sum(
          prose.filter((row) => row.provider === provider),
          (row) => Number(row.pass),
        ),
    );
    const callsSaved = sum(prose, (row) => row.calls) - sum(scripted, (row) => row.calls);
    const tokensSaved = [...prose, ...scripted].every((row) => row.metered !== false)
      ? sum(prose, tokens) - sum(scripted, tokens)
      : null;
    const keep =
      matched && used > 0 && !confounded && !passLoss && (callsSaved > 0 || tokensSaved > 0) && wordingImproved;
    return {
      helper,
      keep,
      used,
      pairs: scripted.length,
      matched,
      confounded,
      passLoss,
      callsSaved,
      tokensSaved,
      wordingImproved,
    };
  });
}
