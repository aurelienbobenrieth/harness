import type { AgentlintNode, RuleContext } from "@aurelienbbn/agentlint";

export function createNode(type: string, text: string): AgentlintNode {
  return {
    type,
    text,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: text.length },
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
  options: { readonly filename?: string; readonly sourceCode?: string } = {},
): TestRuleContext {
  const messages: string[] = [];
  const filename = options.filename ?? "src/page.tsx";

  return {
    messages,
    getFilename: () => filename,
    getFilePath: () => filename,
    getSourceCode: () => options.sourceCode ?? "",
    getLinesAround: () => "",
    report: (reported) => {
      messages.push(reported.message);
    },
  };
}
