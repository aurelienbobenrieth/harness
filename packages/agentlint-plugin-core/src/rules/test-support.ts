import type { StateRule, Visitors } from "@aurelienbbn/agentlint";
import type { AgentlintNode, RuleContext } from "@aurelienbbn/agentlint";

export function createNode(type: string, text: string, row = 0): AgentlintNode {
  return {
    type,
    text,
    startPosition: { row, column: 0 },
    endPosition: { row, column: text.length },
    isNamed: true,
    children: [],
    parent: null,
    childCount: 0,
    childByFieldName: () => null,
    childrenByType: () => [],
    descendantsOfType: () => [],
  };
}

export type TestRuleContext = RuleContext & { readonly messages: string[] };

export function createContext(
  options: {
    readonly filename?: string;
    readonly sourceCode?: string;
    readonly linesAround?: (line: number, radius?: number) => string;
  } = {},
): TestRuleContext {
  const messages: string[] = [];
  const filename = options.filename ?? "src/module.ts";

  return {
    messages,
    path: filename,
    absolutePath: filename,
    source:
      options.sourceCode ??
      (options.linesAround
        ? Array.from({ length: 100 }, (_, row) => options.linesAround?.(row + 1) ?? "").join("\n")
        : ""),
    dependencies: {},
    report: (reported) => {
      messages.push(reported.message);
    },
  };
}

export function createVisitors(rule: StateRule, context: RuleContext): Visitors {
  const create = rule.detector.createOnce;
  if (!create) throw new Error("Expected an imperative state detector");
  return create({ context, options: rule.binding.options });
}
