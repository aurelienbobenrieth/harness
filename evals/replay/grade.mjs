import ts from "typescript-legacy";

const parsed = (file, text) =>
  ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
const at = (tree, node) => tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
const visit = (tree, fn) => {
  const walk = (node) => {
    fn(node);
    ts.forEachChild(node, walk);
  };

  walk(tree);
};

/** One syntactic change at a time; invalid/uncovered mutants never count as kills. */
export function mutants(file, source) {
  const tree = parsed(file, source),
    result = [];
  const add = (node, replacement, kind) =>
    result.push({
      kind,
      line: at(tree, node),
      original: node.getText(tree),
      replacement,
      source: source.slice(0, node.getStart(tree)) + replacement + source.slice(node.end),
    });
  const operators = {
    ">": ">=",
    "<": "<=",
    ">=": ">",
    "<=": "<",
    "===": "!==",
    "!==": "===",
    "&&": "||",
    "||": "&&",
    "+": "-",
    "-": "+",
  };

  visit(tree, (node) => {
    if (ts.isBinaryExpression(node) && operators[node.operatorToken.getText(tree)])
      add(node.operatorToken, operators[node.operatorToken.getText(tree)], "operator");
    if (ts.isNumericLiteral(node) && Number.isFinite(Number(node.text)))
      add(node, String(Number(node.text) + 1), "boundary");

    if (ts.isReturnStatement(node) && node.expression) {
      const text = node.expression.getText(tree);

      add(node.expression, text === "true" ? "false" : text === "false" ? "true" : "undefined", "return");
    }
  });

  return result;
}

/** Signals require review; counts are not quality verdicts. */
export function sourceSignals(sources) {
  const infrastructure = [],
    tautology = [],
    exports = [],
    imports = [],
    strategies = { pbt: [], browser: [], fakes: [], adapters: [] };

  for (const [file, source] of Object.entries(sources)) {
    const tree = parsed(file, source),
      isTest = /(?:test|spec)\.[cm]?[jt]sx?$/.test(file);
    const imported = new Map();

    visit(tree, (node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;

        imports.push({ file, line: at(tree, node), specifier });
        const bindings = node.importClause?.namedBindings;

        if (bindings && ts.isNamedImports(bindings))
          for (const binding of bindings.elements) imported.set(binding.name.text, specifier);
        if (
          !isTest &&
          /\/_\/domain\//.test(file) &&
          /persistence|postgres|cloudflare|node:|unstable\/(sql|http|rpc)|\/adapters/.test(specifier)
        )
          infrastructure.push({ file, line: at(tree, node), quote: node.getText(tree) });
        if (/memory|fake/.test(specifier)) strategies.fakes.push({ file, specifier });
        if (/postgres|cloudflare|adapter/.test(specifier)) strategies.adapters.push({ file, specifier });
      }

      if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        const names = ts.isVariableStatement(node)
          ? node.declarationList.declarations.map((d) => d.name.getText(tree))
          : node.name
            ? [node.name.getText(tree)]
            : [];

        for (const name of names) exports.push({ file, line: at(tree, node), name, kind: ts.SyntaxKind[node.kind] });
      }
    });

    if (isTest)
      visit(tree, (node) => {
        if (!ts.isCallExpression(node)) return;
        const target = node.expression.getText(tree);

        if (/^(?:vi|jest)\.(?:mock|spyOn)$/.test(target)) {
          const value = node.arguments[0]?.getText(tree).replace(/["']/g, "");

          if (
            [...imported.values()].some((specifier) => value === specifier) &&
            !/memory|testing|fake/.test(value ?? "")
          )
            tautology.push({
              file,
              line: at(tree, node),
              kind: "mocked-import-review",
              quote: node.getText(tree),
            });
        }

        if (/\.(?:toBe|toEqual|toStrictEqual|toMatchObject)$/.test(target)) {
          const expected = node.arguments[0]?.getText(tree) ?? "";
          const helpers = [...imported].filter(
            ([name, specifier]) =>
              !/vite|vitest|testing|^node:/.test(specifier) && new RegExp(`\\b${name}\\b`).test(expected),
          );

          if (helpers.length)
            tautology.push({
              file,
              line: at(tree, node),
              kind: "production-oracle-review",
              quote: node.getText(tree),
            });
        }

        if (/\b(?:fc|FastCheck)\.(?:assert|check|property|asyncProperty)\b/.test(target))
          strategies.pbt.push({ file, line: at(tree, node) });
      });
    if (/browser|playwright|puppeteer/.test(file + source)) strategies.browser.push({ file });
  }

  const all = Object.values(sources).join("\n");
  const usedOnce = exports.filter((item) => (all.match(new RegExp(`\\b${item.name}\\b`, "g")) ?? []).length <= 2);

  return { infrastructure, tautology, exports, usedOnce, imports, strategies };
}

export function validateJudgment(value, sources) {
  return ["isolation", "abstraction", "tests", "fit"].every((criterion) => {
    const item = value?.[criterion];

    if (
      !item ||
      !Number.isInteger(item.score) ||
      item.score < 0 ||
      item.score > 3 ||
      !Number.isInteger(item.line) ||
      item.line < 1 ||
      !item.quote ||
      !item.reason
    )
      return false;
    const lines = sources[item.file]?.split(/\r?\n/);

    return lines
      ?.slice(item.line - 1, item.line + item.quote.split("\n").length - 1)
      .join("\n")
      .includes(item.quote);
  });
}

/** Check the entire requested shell surface, including files the agent left unchanged. */
export function shellBoundary(sources) {
  return !Object.entries(sources).some(
    ([file, text]) => file.includes("/shell/") && /features\/(?:errors|jobs)\/(?!api(?:\.ts)?["'])/.test(text),
  );
}
