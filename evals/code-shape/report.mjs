const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
export function summarize(rows) {
  const groups = Map.groupBy(rows, (row) => `${row.suite}/${row.provider}/${row.condition}`);
  return {
    conditions: [...groups].map(([condition, group]) => {
      const measured = group.map((row) => row.grade.measured).filter(Boolean);
      const metered = group.filter(
        (row) => row.run.usages?.length || row.run.events?.some((event) => event.type === "result" && event.usage),
      );
      const judged = group.filter((row) => !row.judgeError && row.judgment?.value?.rules);
      const metrics = Object.fromEntries(
        [
          "findings",
          "harnessFindings",
          "duplicatedLines",
          "duplicationPercent",
          "cyclomaticTotal",
          "cyclomaticMax",
          "deadExports",
          "testCount",
          "added",
          "deleted",
        ].map((name) => [name, mean(measured.map((value) => value[name]))]),
      );
      const scores = Object.fromEntries(
        ["temporalCoupling", "abstractionEarnsKeep", "boundaries", "naming", "testing"].map((rule) => [
          rule,
          mean(judged.map((row) => row.judgment.value.rules.find((value) => value.rule === rule).score)),
        ]),
      );
      return {
        condition,
        runs: group.length,
        passed: group.filter((row) => row.grade.pass).length,
        passRate: mean(group.map((row) => Number(row.grade.pass))),
        completed: group.filter((row) => row.run.status === "completed").length,
        testsAddedRuns: group.filter((row) => row.grade.addedTests).length,
        testsGreenRuns: group.filter((row) => row.grade.measured?.testsPass).length,
        skillLoadedRuns: group.filter((row) => row.run.skillLoads?.length > 0).length,
        judged: judged.length,
        scores,
        metrics,
        calls: mean(group.map((row) => row.run.toolCalls.length)),
        durationMs: mean(group.map((row) => row.run.durationMs)),
        meteredRuns: metered.length,
        tokens: mean(metered.map((row) => Object.values(row.run.tokens).reduce((a, b) => a + b, 0))),
        cacheTokens: mean(
          metered.map((row) => row.run.tokens.cached + row.run.tokens.cacheWrite5m + row.run.tokens.cacheWrite1h),
        ),
        usd: group.reduce((sum, row) => sum + row.usd, 0),
      };
    }),
    citations: rows
      .filter((row) => row.suite === "shape")
      .map((row) => ({
        provider: row.provider,
        condition: row.condition,
        seed: row.seed,
        task: row.id,
        status: row.run.status,
        pass: row.grade.pass,
        judgeError: row.judgeError ?? null,
        rules: row.judgeError ? null : row.judgment?.value?.rules,
      })),
  };
}
