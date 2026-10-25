export function metrics(rows, names) {
  const perSkill = names.map((skill) => {
    const tp = rows.filter((r) => r.expected === skill && r.predicted === skill).length;
    const fp = rows.filter((r) => r.expected !== skill && r.predicted === skill).length;
    const fn = rows.filter((r) => r.expected === skill && r.predicted !== skill).length;
    return { skill, tp, fp, fn, precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null };
  });
  const confusion = {};
  for (const row of rows.filter((r) => r.expected !== r.predicted)) {
    const pair = `${row.expected ?? "none"} -> ${row.predicted ?? "none"}`;
    confusion[pair] = (confusion[pair] ?? 0) + 1;
  }
  return { perSkill, confusion };
}
