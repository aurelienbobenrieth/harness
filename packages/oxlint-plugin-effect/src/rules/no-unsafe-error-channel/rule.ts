import type { ESTree, Rule } from "@oxlint/plugins";

const message = "Use a typed Effect error channel instead of unknown or any.";

type SourceContext = {
  readonly sourceCode?: { getText: () => string };
  readonly getSourceCode?: () => { getText: () => string };
};

function getSourceText(context: SourceContext): string | undefined {
  return context.sourceCode?.getText() ?? context.getSourceCode?.().getText();
}

function findUnsafeEffectErrorChannels(source: string): readonly number[] {
  const reports: number[] = [];
  const scannableSource = maskNonCode(source);
  const pattern = /\bEffect\.Effect\s*</gu;

  for (const match of scannableSource.matchAll(pattern)) {
    const typeArgumentsStart = match.index + match[0].length - 1;
    const typeArguments = readAngleBracketContent(scannableSource, typeArgumentsStart);

    if (typeArguments === undefined) continue;

    const errorType = splitTopLevelTypeArguments(typeArguments.content)[1]?.trim();
    if (errorType !== "unknown" && errorType !== "any") continue;

    reports.push(match.index);
  }

  return reports;
}

function readAngleBracketContent(source: string, start: number): { readonly content: string } | undefined {
  let depth = 0;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];

    if (character === "<") {
      depth += 1;
      continue;
    }

    if (character !== ">") continue;

    depth -= 1;

    if (depth === 0) {
      return {
        content: source.slice(start + 1, index),
      };
    }
  }

  return undefined;
}

function splitTopLevelTypeArguments(source: string): readonly string[] {
  const parts: string[] = [];
  let angleDepth = 0;
  let braceDepth = 0;
  let parenDepth = 0;
  let squareDepth = 0;
  let start = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (character === "<") {
      angleDepth += 1;
      continue;
    }

    if (character === ">") {
      angleDepth -= 1;
      continue;
    }

    if (character === "{") {
      braceDepth += 1;
      continue;
    }

    if (character === "}") {
      braceDepth -= 1;
      continue;
    }

    if (character === "(") {
      parenDepth += 1;
      continue;
    }

    if (character === ")") {
      parenDepth -= 1;
      continue;
    }

    if (character === "[") {
      squareDepth += 1;
      continue;
    }

    if (character === "]") {
      squareDepth -= 1;
      continue;
    }

    if (character !== "," || angleDepth !== 0 || braceDepth !== 0 || parenDepth !== 0 || squareDepth !== 0) {
      continue;
    }

    parts.push(source.slice(start, index));
    start = index + 1;
  }

  parts.push(source.slice(start));

  return parts;
}

function maskNonCode(source: string): string {
  let masked = "";
  let state: "blockComment" | "code" | "doubleQuote" | "lineComment" | "singleQuote" | "template" = "code";
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source.charAt(index);
    const next = source[index + 1];

    if (state === "code") {
      if (character === "/" && next === "/") {
        masked += "  ";
        index += 1;
        state = "lineComment";
        continue;
      }

      if (character === "/" && next === "*") {
        masked += "  ";
        index += 1;
        state = "blockComment";
        continue;
      }

      if (character === '"') {
        masked += " ";
        state = "doubleQuote";
        continue;
      }

      if (character === "'") {
        masked += " ";
        state = "singleQuote";
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

    if (state === "lineComment") {
      if (isLineBreak(character)) {
        masked += character;
        state = "code";
        continue;
      }

      masked += " ";
      continue;
    }

    if (state === "blockComment") {
      if (character === "*" && next === "/") {
        masked += "  ";
        index += 1;
        state = "code";
        continue;
      }

      masked += isLineBreak(character) ? character : " ";
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
      (state === "doubleQuote" && character === '"') ||
      (state === "singleQuote" && character === "'") ||
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

export const noUnsafeErrorChannel: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow unknown and any as the Effect error channel.",
    },
    messages: {
      typedErrorChannel: message,
    },
  },
  createOnce(context) {
    return {
      Program(node: ESTree.Node) {
        const source = getSourceText(context as SourceContext);
        if (source === undefined) return;

        findUnsafeEffectErrorChannels(source).forEach(() => {
          context.report({
            node,
            messageId: "typedErrorChannel",
          });
        });
      },
    };
  },
};
