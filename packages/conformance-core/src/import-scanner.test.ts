import { expect, it } from "vitest";
import { scanImports } from "./import-scanner.js";

it("reads static, side-effect, dynamic, require and re-export specifiers", () => {
  const text = [
    `import a from "alpha";`,
    `import type { B } from 'beta/sub';`,
    `import * as c, { d } from "gamma";`,
    `import "side-effect";`,
    `export * from "delta";`,
    `export * as e from "epsilon";`,
    `export type { F } from "zeta";`,
    `const g = await import("eta");`,
    `const h = require("theta");`,
    `import i = require("iota");`,
  ].join("\n");
  expect(scanImports(text)).toEqual([
    "alpha",
    "beta/sub",
    "gamma",
    "side-effect",
    "delta",
    "epsilon",
    "zeta",
    "eta",
    "theta",
    "iota",
  ]);
});

it("ignores imports in comments, strings, templates and regular expressions", () => {
  const text = [
    `// import "line-comment";`,
    `/* import x from "block-comment"; */`,
    `const s = 'import y from "in-string"';`,
    'const t = `import z from "in-template"`;',
    `const r = /import "in-regex"/;`,
    `export { local };`,
    `const u = obj.import("member-call");`,
    `import.meta.env;`,
    `import real from "real";`,
  ].join("\n");
  expect(scanImports(text)).toEqual(["real"]);
});

it("does not let an apostrophe in JSX text swallow later imports", () => {
  const text = `const a = <p>don't</p>;\nimport x from "after";`;
  expect(scanImports(text)).toEqual(["after"]);
});
