import type { ESTree, Rule } from "@oxlint/plugins";

const message = "Exported functions should return named contracts instead of anonymous object shapes.";

type SourceContext = {
  readonly sourceCode?: { getText: () => string };
  readonly getSourceCode?: () => { getText: () => string };
};

function getSourceText(context: SourceContext): string | undefined {
  return context.sourceCode?.getText() ?? context.getSourceCode?.().getText();
}

function hasExportedAnonymousObjectReturn(source: string): boolean {
  const masked = maskNonCode(source);

  return hasExportedFunctionAnonymousObjectReturn(masked) || hasExportedArrowAnonymousObjectReturn(masked);
}

function hasExportedFunctionAnonymousObjectReturn(source: string): boolean {
  if (/\bexport\s+function\s+\w+\s*\([^)]*\)\s*:\s*\{/u.test(source)) return true;

  const functionPattern = /\bexport\s+function\s+\w+\s*\([^)]*\)/gu;

  for (const match of source.matchAll(functionPattern)) {
    const signatureEnd = match.index + match[0].length;
    const bodyOpenBrace = source.indexOf("{", signatureEnd);
    if (bodyOpenBrace === -1) continue;

    const signatureTail = source.slice(signatureEnd, bodyOpenBrace);
    if (/^\s*:\s*\{/u.test(signatureTail)) return true;
    if (/^\s*:/u.test(signatureTail)) continue;

    const bodyCloseBrace = findMatchingCharacter(source, bodyOpenBrace, "{", "}");
    if (bodyCloseBrace === undefined) continue;
    if (/\breturn\s*\{/u.test(source.slice(bodyOpenBrace + 1, bodyCloseBrace))) return true;
  }

  return false;
}

function hasExportedArrowAnonymousObjectReturn(source: string): boolean {
  const arrowPattern = /\bexport\s+const\s+\w+\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)/gu;

  for (const match of source.matchAll(arrowPattern)) {
    const signatureStart = match.index + match[0].length;
    const arrowIndex = source.indexOf("=>", signatureStart);
    if (arrowIndex === -1) continue;

    const signatureTail = source.slice(signatureStart, arrowIndex);
    if (/:\s*\{/u.test(signatureTail)) return true;
    if (/:\s*/u.test(signatureTail)) continue;

    const bodyStart = arrowIndex + 2;
    const bodyPrefix = source.slice(bodyStart).trimStart();
    if (bodyPrefix.startsWith("({") || bodyPrefix.startsWith("{")) {
      if (bodyPrefix.startsWith("({")) return true;

      const bodyOpenBrace = source.indexOf("{", bodyStart);
      if (bodyOpenBrace === -1) continue;

      const bodyCloseBrace = findMatchingCharacter(source, bodyOpenBrace, "{", "}");
      if (bodyCloseBrace === undefined) continue;
      if (/\breturn\s*\{/u.test(source.slice(bodyOpenBrace + 1, bodyCloseBrace))) return true;
    }
  }

  return false;
}

function findMatchingCharacter(
  source: string,
  start: number,
  openCharacter: string,
  closeCharacter: string,
): number | undefined {
  let depth = 0;

  for (let index = start; index < source.length; index += 1) {
    const character = source.charAt(index);

    if (character === openCharacter) {
      depth += 1;
      continue;
    }

    if (character !== closeCharacter) continue;

    depth -= 1;
    if (depth === 0) return index;
  }

  return undefined;
}

function maskNonCode(source: string): string {
  let masked = "";
  let state: "block" | "code" | "double" | "line" | "single" | "template" = "code";
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source.charAt(index);
    const next = source.charAt(index + 1);

    if (state === "code") {
      if (character === "/" && next === "/") {
        masked += "  ";
        index += 1;
        state = "line";
        continue;
      }
      if (character === "/" && next === "*") {
        masked += "  ";
        index += 1;
        state = "block";
        continue;
      }
      if (character === '"') {
        masked += " ";
        state = "double";
        continue;
      }
      if (character === "'") {
        masked += " ";
        state = "single";
        continue;
      }
      if (character === "`") {
        masked += " ";
        state = "template";
        continue;
      }
      masked += character;
      continue;
    }

    if (state === "line") {
      if (isLineBreak(character)) {
        masked += character;
        state = "code";
      } else {
        masked += " ";
      }
      continue;
    }

    if (state === "block") {
      if (character === "*" && next === "/") {
        masked += "  ";
        index += 1;
        state = "code";
      } else {
        masked += isLineBreak(character) ? character : " ";
      }
      continue;
    }

    if (escaped) {
      masked += isLineBreak(character) ? character : " ";
      escaped = false;
      continue;
    }

    if (character === "\\") {
      masked += " ";
      escaped = true;
      continue;
    }

    if (
      (state === "double" && character === '"') ||
      (state === "single" && character === "'") ||
      (state === "template" && character === "`")
    ) {
      masked += " ";
      state = "code";
      continue;
    }

    masked += isLineBreak(character) ? character : " ";
  }

  return masked;
}

function isLineBreak(character: string): boolean {
  return character === "\n" || character === "\r";
}

export const noExportedAnonymousObjectReturn: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require exported functions to return named contracts instead of anonymous object shapes.",
    },
    messages: {
      noAnonymousObjectReturn: message,
    },
  },
  createOnce(context) {
    return {
      Program(node: ESTree.Node) {
        const source = getSourceText(context as SourceContext);
        if (source === undefined || !hasExportedAnonymousObjectReturn(source)) return;

        context.report({ node, messageId: "noAnonymousObjectReturn" });
      },
    };
  },
};
