/**
 * Flags test files that load nothing from the project they belong to.
 *
 * Files that drive the project from outside (child process, filesystem, HTTP, browser) are black-box tests and
 * stay silent, as do type-test files (`*.test-d.ts`).
 */
import { defineRule, type StateRule } from "@aurelienbbn/agentlint";
import {
  isTestCall,
  matches,
  moduleSpecifiers,
  serializePattern,
  sourceFileGlobs,
  testFilePattern,
} from "../judgment-support.js";

const defaultProjectImportPattern = /^(?:@\/|~\/|#)/;
const defaultBlackBoxModules = [
  "node:child_process",
  "child_process",
  "execa",
  "node:fs",
  "fs",
  "node:fs/promises",
  "@playwright/test",
  "supertest",
  "undici",
];

const relativeSpecifierPattern = /^\.{1,2}(?:\/|$)/;

const message =
  "Test file imports nothing from the project, so it exercises a copy or a third-party library; import the real subject, or label the test as a black-box or learning test.";

export type TestExercisesProjectCodeOptions = {
  /** Pattern matching non-relative specifiers that resolve into the project (path aliases, subpath imports). */
  readonly projectImportPattern?: RegExp;
  /** Package names that belong to the project: workspace packages and the package's own name. */
  readonly workspacePackages?: readonly string[];
  /** Modules whose presence marks a black-box test. Providing this REPLACES the built-in list. */
  readonly blackBoxModules?: readonly string[];
};

export function defineTestExercisesProjectCode(options: TestExercisesProjectCodeOptions = {}): StateRule {
  options = structuredClone(options);
  const projectImportPattern = options.projectImportPattern ?? defaultProjectImportPattern;
  const workspacePackages = options.workspacePackages ?? [];
  const blackBoxModules = new Set(options.blackBoxModules ?? defaultBlackBoxModules);

  const reachesProject = (specifier: string): boolean =>
    relativeSpecifierPattern.test(specifier) ||
    matches(projectImportPattern, specifier) ||
    workspacePackages.some((name) => specifier === name || specifier.startsWith(`${name}/`));

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "core/test-exercises-project-code",
      revision: 1,
      title: "Test Exercises Project Code",
      summary:
        "Flags test files that import nothing from the project, so the code they exercise is a copy or a third-party library.",
      guidance: {
        standard:
          "A test protects a decision the project made, and it reaches that decision through the module that holds it. A subject re-declared inside the test file keeps passing while production diverges; a test of the language or of a dependency protects nothing the project owns.",
        checks: [
          "Name the production module under test. Fails when the subject is declared inside the test file: production can diverge while this stays green. Import the real subject and delete the copy.",
          "Fails when the test only exercises a third-party library or the language and protects no project decision.",
          "Passes for a deliberate black-box test, or a learning or contract test of a dependency, labelled as such in its title.",
          "Passes when the project is reached through a package self-import or alias the detector does not know; record it in `workspacePackages`.",
        ],
        examples: [
          {
            label: "FAIL",
            description: "The function under test is a copy living in the test file.",
            code: 'import { expect, it } from "vitest";\n\nfunction slugify(title: string) { return title.toLowerCase().replaceAll(" ", "-"); }\n\nit("slugifies", () => { expect(slugify("Hello World")).toBe("hello-world"); });',
          },
          {
            label: "PASS",
            description: "The production function is the subject.",
            code: 'import { expect, it } from "vitest";\nimport { slugify } from "./slugify.js";\n\nit("slugifies", () => { expect(slugify("Hello World")).toBe("hello-world"); });',
          },
        ],
        refs: [
          { type: "skill", id: "testing" },
          { type: "url", href: "https://martinfowler.com/articles/practical-test-pyramid.html" },
          { type: "url", href: "https://martinfowler.com/bliki/AssertionFreeTesting.html" },
          { type: "url", href: "https://arxiv.org/html/2410.10628" },
        ],
      },
    },
    binding: {
      id: "core/test-exercises-project-code",
      authority: "agent",
      include: [...sourceFileGlobs],
      exclude: ["**/*.d.ts", "**/*.test-d.ts"],
      options: {
        projectImportPattern: serializePattern(options.projectImportPattern),
        workspacePackages: options.workspacePackages ? [...options.workspacePackages] : null,
        blackBoxModules: options.blackBoxModules ? [...options.blackBoxModules] : null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            file: "src/slugify.test.ts",
            source:
              'import { expect, it } from "vitest";\nconst slugify = (title: string) => title.toLowerCase();\nit("slugifies", () => { expect(slugify("A")).toBe("a"); });',
          },
        ],
        mustStaySilent: [
          {
            file: "src/slugify.test.ts",
            source:
              'import { expect, it } from "vitest";\nimport { slugify } from "./slugify.js";\nit("slugifies", () => { expect(slugify("A")).toBe("a"); });',
          },
          {
            file: "src/cli.test.ts",
            source:
              'import { expect, it } from "vitest";\nimport { run } from "@/cli";\nit("runs", () => { expect(run()).toBe(0); });',
          },
        ],
      },
      id: "core/test-exercises-project-code",
      version: 1,
      scan: "file",
      createOnce(context) {
        return {
          program(root) {
            if (!testFilePattern.test(context.path)) return;
            const calls = root.descendantsOfType("call_expression");
            const firstTest = calls.find(isTestCall);
            if (!firstTest) return;
            const specifiers = moduleSpecifiers(root);
            if (specifiers.some((specifier) => reachesProject(specifier) || blackBoxModules.has(specifier))) return;
            if (calls.some((call) => call.childByFieldName("function")?.text === "fetch")) return;
            context.report({
              node: firstTest,
              message,
              evidence: { imports: [...new Set(specifiers)].toSorted() },
            });
          },
        };
      },
    },
  });
}

export const testExercisesProjectCode = defineTestExercisesProjectCode();
