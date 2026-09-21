import type { ESTree, Rule } from "@oxlint/plugins";

const message = "Use one object input instead of multiple positional parameters.";
const defaultExemptFunctionNames: readonly string[] = [];
const defaultExemptFileBasenames: readonly string[] = [];

type ParentNode = ESTree.Node;
type FunctionLike = ParentNode & {
  readonly params?: readonly ESTree.Node[];
  readonly id?: ESTree.Node | null;
};

type RuleOptions = {
  readonly exemptFunctionNames?: readonly string[];
  readonly exemptFileBasenames?: readonly string[];
};

type RuleContextWithOptions = {
  readonly filename?: string;
  readonly getFilename?: () => string;
  readonly options?: readonly unknown[];
};

function getStringArray(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : undefined;
}

function getOptions(context: RuleContextWithOptions): Required<RuleOptions> {
  const candidate = context.options?.[0];
  const options = typeof candidate === "object" && candidate !== null ? (candidate as RuleOptions) : {};

  return {
    exemptFunctionNames: getStringArray(options.exemptFunctionNames) ?? defaultExemptFunctionNames,
    exemptFileBasenames: getStringArray(options.exemptFileBasenames) ?? defaultExemptFileBasenames,
  };
}

function getFileBasename(context: RuleContextWithOptions): string {
  const filename = (context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/");
  return filename.split("/").at(-1) ?? filename;
}

function getDeclaredName(node: FunctionLike): string | undefined {
  if (node.id?.type === "Identifier") return node.id.name;

  const parent = node.parent;
  if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") return parent.id.name;
  if (parent?.type === "Property" && !parent.computed && parent.key.type === "Identifier") return parent.key.name;
  if (
    (parent?.type === "MethodDefinition" || parent?.type === "PropertyDefinition") &&
    !parent.computed &&
    parent.key.type === "Identifier"
  ) {
    return parent.key.name;
  }

  return undefined;
}

function hasMultipleParameters(node: FunctionLike): boolean {
  return (node.params?.length ?? 0) > 1;
}

function shouldReport(node: ParentNode, context: RuleContextWithOptions): node is FunctionLike {
  if (!hasMultipleParameters(node as FunctionLike)) return false;
  if (
    (node.parent?.type === "CallExpression" || node.parent?.type === "NewExpression") &&
    node.parent.arguments.some((argument) => argument === node)
  )
    return false;

  const options = getOptions(context);
  if (options.exemptFileBasenames.includes(getFileBasename(context))) return false;

  const name = getDeclaredName(node as FunctionLike);
  return name === undefined || !options.exemptFunctionNames.includes(name);
}

export const noMultiPositionalParameters: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require object inputs instead of multiple positional parameters for functions.",
    },
    messages: {
      objectInput: message,
    },
    schema: [
      {
        type: "object",
        properties: {
          exemptFunctionNames: {
            type: "array",
            items: { type: "string" },
          },
          exemptFileBasenames: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ exemptFunctionNames: [], exemptFileBasenames: [] }],
  },
  createOnce(context) {
    return {
      ArrowFunctionExpression(node) {
        if (!shouldReport(node, context as RuleContextWithOptions)) return;
        context.report({ node, messageId: "objectInput" });
      },
      FunctionDeclaration(node) {
        if (!shouldReport(node, context as RuleContextWithOptions)) return;
        context.report({ node, messageId: "objectInput" });
      },
      FunctionExpression(node) {
        if (!shouldReport(node, context as RuleContextWithOptions)) return;
        context.report({ node, messageId: "objectInput" });
      },
    };
  },
};
