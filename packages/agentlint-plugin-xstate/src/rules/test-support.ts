import type { StateRule, Visitors } from "@aurelienbbn/agentlint";
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
    path: filename,
    absolutePath: filename,
    source: options.sourceCode ?? "",
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

/** Judge checklist of a rule, empty when the standard carries plain-string guidance. */
export function guidanceChecks(rule: StateRule): ReadonlyArray<string> {
  const guidance = rule.standard.guidance;
  return typeof guidance === "object" ? (guidance.checks ?? []) : [];
}
