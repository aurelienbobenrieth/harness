// Builds the app score page: the distribution, the findings shared by several routes, then one line per route
// that opens to its full table. Usage: node report.cjs results.json out.html
// results.json:
// { "title": "My app, native score", "date": "2026-11-16",
//   "routes": [ { "route": "/leaks/save20", "name": "Leak", "score": 3, "provisional": true, "checked": 7, "total": 9,
//       "findings": [ { "element", "ours", "admin", "entry", "verdict", "fix", "effort" } ],
//       "notChecked": [ "..." ], "native": [ "..." ], "shots": { "ours": "leak.png", "admin": "order.png" } } ],
//   "shared": [ { "finding": "Bulk bar is 36 high, the admin's 31", "fix": "index-table bulk bar", "routes": [ "/leaks" ] } ] }
// A route with no `score` is "not checked". Image paths are relative to the page.
const fs = require("fs");

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("usage: node report.cjs results.json out.html");
const data = JSON.parse(fs.readFileSync(input, "utf8"));
const esc = (v) =>
  String(v === undefined || v === null ? "" : v).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

const routes = data.routes.toSorted(
  (a, b) => (a.score === undefined ? 9 : a.score) - (b.score === undefined ? 9 : b.score),
);
const count = (n) => routes.filter((r) => r.score === n).length;
const unchecked = routes.filter((r) => r.score === undefined).length;
const distribution =
  [5, 4, 3, 2, 1].map((n) => `<div class="tile s${n}"><b>${count(n)}</b><span>at ${n}</span></div>`).join("") +
  `<div class="tile"><b>${unchecked}</b><span>not checked</span></div>`;

const table = (r) =>
  r.findings && r.findings.length
    ? `<div class="scroll"><table><thead><tr><th>#</th><th>Element</th><th>Ours</th><th>The admin does</th><th>Entry</th><th>Verdict</th><th>Fix</th><th>Effort</th></tr></thead><tbody>${r.findings
        .map(
          (f, i) =>
            `<tr><td>${i + 1}</td><td>${esc(f.element)}</td><td>${esc(f.ours)}</td><td>${esc(f.admin)}</td><td><code>${esc(f.entry)}</code></td><td><span class="verdict">${esc(f.verdict)}</span></td><td>${esc(f.fix)}</td><td>${esc(f.effort)}</td></tr>`,
        )
        .join("")}</tbody></table></div>`
    : `<p class="quiet">No finding.</p>`;
const list = (label, items) => (items && items.length ? `<p><b>${label}:</b> ${items.map(esc).join("; ")}</p>` : "");
const shots = (r) =>
  r.shots
    ? `<div class="shots">${["ours", "admin"]
        .filter((k) => r.shots[k])
        .map(
          (k) =>
            `<figure><img src="${esc(r.shots[k])}" alt="${k === "ours" ? "Our screen" : "The admin"}" loading="lazy"><figcaption>${k === "ours" ? "Ours" : "The admin"}</figcaption></figure>`,
        )
        .join("")}</div>`
    : "";

const row = (r) => {
  const score =
    r.score === undefined
      ? `<span class="score">not checked</span>`
      : `<span class="score s${r.score}">${r.score}/5${r.provisional ? " provisional" : ""}</span>`;
  const worst =
    r.findings && r.findings[0]
      ? `${esc(r.findings[0].element)}: ${esc(r.findings[0].verdict)}`
      : r.score === undefined
        ? ""
        : "nothing to fix";
  const checked = r.total ? `${r.checked || 0} of ${r.total} checked` : "";
  return `<details><summary>${score}<span class="name">${esc(r.name || r.route)} <code>${esc(r.route)}</code></span><span class="quiet">${checked}</span><span class="worst">${worst}</span></summary><div class="body">${table(r)}${list("Not checked", r.notChecked)}${list("Already native, do not touch", r.native)}${shots(r)}</div></details>`;
};

const shared = (data.shared || []).length
  ? `<h2>Fix once, gains on several routes</h2><ul class="shared">${data.shared.map((s) => `<li><b>${esc(s.finding)}</b><span>${esc(s.fix)}</span><span class="quiet">${s.routes.length} routes: ${s.routes.map((x) => `<code>${esc(x)}</code>`).join(" ")}</span></li>`).join("")}</ul>`
  : "";

const css = `:root{--bg:#f6f6f7;--card:#fff;--ink:#1a1a1a;--quiet:#616161;--line:#e3e3e3;--s1:#d82019;--s2:#c4580a;--s3:#8a6116;--s4:#2a6f97;--s5:#29845a}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#111;--card:#1c1c1c;--ink:#ededed;--quiet:#a3a3a3;--line:#333}}
:root[data-theme="dark"]{--bg:#111;--card:#1c1c1c;--ink:#ededed;--quiet:#a3a3a3;--line:#333}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,sans-serif}
main{max-width:1080px;margin:0 auto;padding:24px 16px 64px}h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:32px 0 12px}
.quiet{color:var(--quiet)}.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;margin-top:20px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}.tile b{display:block;font-size:24px}.tile span{color:var(--quiet);font-size:12px}
.tile.s1 b,.score.s1{color:var(--s1)}.tile.s2 b,.score.s2{color:var(--s2)}.score.s3{color:var(--s3)}.score.s4{color:var(--s4)}.tile.s5 b,.score.s5{color:var(--s5)}
details{background:var(--card);border:1px solid var(--line);border-radius:12px;margin-bottom:8px}
summary{display:grid;grid-template-columns:120px minmax(0,1fr) auto;gap:4px 12px;align-items:baseline;padding:12px 16px;cursor:pointer}
summary .worst{grid-column:2/-1;color:var(--quiet);font-size:13px}.score{font-weight:600}.name{font-weight:600}
.body{padding:4px 16px 16px;border-top:1px solid var(--line)}.scroll{overflow-x:auto}
table{border-collapse:collapse;width:100%;min-width:720px;font-size:13px}th,td{text-align:left;vertical-align:top;padding:8px 10px 8px 0;border-bottom:1px solid var(--line)}th{color:var(--quiet);font-weight:500}
code{font:12px ui-monospace,monospace;color:var(--quiet)}.verdict{white-space:nowrap;font-weight:600}
.shared{list-style:none;padding:0;margin:0}.shared li{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin-bottom:8px;display:grid;gap:2px}
.shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-top:12px}figure{margin:0}img{max-width:100%;border:1px solid var(--line);border-radius:8px}figcaption{color:var(--quiet);font-size:12px}
@media (max-width:560px){summary{grid-template-columns:1fr}summary .worst{grid-column:1}}`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(data.title || "Native score")}</title><style>${css}</style></head><body><main>
<h1>${esc(data.title || "Native score")}</h1><p class="quiet">${esc(data.date || "")} · ${routes.length} routes · no app average: the worst route leads.</p>
<div class="tiles">${distribution}</div>${shared}<h2>Routes, worst first</h2>${routes.map(row).join("\n")}
</main></body></html>`;
fs.writeFileSync(output, html);
console.log(`${routes.length} routes -> ${output}`);
