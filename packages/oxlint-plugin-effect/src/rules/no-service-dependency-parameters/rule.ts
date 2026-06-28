import type { ESTree, Rule } from "@oxlint/plugins";

const message = "Yield Effect services from context instead of passing service instances through parameters.";
const serviceParameterPattern =
  /(?:readonly\s+)?[A-Za-z_$][\w$]*\??:\s*(?:[A-Z][\w$]*(?:Service|Repo|Repository|Store|Client|Gateway|Config)|[A-Z][\w$]*(?:\[\s*"Service"\s*\]|\.\s*Service)|Context\.Tag\.Service\s*<\s*typeof\s+[A-Z][\w$]*\s*>)/u;

type SourceContext = {
  readonly sourceCode?: { getText: () => string };
  readonly getSourceCode?: () => { getText: () => string };
};
function getSourceText(context: SourceContext): string | undefined {
  return context.sourceCode?.getText() ?? context.getSourceCode?.().getText();
}
function hasServiceDependencyParameter(source: string): boolean {
  return maskNonCode(source)
    .split(/\r\n|\n|\r/u)
    .some((line) => serviceParameterPattern.test(line));
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
export const noServiceDependencyParameters: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Require Effect services to be yielded from context instead of passed as parameters." },
    messages: { noServiceParameter: message },
  },
  createOnce(context) {
    return {
      Program(node: ESTree.Node) {
        const source = getSourceText(context as SourceContext);
        if (source === undefined || !hasServiceDependencyParameter(source)) return;
        context.report({ node, messageId: "noServiceParameter" });
      },
    };
  },
};
