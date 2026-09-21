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

/** Builds a grammar-shaped node with parent links for focused visitor tests. */
export function createTreeNode(
  type: string,
  text: string,
  children: AgentlintNode[] = [],
  fields: Record<string, AgentlintNode> = {},
): AgentlintNode {
  const node: AgentlintNode = {
    ...createNode(type, text),
    children,
    childCount: children.length,
    childByFieldName: (name) => fields[name] ?? null,
    childrenByType: (name) => children.filter((child) => child.type === name),
    descendantsOfType: (name) =>
      children.flatMap((child) => [...(child.type === name ? [child] : []), ...child.descendantsOfType(name)]),
  };
  for (const child of children) Object.assign(child, { parent: node });
  return node;
}

/** Creates opening/self-closing JSX with raw attribute values, such as '"critical"' or '{error}'. */
export function createJsxOpening(
  name: string,
  attributes: Record<string, string | true> = {},
  selfClosing = false,
): AgentlintNode {
  const nameNode = createNode("identifier", name);
  const children = [
    nameNode,
    ...Object.entries(attributes).map(([key, value]) => {
      const keyNode = createNode("property_identifier", key);
      if (value === true) return createTreeNode("jsx_attribute", key, [keyNode]);
      let valueNode: AgentlintNode;
      if (value.startsWith("{")) {
        const inner = value.slice(1, -1);
        const type = /^(?:true|false|null|undefined)$/.test(inner)
          ? inner
          : /^["']/.test(inner)
            ? "string"
            : "identifier";
        valueNode = createTreeNode("jsx_expression", value, [createNode(type, inner)]);
      } else {
        valueNode = createNode("string", value);
      }
      return createTreeNode("jsx_attribute", `${key}=${value}`, [keyNode, valueNode]);
    }),
  ];
  const props = Object.entries(attributes)
    .map(([key, value]) => (value === true ? key : `${key}=${value}`))
    .join(" ");
  return createTreeNode(
    selfClosing ? "jsx_self_closing_element" : "jsx_opening_element",
    `<${name}${props ? ` ${props}` : ""}${selfClosing ? "/" : ""}>`,
    children,
    { name: nameNode },
  );
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
