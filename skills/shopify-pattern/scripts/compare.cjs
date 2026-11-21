// Compares what the probe read on your screen with a value sheet measured in the admin, and prints only the differences.
// It opens no browser: the expression it prints runs in any browser tool, in any stack.
//   node compare.cjs <sheet.json> --expr admin [--state name]                   the expression that measures the admin again
//   node compare.cjs <sheet.json> --expr ours [--ours map.json] [--state name]  the expression to evaluate in your app's frame
//   node compare.cjs <sheet.json> <result.json> [--ours map.json] [--state name] [--label "/route"]
// result.json is what the "ours" expression returned. Exit code 1 while a difference is left, so a sheet can run as a test.
// map.json (optional) says where the parts are on your screen: { root, parts: { name: locator } }, locator syntax at the top
// of probe.js. A part with no locator is looked up as [data-part="<name>"].
const fs = require("fs");
const path = require("path");

const source = fs
  .readFileSync(path.join(__dirname, "probe.js"), "utf8")
  .replace(/^\s*\/\/.*$/gm, "")
  .trim();
const skip = new Set(["y", "tag", "text"]);
const short = (v) =>
  Object.entries(v)
    .filter(([k]) => !skip.has(k))
    .map(([k, x]) => `${k} ${x}`)
    .join(", ");

const stateOf = (sheet, state) => {
  const want = state ? (sheet.states || {})[state] : sheet;
  if (!want) throw new Error(`no state "${state}" in sheet ${sheet.entry}`);
  return want;
};

/** The one expression to evaluate: in the admin (`side` "admin") or in the app's frame (`side` "ours"). */
const expression = (sheet, state, side, map = {}) => {
  const want = stateOf(sheet, state);
  if (side === "admin")
    return `(${source})(${JSON.stringify(want.locate || sheet.locate)},${JSON.stringify(sheet.root || null)})`;
  const root = map.root || sheet.root || null;
  const locators = { ...map.parts };
  for (const name of [...Object.keys(want.parts), root].filter(Boolean))
    locators[name] = locators[name] || `[data-part="${name}"]`;
  return `(${source})(${JSON.stringify(locators)},${JSON.stringify(root)})`;
};

/** The lines to print and the exit code, from what the "ours" expression returned. */
const compare = (sheet, state, got, { map = {}, label = "ours", errors = [] } = {}) => {
  const want = stateOf(sheet, state);
  const tolerance = sheet.tolerance === undefined ? 1 : sheet.tolerance;
  const rootName = map.root || sheet.root;
  const fluid = sheet.rootWidth && got[rootName] && Math.abs(got[rootName].w - sheet.rootWidth) > tolerance;
  const lines = [];
  const missing = [];
  let values = 0;
  let differences = 0;
  for (const [name, admin] of Object.entries(want.parts)) {
    if (admin === null) {
      if (got[name]) {
        differences++;
        lines.push(`${name}: present on ours, absent in the admin`);
      }
      continue;
    }
    if (!got[name]) {
      differences++;
      missing.push(`${name}: NOT FOUND on ours, absent or locator wrong (admin: ${short(admin)})`);
      continue;
    }
    const diffs = [];
    for (const [key, a] of Object.entries(admin)) {
      if (skip.has(key)) continue;
      values++;
      const o = got[name][key];
      const same =
        typeof a === "number"
          ? typeof o === "number" && Math.abs(a - o) <= tolerance
          : String(a) === String(o === undefined ? "" : o);
      if (!same) diffs.push(`${key} ${a} -> ours ${o === undefined ? "unset" : o}`);
    }
    if (diffs.length) {
      differences += diffs.length;
      lines.push(`${name}: ${diffs.join("; ")}`);
    }
  }
  const age = Math.round((Date.now() - Date.parse(sheet.measured)) / 864e5);
  const out = [
    `${sheet.entry}${state ? ` [${state}]` : ""} vs ${label}: ${Object.keys(want.parts).length} parts, ${values} values, ${differences} differences (sheet ${sheet.measured}, ${sheet.admin}${age > 30 ? `, STALE ${age} days: re-measure` : ""})`,
  ];
  for (const line of [...missing, ...lines]) out.push(`  ${line}`);
  if (fluid) out.push(`  note: our root is ${got[rootName].w} wide, the sheet ${sheet.rootWidth}`);
  if (errors.length) out.push(`  errors: ${errors.slice(0, 3).join(" | ")}`);
  return { lines: out, code: differences || errors.length ? 1 : 0 };
};

module.exports = { expression, compare };

if (require.main === module) {
  const arg = (name) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const [sheetFile, resultFile] = process.argv.slice(2);
  if (!sheetFile)
    throw new Error(
      "usage: node compare.cjs <sheet.json> (--expr admin|ours | <result.json>) [--ours map.json] [--state name] [--label text]",
    );
  const sheet = JSON.parse(fs.readFileSync(sheetFile, "utf8"));
  const map = arg("ours") ? JSON.parse(fs.readFileSync(arg("ours"), "utf8")) : {};
  if (arg("expr")) {
    console.log(expression(sheet, arg("state"), arg("expr"), map));
  } else {
    const { lines, code } = compare(sheet, arg("state"), JSON.parse(fs.readFileSync(resultFile, "utf8")), {
      map,
      label: arg("label"),
    });
    console.log(lines.join("\n"));
    process.exit(code);
  }
}
