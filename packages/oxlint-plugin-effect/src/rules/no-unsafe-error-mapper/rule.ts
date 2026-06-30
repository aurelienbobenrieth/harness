import type { ESTree, Rule } from "@oxlint/plugins";

const message = "Use typed Effect error mapper parameters instead of unknown or any.";

type SourceContext = {
  readonly sourceCode?: { getText: () => string };
  readonly getSourceCode?: () => { getText: () => string };
};
function getSourceText(context: SourceContext): string | undefined {
  return context.sourceCode?.getText() ?? context.getSourceCode?.().getText();
}

const handlerPattern = /\bEffect\.(?:catch|catchAll|catchTag|catchTags|mapError)\s*\(/gu;
const unsafeParamPattern =
  /(?:^|[,(])\s*(?:async\s+)?(?:\([^)]*:\s*(?:unknown|any)\b[^)]*\)|[A-Za-z_$][\w$]*\s*:\s*(?:unknown|any)\b)\s*=>/u;

function findUnsafeErrorMappers(source: string): number[] {
  const reports: number[] = [];
  const scannable = maskNonCode(source);
  const helperNames = new Set<string>();
  for (const match of scannable.matchAll(handlerPattern)) {
    const call = readCall(scannable, match.index + match[0].length - 1);
    if (call === undefined) continue;
    if (unsafeParamPattern.test(call.content)) reports.push(match.index);
    for (const helper of readIdentifierArguments(call.content)) helperNames.add(helper);
  }
  for (const helper of helperNames) {
    const index = findUnsafeHelperDeclaration(scannable, helper);
    if (index !== undefined) reports.push(index);
  }
  return [...new Set(reports)];
}

function readCall(source: string, start: number): { readonly content: string } | undefined {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const character = source.charAt(index);
    if (character === "(") {
      depth += 1;
      continue;
    }
    if (character !== ")") continue;
    depth -= 1;
    if (depth === 0) return { content: source.slice(start + 1, index) };
  }
  return undefined;
}

function readIdentifierArguments(source: string): string[] {
  return splitTopLevelArguments(source)
    .map((arg) => arg.trim())
    .filter((arg) => /^[A-Za-z_$][\w$]*$/u.test(arg));
}

function splitTopLevelArguments(source: string): string[] {
  const parts: string[] = [];
  let angle = 0,
    square = 0,
    paren = 0,
    brace = 0,
    start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const c = source.charAt(index);
    if (c === "<") {
      angle += 1;
      continue;
    }
    if (c === ">") {
      angle -= 1;
      continue;
    }
    if (c === "(") {
      paren += 1;
      continue;
    }
    if (c === ")") {
      paren -= 1;
      continue;
    }
    if (c === "[") {
      square += 1;
      continue;
    }
    if (c === "]") {
      square -= 1;
      continue;
    }
    if (c === "{") {
      brace += 1;
      continue;
    }
    if (c === "}") {
      brace -= 1;
      continue;
    }
    if (c !== "," || angle !== 0 || square !== 0 || paren !== 0 || brace !== 0) continue;
    parts.push(source.slice(start, index));
    start = index + 1;
  }
  parts.push(source.slice(start));
  return parts;
}

function findUnsafeHelperDeclaration(source: string, helperName: string): number | undefined {
  const escaped = helperName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const patterns = [
    new RegExp(
      `\\b(?:const|let|var)\\s+${escaped}\\s*=\\s*(?:async\\s+)?(?:<[^=]*>\\s*)?\\([^)]*:\\s*(?:unknown|any)\\b[^)]*\\)\\s*=>`,
      "u",
    ),
    new RegExp(`\\bfunction\\s+${escaped}\\s*(?:<[^>]*>\\s*)?\\([^)]*:\\s*(?:unknown|any)\\b[^)]*\\)`, "u"),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(source);
    if (match?.index !== undefined) return match.index;
  }
  return undefined;
}

function maskNonCode(source: string): string {
  let masked = "";
  let state: "block" | "code" | "double" | "line" | "single" | "template" = "code";
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const c = source.charAt(index);
    const next = source.charAt(index + 1);
    if (state === "code") {
      if (c === "/" && next === "/") {
        masked += "  ";
        index += 1;
        state = "line";
        continue;
      }
      if (c === "/" && next === "*") {
        masked += "  ";
        index += 1;
        state = "block";
        continue;
      }
      if (c === '"') {
        masked += " ";
        state = "double";
        continue;
      }
      if (c === "'") {
        masked += " ";
        state = "single";
        continue;
      }
      if (c === "`") {
        masked += " ";
        state = "template";
        continue;
      }
      masked += c;
      continue;
    }
    if (state === "line") {
      if (c === "\n" || c === "\r") {
        masked += c;
        state = "code";
      } else masked += " ";
      continue;
    }
    if (state === "block") {
      if (c === "*" && next === "/") {
        masked += "  ";
        index += 1;
        state = "code";
      } else masked += c === "\n" || c === "\r" ? c : " ";
      continue;
    }
    if (escaped) {
      masked += c === "\n" || c === "\r" ? c : " ";
      escaped = false;
      continue;
    }
    if (c === "\\") {
      masked += " ";
      escaped = true;
      continue;
    }
    if ((state === "double" && c === '"') || (state === "single" && c === "'") || (state === "template" && c === "`")) {
      masked += " ";
      state = "code";
      continue;
    }
    masked += c === "\n" || c === "\r" ? c : " ";
  }
  return masked;
}

export const noUnsafeErrorMapper: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Disallow unknown and any in Effect error mapper parameters." },
    messages: { unsafeMapper: message },
  },
  createOnce(context) {
    return {
      Program(node: ESTree.Node) {
        const source = getSourceText(context as SourceContext);
        if (source === undefined) return;
        findUnsafeErrorMappers(source).forEach(() => context.report({ node, messageId: "unsafeMapper" }));
      },
    };
  },
};
