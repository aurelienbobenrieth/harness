import type { Rule } from "@oxlint/plugins";

const message = "Place the Schema type alias immediately after its schema declaration.";

type SourceContext = {
  readonly sourceCode?: { getText: () => string };
  readonly getSourceCode?: () => { getText: () => string };
};

type SchemaDeclaration = {
  readonly name: string;
  readonly endLine: number;
};

type SchemaTypeAlias = {
  readonly name: string;
  readonly line: number;
};

function getSourceText(context: SourceContext): string | undefined {
  return context.sourceCode?.getText() ?? context.getSourceCode?.().getText();
}

function findSeparatedSchemaTypeAliases(source: string): readonly SchemaTypeAlias[] {
  const lines = source.split(/\r?\n/u);
  const schemaDeclarations = findSchemaDeclarations(lines);
  const typeAliases = findSchemaTypeAliases(lines);

  return typeAliases.filter((typeAlias) => {
    const schemaDeclaration = schemaDeclarations.find(
      (declaration) => declaration.name === typeAlias.name && declaration.endLine < typeAlias.line,
    );

    return schemaDeclaration !== undefined && typeAlias.line !== schemaDeclaration.endLine + 1;
  });
}

function findSchemaDeclarations(lines: readonly string[]): readonly SchemaDeclaration[] {
  const declarations: SchemaDeclaration[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = /^\s*(?:export\s+)?const\s+([A-Z]\w*)\s*=\s*Schema\.\w+\b/u.exec(lines[index] ?? "");
    if (match === null) continue;

    declarations.push({
      name: match[1],
      endLine: findStatementEndLine(lines, index),
    });
  }

  return declarations;
}

function findStatementEndLine(lines: readonly string[], startLine: number): number {
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;

  for (let lineIndex = startLine; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";

    for (let characterIndex = 0; characterIndex < line.length; characterIndex += 1) {
      const character = line.charAt(characterIndex);

      if (character === "(") parenDepth += 1;
      if (character === ")") parenDepth -= 1;
      if (character === "{") braceDepth += 1;
      if (character === "}") braceDepth -= 1;
      if (character === "[") bracketDepth += 1;
      if (character === "]") bracketDepth -= 1;

      if (character !== ";") continue;
      if (parenDepth <= 0 && braceDepth <= 0 && bracketDepth <= 0) return lineIndex;
    }
  }

  return startLine;
}

function findSchemaTypeAliases(lines: readonly string[]): readonly SchemaTypeAlias[] {
  const aliases: SchemaTypeAlias[] = [];

  lines.forEach((line, index) => {
    const match = /^\s*export\s+type\s+([A-Z]\w*)\s*=\s*typeof\s+\1\.(?:Type|Encoded)\s*;?\s*$/u.exec(line);
    if (match === null) return;

    aliases.push({ name: match[1], line: index });
  });

  return aliases;
}

export const schemaTypeAdjacent: Rule = {
  meta: {
    type: "layout",
    docs: {
      description: "Require Effect Schema type aliases to be adjacent to their schema declarations.",
    },
    messages: {
      schemaTypeAdjacent: message,
    },
  },
  createOnce(context) {
    return {
      Program(node) {
        const source = getSourceText(context as SourceContext);
        if (source === undefined) return;

        findSeparatedSchemaTypeAliases(source).forEach(() => {
          context.report({ node, messageId: "schemaTypeAdjacent" });
        });
      },
    };
  },
};
