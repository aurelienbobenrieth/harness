/**
 * @attribution anti-slop by Dillon Mulroy (MIT, concept re-implemented)
 */
import type { ESTree, Rule } from "@oxlint/plugins";

const message =
  'Do not import Effect service constructor "{{name}}" into runtime code. Import the owning Layer and yield the contextual service.';
const constructorNamePattern = /^make[A-Z]/u;
const testFilePattern = /\.(test|spec)\.[cm]?[jt]sx?$/u;

type FilenameContext = {
  readonly filename?: string;
  readonly getFilename?: () => string;
};

function getFilename(context: FilenameContext): string {
  return context.filename ?? context.getFilename?.() ?? "";
}

function isProjectLocalSource(source: string): boolean {
  return (source.startsWith("./") || source.startsWith("../")) && /(?:^|\/)services?\//.test(source);
}

function getImportedName(specifier: ESTree.ImportDeclarationSpecifier): string | undefined {
  if (specifier.type !== "ImportSpecifier") return undefined;

  const imported = specifier.imported;
  if (imported.type === "Identifier") return imported.name;
  return typeof imported.value === "string" ? imported.value : undefined;
}

export const noServiceConstructorImports: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow make-prefixed imports from project service directories into runtime code.",
    },
    schema: [
      {
        type: "object",
        properties: { serviceModules: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    messages: {
      noConstructorImport: message,
    },
  },
  createOnce(context) {
    return {
      ImportDeclaration(node) {
        if (node.importKind === "type") return;
        const options = context.options[0] as { serviceModules?: string[] } | undefined;
        if (
          typeof node.source.value !== "string" ||
          !(options?.serviceModules?.includes(node.source.value) || isProjectLocalSource(node.source.value))
        )
          return;
        if (testFilePattern.test(getFilename(context as FilenameContext))) return;

        node.specifiers.forEach((specifier) => {
          if (specifier.type === "ImportSpecifier" && specifier.importKind === "type") return;
          const name = getImportedName(specifier);
          if (name === undefined || !constructorNamePattern.test(name)) return;

          context.report({
            node: specifier,
            messageId: "noConstructorImport",
            data: { name },
          });
        });
      },
    };
  },
};
