/**
 * @attribution "Test Logic in Production" (G. Meszaros, xUnit Test Patterns) (concept)
 */
import type { ESTree, Rule } from "@oxlint/plugins";
import { unwrapExpression } from "../ast-support.js";
import { getFilename, isTestSupportFile, type RuleContextWithFilename } from "../filename-support.js";

const testRunnerVariables = new Set(["VITEST", "VITEST_WORKER_ID", "JEST_WORKER_ID"]);
const testOnlyExportPattern = /^(?:__test(?:s|ing)?__|_internals?|internals|testOnly\w*|\w+ForTest(?:s|ing)?)$/u;
const testOnlyCommentPattern = /(?:exported?|visible|public) (?:only )?for (?:unit )?test(?:s|ing)?/iu;
const equalityOperators = new Set(["==", "===", "!=", "!=="]);

function propertyName(node: ESTree.MemberExpression): string | undefined {
  if (!node.computed) return node.property.type === "Identifier" ? node.property.name : undefined;
  return node.property.type === "Literal" && typeof node.property.value === "string" ? node.property.value : undefined;
}

/** Renders `process.env.NODE_ENV`, `import.meta.env.MODE` and their quoted-key spellings as a dotted path. */
function memberPath(node: ESTree.Node): string | undefined {
  const value = unwrapExpression(node);
  if (value.type === "Identifier") return value.name;
  if (value.type === "MetaProperty") return `${value.meta.name}.${value.property.name}`;
  if (value.type !== "MemberExpression") return undefined;
  const object = memberPath(value.object);
  const property = propertyName(value);
  return object === undefined || property === undefined ? undefined : `${object}.${property}`;
}

function isTestLiteral(node: ESTree.Node): boolean {
  const value = unwrapExpression(node);
  return value.type === "Literal" && value.value === "test";
}

function isModeRead(node: ESTree.Node): boolean {
  const path = memberPath(node);
  return path === "process.env.NODE_ENV" || path === "import.meta.env.MODE";
}

function exportedNames(node: ESTree.ExportNamedDeclaration): { readonly name: string; readonly node: ESTree.Node }[] {
  const declaration = node.declaration;
  if (declaration === null) {
    if (node.exportKind === "type") return [];
    return node.specifiers.flatMap((specifier) =>
      specifier.exportKind === "type"
        ? []
        : [
            {
              name:
                specifier.exported.type === "Identifier" ? specifier.exported.name : String(specifier.exported.value),
              node: specifier,
            },
          ],
    );
  }
  if (declaration.type === "VariableDeclaration") {
    return declaration.declarations.flatMap((declarator) =>
      declarator.id.type === "Identifier" ? [{ name: declarator.id.name, node: declarator.id }] : [],
    );
  }
  if (declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration") {
    return declaration.id === null ? [] : [{ name: declaration.id.name, node: declaration.id }];
  }
  return [];
}

export const noTestLogicInProduction: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow production files from branching on a test runner or test mode and from exporting members named or commented as existing only for tests.",
    },
    messages: {
      testModeBranch:
        'Comparing {{path}} with "test" makes production code behave differently under test, so the tests exercise a path users never run. Inject the differing dependency or configuration value from the caller.',
      testRunnerProbe:
        "Reading {{path}} lets production code detect the test runner, so the tests exercise a path users never run. Inject the differing dependency or configuration value from the caller.",
      testOnlyExport:
        'The export "{{name}}" exists for tests only, which widens the module contract for code no consumer calls. Test through the public API, or move the logic into its own module with a real contract.',
      testOnlyExportComment:
        "This export is documented as existing for tests only, which widens the module contract for code no consumer calls. Test through the public API, or move the logic into its own module with a real contract.",
    },
  },
  create(context) {
    if (isTestSupportFile(getFilename(context as RuleContextWithFilename))) return {};

    return {
      BinaryExpression(node) {
        if (!equalityOperators.has(node.operator)) return;
        const mode = [node.left, node.right].find((side) => isModeRead(side));
        if (mode === undefined || ![node.left, node.right].some((side) => isTestLiteral(side))) return;
        context.report({ node, messageId: "testModeBranch", data: { path: memberPath(mode) ?? "the mode" } });
      },
      MemberExpression(node) {
        const path = memberPath(node);
        if (path === undefined) return;
        const isRunnerVariable =
          path.startsWith("process.env.") && testRunnerVariables.has(path.slice("process.env.".length));
        if (!isRunnerVariable && path !== "import.meta.vitest") return;
        context.report({ node, messageId: "testRunnerProbe", data: { path } });
      },
      ExportNamedDeclaration(node) {
        const names = exportedNames(node);
        const testOnly = names.filter((entry) => testOnlyExportPattern.test(entry.name));
        for (const entry of testOnly) {
          context.report({ node: entry.node, messageId: "testOnlyExport", data: { name: entry.name } });
        }
        if (testOnly.length > 0 || names.length === 0) return;
        const comment = context.sourceCode.getCommentsBefore(node).at(-1);
        if (comment !== undefined && testOnlyCommentPattern.test(comment.value)) {
          context.report({ node, messageId: "testOnlyExportComment" });
        }
      },
    };
  },
};
