import { defineRule, type AgentlintRule } from "@aurelienbbn/agentlint";

export type PrimitiveDocOptions = {
  /** Files whose LiquidDoc quality is reviewed. Default: snippets. */
  readonly filePattern?: RegExp;
};

const defaultFilePattern = /^snippets\/[^/]+\.liquid$/;
const docPattern = /{%-?\s*doc\s*-?%}([\s\S]*?){%-?\s*enddoc\s*-?%}/;

export function definePrimitiveDoc(options: PrimitiveDocOptions = {}): AgentlintRule {
  const filePattern = options.filePattern ?? defaultFilePattern;

  return defineRule({
    id: "shopify-theme/primitive-doc",
    description: "Reviews LiquidDoc quality: valid @example usage and documented composition.",
    guidance: {
      standard:
        "LiquidDoc is the API reference for primitives: agents and docs generation consume it. A good header states what the primitive renders, documents every @param, and shows at least one copy-pasteable @example of real composition.",
      checks: [
        "The @example renders the snippet with realistic parameters, not placeholders.",
        "Composition constraints (what may wrap or slot into this primitive) are stated.",
        "Generated or trivial single-purpose snippets may accept the finding as not applicable.",
      ],
    },
    createOnce(context) {
      return {
        before(filename) {
          if (!filePattern.test(filename.replaceAll("\\", "/"))) return false;
          return undefined;
        },
        Document(node) {
          const source = context.getSourceCode();
          const documentation = docPattern.exec(source)?.[1];
          if (documentation === undefined) return; // conformance liquiddoc-required owns absence
          if (documentation.includes("@example")) return;
          context.report({
            node,
            message: "LiquidDoc header has no @example: document how this primitive composes.",
          });
        },
      };
    },
  });
}

export const primitiveDoc = definePrimitiveDoc();
