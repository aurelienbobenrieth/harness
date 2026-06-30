import type { Rule } from "@oxlint/plugins";

const orderMessage = "Yield Effect service dependencies before runtime logic.";
const spacingMessage = "Place exactly one blank line between dependency yields and runtime logic.";

type SourceContext = {
  readonly sourceCode?: { getText: () => string };
  readonly getSourceCode?: () => { getText: () => string };
};

type EffectBody = {
  readonly body: string;
};

type DependencyIssue = "order" | "spacing";

function getSourceText(context: SourceContext): string | undefined {
  return context.sourceCode?.getText() ?? context.getSourceCode?.().getText();
}

function findDependencyIssues(source: string): readonly DependencyIssue[] {
  return findEffectGeneratorBodies(source).flatMap((body) => analyzeBody(body.body));
}

function findEffectGeneratorBodies(source: string): readonly EffectBody[] {
  const bodies: EffectBody[] = [];
  const callPattern = /\bEffect\.(?:gen|fn)\s*\(/gu;

  for (const match of source.matchAll(callPattern)) {
    const callOpenParen = match.index + match[0].length - 1;
    const callCloseParen = findMatchingCharacter(source, callOpenParen, "(", ")");
    if (callCloseParen === undefined) continue;

    const callSource = source.slice(callOpenParen + 1, callCloseParen);
    const generatorMatch = /function\s*\*/u.exec(callSource);
    if (generatorMatch === null) continue;

    const bodyOpenBrace = source.indexOf("{", callOpenParen + 1 + generatorMatch.index);
    if (bodyOpenBrace === -1 || bodyOpenBrace > callCloseParen) continue;

    const bodyCloseBrace = findMatchingCharacter(source, bodyOpenBrace, "{", "}");
    if (bodyCloseBrace === undefined || bodyCloseBrace > callCloseParen) continue;

    bodies.push({
      body: source.slice(bodyOpenBrace + 1, bodyCloseBrace),
    });
  }

  return bodies;
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

function analyzeBody(body: string): readonly DependencyIssue[] {
  const issues = new Set<DependencyIssue>();
  const lines = body.split(/\r?\n/u);
  let depth = 0;
  let hasDependencyBlock = false;
  let lastDependencyLine = -1;
  let seenLogic = false;
  let checkedSpacing = false;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const startsAtTopLevel = depth === 0;

    if (startsAtTopLevel && trimmed.length > 0 && !trimmed.startsWith("//")) {
      const isDependency = isDependencyYieldLine(trimmed);

      if (isDependency) {
        if (seenLogic) issues.add("order");
        if (!seenLogic) {
          hasDependencyBlock = true;
          lastDependencyLine = index;
        }
      } else {
        if (hasDependencyBlock && !checkedSpacing) {
          checkedSpacing = true;
          if (index - lastDependencyLine - 1 !== 1) issues.add("spacing");
        }

        seenLogic = true;
      }
    }

    depth = updateDepth(depth, line);
  });

  return [...issues];
}

function isDependencyYieldLine(line: string): boolean {
  return /^const\s+[A-Za-z_$][\w$]*\s*=\s*yield\*\s*(?:[A-Z][\w$]*|Effect\.service\(\s*[A-Z][\w$]*\s*\))\s*;?$/u.test(
    line,
  );
}

function updateDepth(currentDepth: number, line: string): number {
  let depth = currentDepth;

  for (let index = 0; index < line.length; index += 1) {
    const character = line.charAt(index);

    if (character === "{" || character === "(" || character === "[") {
      depth += 1;
      continue;
    }

    if (character === "}" || character === ")" || character === "]") {
      depth = Math.max(0, depth - 1);
    }
  }

  return depth;
}

export const dependenciesFirst: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Require Effect service dependency yields before runtime logic.",
    },
    messages: {
      dependenciesFirst: orderMessage,
      dependencySpacing: spacingMessage,
    },
  },
  createOnce(context) {
    return {
      Program(node) {
        const source = getSourceText(context as SourceContext);
        if (source === undefined) return;

        findDependencyIssues(source).forEach((issue) => {
          context.report({
            node,
            messageId: issue === "order" ? "dependenciesFirst" : "dependencySpacing",
          });
        });
      },
    };
  },
};
