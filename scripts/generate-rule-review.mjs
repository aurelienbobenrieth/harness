/* eslint-disable no-await-in-loop -- Package imports and diagnostics stay deterministic. */
import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "oxfmt";

const root = path.resolve(import.meta.dirname, "..");
const outputPath = path.join(root, "docs/reviews/rule-triage.html");
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
assert.notEqual(write, check, "Pass exactly one of --write or --check.");

const reviewReasons = new Map([
  [
    "oxlint-plugin-core/no-let",
    "Préférence globale forte : une mutation locale peut rester plus lisible et moins coûteuse.",
  ],
  [
    "oxlint-plugin-core/no-multi-positional-parameters",
    "Bonne direction d’API, mais le seuil uniforme peut alourdir de petites fonctions privées.",
  ],
  [
    "oxlint-plugin-core/no-reexport-only-modules",
    "Politique d’architecture utile, à confirmer pour les façades et points d’entrée secondaires.",
  ],
  [
    "oxlint-plugin-effect/dependencies-first",
    "Convention de lecture plutôt que défaut de correction ; confirmer qu’elle améliore vraiment les diffs.",
  ],
  [
    "oxlint-plugin-effect/no-switch",
    "Un switch exhaustif peut être plus direct que Match dans certains modules Effect.",
  ],
  [
    "oxlint-plugin-effect/prefer-effect-array-helpers",
    "Préférence d’écosystème : mesurer la lisibilité face aux helpers natifs avant généralisation.",
  ],
  ["oxlint-plugin-effect/prefer-match", "Préférence d’expression ; le gain dépend du type de branchement rencontré."],
  [
    "oxlint-plugin-effect/schema-type-adjacent",
    "Organisation de fichier opinionated ; utile seulement si l’adjacence reste stable à grande échelle.",
  ],
  [
    "oxlint-plugin-effect/use-root-imports",
    "Politique dépendante de la stabilité des exports Effect ; à valider à chaque profil de compatibilité.",
  ],
  [
    "oxlint-plugin-shopify-app/no-nav-emoji",
    "Politique de ton très spécifique ; confirmer qu’elle correspond à toutes les surfaces ciblées.",
  ],
  [
    "oxlint-plugin-type-evidence/no-unknown-parameters",
    "Peut gêner les frontières réellement non fiables ; vérifier que les exceptions couvrent l’interop.",
  ],
  [
    "oxlint-plugin-type-evidence/no-unknown-returns",
    "Peut gêner les adaptateurs qui exposent volontairement une valeur non décodée.",
  ],
  [
    "oxlint-plugin-type-evidence/no-unknown-type-aliases",
    "Règle stricte de modélisation ; confirmer qu’elle ne déplace pas seulement unknown ailleurs.",
  ],
]);

const shorten = (value, limit = 190) => {
  const text = value.replaceAll(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  const prefix = text.slice(0, limit - 1);
  return `${prefix.slice(0, Math.max(0, prefix.lastIndexOf(" ")))}…`;
};

const presetLabel = (name) =>
  name
    .replace(/Preset$/u, "")
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();

function recommendation(packageName, kind, activation, id) {
  const specific = reviewReasons.get(`${packageName}/${id}`);
  if (specific !== undefined) return { verdict: "review", reason: specific };
  if (kind === "agentlint" && activation === "opt-in")
    return {
      verdict: "review",
      reason: "Heuristique volontairement opt-in : mesurer son volume et ses décisions utiles sur un vrai projet.",
    };
  if (kind === "agentlint")
    return {
      verdict: "keep",
      reason: "Question de revue contextuelle utile, avec déclencheur borné et contrat explicite.",
    };
  if (kind === "check")
    return {
      verdict: "keep",
      reason: "Contrat structurel vérifiable qui complète le lint sans prétendre couvrir le runtime.",
    };
  return {
    verdict: "keep",
    reason: "Diagnostic local et actionnable, couvert par des cas positifs et négatifs.",
  };
}

const packages = [];
for (const directory of (await readdir(path.join(root, "packages"))).toSorted()) {
  const packageRoot = path.join(root, "packages", directory);
  const manifest = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
  const module = await import(pathToFileURL(path.join(packageRoot, "dist/index.mjs")).href);
  const entries = [];
  if (directory.startsWith("oxlint-plugin-"))
    for (const [id, rule] of Object.entries(module.default.rules))
      entries.push({
        id,
        description: rule.meta?.docs?.description ?? "",
        kind: "oxlint",
        activation: "configuration",
      });
  if (directory.startsWith("agentlint-plugin-")) {
    const presetMembership = new Map();
    for (const [exportName, value] of Object.entries(module)) {
      if (!exportName.endsWith("Preset") || !Array.isArray(value?.rules)) continue;
      for (const binding of value.rules) {
        const id = binding?.standard?.id;
        if (typeof id !== "string") continue;
        const labels = presetMembership.get(id) ?? [];
        labels.push(presetLabel(exportName));
        presetMembership.set(id, labels);
      }
    }
    for (const value of Object.values(module)) {
      if (!value?.standard?.id || !value?.detector || !value?.binding) continue;
      const id = value.standard.id.split("/").at(-1);
      const labels = presetMembership.get(value.standard.id)?.toSorted() ?? [];
      entries.push({
        id,
        description: value.standard.summary,
        kind: "agentlint",
        activation: labels.length > 0 ? labels.join(", ") : "opt-in",
      });
    }
  }
  if (directory.startsWith("conformance-"))
    for (const value of Object.values(module)) {
      if (!value?.id || typeof value.run !== "function") continue;
      const activation = ["closed-design-system-probe", "tsconfig-strictness"].includes(value.id)
        ? "opt-in"
        : "programmatique";
      entries.push({ id: value.id, description: value.description, kind: "check", activation });
    }
  const units = entries
    .map((entry) => ({
      ...entry,
      description: shorten(entry.description),
      recommendation: recommendation(directory, entry.kind, entry.activation, entry.id),
      source:
        entry.kind === "check"
          ? `../../packages/${directory}/src/checks/${entry.id}.ts`
          : `../../packages/${directory}/src/rules/${entry.id}/rule.ts`,
    }))
    .toSorted((a, b) => a.id.localeCompare(b.id));
  packages.push({
    name: manifest.name,
    directory,
    description: shorten(manifest.description ?? "Package de configuration sans règle enregistrée."),
    units,
  });
}

const total = packages.reduce((sum, item) => sum + item.units.length, 0);
const rules = packages.reduce((sum, item) => sum + item.units.filter((unit) => unit.kind !== "check").length, 0);
const checks = total - rules;
assert.ok(packages.length > 0, "No workspace packages found.");
assert.ok(total > 0, "No rules or checks found.");

const data = JSON.stringify(packages).replaceAll("<", "\\u003c");
const rawHtml = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Harness — tri des règles</title>
  <style>
    :root { color-scheme: light dark; --bg: #f7f7f5; --surface: #fff; --text: #20211f; --muted: #686b66; --border: #d8dad5; --accent: #285f4f; --soft: #e8f0ed; --warn: #8b5e14; --warn-soft: #f6ecd7; }
    @media (prefers-color-scheme: dark) { :root { --bg: #171916; --surface: #20231f; --text: #eef0eb; --muted: #aeb3aa; --border: #3a3e38; --accent: #8cc8b5; --soft: #273b34; --warn: #efc16d; --warn-soft: #3c3120; } }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.45 system-ui, sans-serif; }
    main { max-width: 1440px; margin: 0 auto; padding: 24px; }
    h1 { margin: 0 0 6px; font-size: 24px; font-weight: 600; }
    h2 { margin: 0; font-size: 17px; font-weight: 600; }
    p { margin: 0; }
    .muted { color: var(--muted); }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: 10px; margin: 18px 0; }
    .stat { padding: 12px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
    .stat strong { display: block; margin-top: 2px; font-size: 20px; font-weight: 600; }
    .controls { display: grid; grid-template-columns: minmax(220px, 2fr) repeat(3, minmax(150px, 1fr)); gap: 10px; margin-bottom: 10px; }
    label { display: grid; gap: 4px; color: var(--muted); font-size: 12px; }
    input, select, button { min-height: 38px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font: inherit; padding: 7px 9px; }
    button, .file-button { cursor: pointer; }
    button:hover, .file-button:hover { border-color: var(--accent); }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 18px; }
    .actions button, .file-button { display: inline-flex; align-items: center; min-height: 36px; padding: 7px 11px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font: inherit; }
    .actions .primary { background: var(--accent); border-color: var(--accent); color: var(--bg); }
    .file-button input { display: none; }
    .package { margin: 14px 0; background: var(--surface); border: 1px solid var(--border); border-radius: 9px; overflow: hidden; }
    .package summary { display: flex; gap: 10px; align-items: baseline; padding: 13px 15px; cursor: pointer; }
    .package summary::marker { color: var(--muted); }
    .count { margin-left: auto; color: var(--muted); white-space: nowrap; }
    .package-description { padding: 0 15px 12px; color: var(--muted); }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th { color: var(--muted); font-size: 12px; font-weight: 500; text-align: left; }
    th, td { padding: 10px 12px; border-top: 1px solid var(--border); vertical-align: top; }
    th:nth-child(1) { width: 25%; } th:nth-child(2) { width: 16%; } th:nth-child(3) { width: 39%; } th:nth-child(4) { width: 20%; }
    code { font-size: 12px; }
    a { color: var(--text); text-decoration-color: var(--border); }
    .description { margin-top: 4px; color: var(--muted); }
    .badge { display: inline-block; margin-right: 5px; padding: 2px 6px; border-radius: 999px; background: var(--soft); color: var(--text); font-size: 11px; }
    .badge.review { background: var(--warn-soft); color: var(--warn); }
    .decision { width: 100%; }
    .empty { padding: 24px; text-align: center; color: var(--muted); }
    .hidden { display: none; }
    @media (max-width: 820px) {
      main { padding: 14px; }
      .summary { grid-template-columns: repeat(2, 1fr); }
      .controls { grid-template-columns: 1fr 1fr; }
      .table-wrap { overflow-x: auto; }
      table { min-width: 850px; }
    }
    @media (max-width: 480px) { .controls { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>Tri des règles Harness</h1>
    <p class="muted">La recommandation est un avis, pas une décision. Chaque règle reste « non revue » jusqu’à ton choix.</p>
    <div class="summary" aria-live="polite">
      <div class="stat"><span class="muted">Périmètre</span><strong>${total}</strong><span class="muted">${rules} règles · ${checks} checks</span></div>
      <div class="stat"><span class="muted">Décidées</span><strong id="reviewed-count">0</strong><span class="muted" id="reviewed-share">0 %</span></div>
      <div class="stat"><span class="muted">À revoir selon l’auto-review</span><strong id="attention-count">0</strong><span class="muted">avant promotion</span></div>
      <div class="stat"><span class="muted">Affichées</span><strong id="visible-count">${total}</strong><span class="muted">selon les filtres</span></div>
    </div>
    <div class="controls">
      <label>Recherche<input id="search" type="search" placeholder="Identifiant ou description"></label>
      <label>Package<select id="package-filter"><option value="">Tous</option></select></label>
      <label>Auto-review<select id="recommendation-filter"><option value="">Toutes</option><option value="keep">Garder</option><option value="review">À revoir</option></select></label>
      <label>Décision<select id="decision-filter"><option value="">Toutes</option><option value="unreviewed">Non revue</option><option value="keep">Garder</option><option value="modify">Modifier</option><option value="remove">Retirer</option></select></label>
    </div>
    <div class="actions">
      <button class="primary" id="export" type="button">Exporter les décisions</button>
      <button id="apply-recommendations" type="button">Appliquer l’avis aux lignes affichées</button>
      <label class="file-button">Importer un JSON<input id="import" type="file" accept="application/json,.json"></label>
      <button id="clear" type="button">Effacer les décisions</button>
    </div>
    <div id="packages"></div>
    <p id="empty" class="empty hidden">Aucune règle ne correspond aux filtres.</p>
  </main>
  <script>
    const packageData = ${data};
    const storageKey = "harness-rule-triage-v1";
    const decisions = JSON.parse(localStorage.getItem(storageKey) || "{}");
    const packageFilter = document.getElementById("package-filter");
    for (const item of packageData) {
      const option = document.createElement("option");
      option.value = item.directory;
      option.textContent = item.name;
      packageFilter.append(option);
    }
    const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    const allUnits = packageData.flatMap((item) => item.units.map((unit) => ({ ...unit, package: item.directory })));
    const unitKey = (packageName, id) => packageName + "/" + id;
    const unitsByKey = new Map(allUnits.map((unit) => [unitKey(unit.package, unit.id), unit]));
    const save = () => localStorage.setItem(storageKey, JSON.stringify(decisions));
    function updateDecisionSummary() {
      const reviewed = allUnits.filter((unit) => (decisions[unitKey(unit.package, unit.id)] || "unreviewed") !== "unreviewed").length;
      document.getElementById("reviewed-count").textContent = String(reviewed);
      document.getElementById("reviewed-share").textContent = Math.round(reviewed / allUnits.length * 100) + " %";
      document.getElementById("attention-count").textContent = String(allUnits.filter((unit) => unit.recommendation.verdict === "review").length);
    }
    function render() {
      const query = document.getElementById("search").value.trim().toLowerCase();
      const selectedPackage = packageFilter.value;
      const recommendation = document.getElementById("recommendation-filter").value;
      const decision = document.getElementById("decision-filter").value;
      let visible = 0;
      const html = packageData.map((item) => {
        if (selectedPackage && item.directory !== selectedPackage) return "";
        const rows = item.units.filter((unit) => {
          const key = unitKey(item.directory, unit.id);
          const haystack = (unit.id + " " + unit.description + " " + unit.recommendation.reason).toLowerCase();
          return (!query || haystack.includes(query)) && (!recommendation || unit.recommendation.verdict === recommendation) && (!decision || (decisions[key] || "unreviewed") === decision);
        });
        if (item.units.length === 0 && !query && !recommendation && !decision) return '<details class="package"><summary><h2>' + escapeHtml(item.name) + '</h2><span class="count">configuration</span></summary><p class="package-description">' + escapeHtml(item.description) + '</p></details>';
        if (rows.length === 0) return "";
        visible += rows.length;
        const rowHtml = rows.map((unit) => {
          const key = unitKey(item.directory, unit.id);
          const value = decisions[key] || "unreviewed";
          const verdict = unit.recommendation.verdict === "keep" ? "Garder" : "À revoir";
          return '<tr><td><a href="' + escapeHtml(unit.source) + '"><code>' + escapeHtml(unit.id) + '</code></a><p class="description">' + escapeHtml(unit.description) + '</p></td><td><span class="badge">' + escapeHtml(unit.kind) + '</span><span class="badge">' + escapeHtml(unit.activation) + '</span></td><td><span class="badge ' + escapeHtml(unit.recommendation.verdict) + '">' + verdict + '</span>' + escapeHtml(unit.recommendation.reason) + '</td><td><label><span class="muted">Ton choix</span><select class="decision" data-key="' + escapeHtml(key) + '"><option value="unreviewed"' + (value === "unreviewed" ? " selected" : "") + '>Non revue</option><option value="keep"' + (value === "keep" ? " selected" : "") + '>Garder</option><option value="modify"' + (value === "modify" ? " selected" : "") + '>Modifier</option><option value="remove"' + (value === "remove" ? " selected" : "") + '>Retirer</option></select></label></td></tr>';
        }).join("");
        return '<details class="package"><summary><h2>' + escapeHtml(item.name) + '</h2><span class="count">' + rows.length + ' / ' + item.units.length + '</span></summary><p class="package-description">' + escapeHtml(item.description) + '</p><div class="table-wrap"><table><thead><tr><th>Règle / check</th><th>Activation</th><th>Auto-review</th><th>Décision</th></tr></thead><tbody>' + rowHtml + '</tbody></table></div></details>';
      }).join("");
      document.getElementById("packages").innerHTML = html;
      document.getElementById("empty").classList.toggle("hidden", visible > 0 || (!query && !recommendation && !decision));
      document.getElementById("visible-count").textContent = String(visible);
      updateDecisionSummary();
    }
    document.querySelector(".controls").addEventListener("input", render);
    document.getElementById("packages").addEventListener("change", (event) => {
      const select = event.target.closest("select[data-key]");
      if (!select) return;
      if (select.value === "unreviewed") delete decisions[select.dataset.key]; else decisions[select.dataset.key] = select.value;
      save();
      if (document.getElementById("decision-filter").value) render(); else updateDecisionSummary();
    });
    document.getElementById("apply-recommendations").addEventListener("click", () => {
      const visibleSelects = [...document.querySelectorAll("select[data-key]")];
      if (visibleSelects.length === 0 || !confirm("Appliquer l’auto-review aux " + visibleSelects.length + " lignes affichées ? Les avis « à revoir » deviendront « modifier ».")) return;
      for (const select of visibleSelects) {
        const value = unitsByKey.get(select.dataset.key).recommendation.verdict === "keep" ? "keep" : "modify";
        decisions[select.dataset.key] = value;
        select.value = value;
      }
      save();
      if (document.getElementById("decision-filter").value) render(); else updateDecisionSummary();
    });
    document.getElementById("export").addEventListener("click", () => {
      const payload = { schemaVersion: 1, total: allUnits.length, decisions: Object.fromEntries(allUnits.map((unit) => { const key = unitKey(unit.package, unit.id); return [key, decisions[key] || "unreviewed"]; })) };
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2) + "\\n"], { type: "application/json" }));
      link.download = "harness-rule-decisions.json";
      link.click();
      URL.revokeObjectURL(link.href);
    });
    document.getElementById("import").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const payload = JSON.parse(await file.text());
      if (payload.schemaVersion !== 1 || typeof payload.decisions !== "object") throw new Error("Fichier de décisions incompatible.");
      const validKeys = new Set(allUnits.map((unit) => unitKey(unit.package, unit.id)));
      for (const [key, value] of Object.entries(payload.decisions)) if (validKeys.has(key) && ["keep", "modify", "remove"].includes(value)) decisions[key] = value;
      save();
      render();
      event.target.value = "";
    });
    document.getElementById("clear").addEventListener("click", () => {
      if (!confirm("Effacer toutes les décisions enregistrées dans ce navigateur ?")) return;
      for (const key of Object.keys(decisions)) delete decisions[key];
      save();
      render();
    });
    render();
  </script>
</body>
</html>
`;

const { code: html, errors: formatErrors } = await format(outputPath, rawHtml, {
  arrowParens: "always",
  printWidth: 120,
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "all",
});
assert.deepEqual(formatErrors, [], "oxfmt could not format the rule triage artifact.");

if (write) {
  await writeFile(outputPath, html);
  console.log(`Generated ${path.relative(root, outputPath)} with ${rules} rules and ${checks} checks.`);
} else {
  assert.equal(await readFile(outputPath, "utf8"), html, "Rule triage artifact is stale; run pnpm review:rules.");
  console.log(`Validated ${path.relative(root, outputPath)} with ${rules} rules and ${checks} checks.`);
}
