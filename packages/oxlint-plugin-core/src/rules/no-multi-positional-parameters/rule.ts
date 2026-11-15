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

const wrappers = new Set(["ParenthesizedExpression", "TSNonNullExpression"]);
const typedSites = new Set(["TSSatisfiesExpression", "TSAsExpression", "TSTypeAssertion"]);

// oxlint-disable-next-line typescript/no-explicit-any -- ESTree nodes are walked structurally by key
type AnyNode = { readonly type: string; readonly parent?: AnyNode | null; readonly [key: string]: any };

/** What a name resolves to in this file, judged by hand over the enclosing statement lists. */
type Binding =
  | { readonly kind: "import"; readonly source: string }
  | { readonly kind: "local" }
  | { readonly kind: "opaque" };

/** Specifiers that point into the project itself: relative paths and the common alias prefixes. */
function isProjectSpecifier(source: string): boolean {
  return source.startsWith(".") || source.startsWith("#") || source.startsWith("~") || source.startsWith("@/");
}

function patternNames(pattern: AnyNode | null | undefined): readonly string[] {
  if (pattern === null || pattern === undefined) return [];
  if (pattern.type === "Identifier") return [pattern["name"] as string];
  if (pattern.type === "AssignmentPattern") return patternNames(pattern["left"]);
  if (pattern.type === "RestElement") return patternNames(pattern["argument"]);
  return [];
}

const localShapes = new Set(["ArrowFunctionExpression", "FunctionExpression", "ClassExpression", "ObjectExpression"]);
const localDeclarations = new Set([
  "FunctionDeclaration",
  "TSDeclareFunction",
  "ClassDeclaration",
  "TSTypeAliasDeclaration",
  "TSInterfaceDeclaration",
  "TSEnumDeclaration",
]);

function bindingInStatement(statement: AnyNode, name: string): Binding | undefined {
  if (statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration") {
    const declaration = statement["declaration"] as AnyNode | null | undefined;
    return declaration === null || declaration === undefined ? undefined : bindingInStatement(declaration, name);
  }
  if (statement.type === "ImportDeclaration") {
    const specifiers = (statement["specifiers"] ?? []) as readonly AnyNode[];
    return specifiers.some((specifier) => specifier["local"]?.name === name)
      ? { kind: "import", source: String(statement["source"]?.value) }
      : undefined;
  }
  if (localDeclarations.has(statement.type)) return statement["id"]?.name === name ? { kind: "local" } : undefined;
  if (statement.type === "VariableDeclaration") {
    for (const declarator of statement["declarations"] as readonly AnyNode[]) {
      const id = declarator["id"] as AnyNode;
      if (!patternNames(id).includes(name)) continue;
      const init = declarator["init"] as AnyNode | null | undefined;
      return init !== null && init !== undefined && localShapes.has(init.type) ? { kind: "local" } : { kind: "opaque" };
    }
  }
  return undefined;
}

/** The binding a name refers to from `from`, or `undefined` for a global or builtin. */
function resolveName(from: AnyNode, name: string): Binding | undefined {
  for (let scope = from.parent; scope !== undefined && scope !== null; scope = scope.parent) {
    if (
      (scope.type === "ArrowFunctionExpression" ||
        scope.type === "FunctionExpression" ||
        scope.type === "FunctionDeclaration") &&
      ((scope["params"] ?? []) as readonly AnyNode[]).some((param) => patternNames(param).includes(name))
    )
      return { kind: "opaque" };
    const statements =
      scope.type === "Program" || scope.type === "BlockStatement" || scope.type === "TSModuleBlock"
        ? (scope["body"] as readonly AnyNode[] | undefined)
        : undefined;
    for (const statement of statements ?? []) {
      const found = bindingInStatement(statement, name);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function isExternalBinding(binding: Binding | undefined): boolean {
  if (binding === undefined || binding.kind === "opaque") return true;
  return binding.kind === "import" && !isProjectSpecifier(binding.source);
}

/** The identifier a reference starts from: `a` in `a`, `a.b.c`, `a.b()`; a call or `new` looks at its callee. */
function rootIdentifier(node: AnyNode): AnyNode | undefined {
  let current: AnyNode | undefined = node;
  while (current !== undefined) {
    if (current.type === "Identifier") return current;
    if (current.type === "MemberExpression") current = current["object"];
    else if (current.type === "TSQualifiedName") current = current["left"];
    else if (current.type === "CallExpression" || current.type === "NewExpression") current = current["callee"];
    else if (wrappers.has(current.type)) current = current["expression"];
    else return undefined;
  }
  return undefined;
}

/** True when the referenced value or type is not ours: a bare-specifier import, a global, or a value we cannot resolve. */
function isExternalReference(node: AnyNode): boolean {
  const root = rootIdentifier(node);
  if (root === undefined) return true;
  return isExternalBinding(resolveName(root, root["name"] as string));
}

/** True when the annotating type comes from a bare import or a global (`EventListener`); locally written types are ours. */
function isExternalType(annotation: AnyNode | null | undefined): boolean {
  const type = annotation?.type === "TSTypeAnnotation" ? (annotation["typeAnnotation"] as AnyNode) : annotation;
  if (type === null || type === undefined || type.type !== "TSTypeReference") return false;
  const name = type["typeName"] as AnyNode;
  if (name.type === "Identifier" && name["name"] === "const") return false;
  return isExternalReference(name);
}

/**
 * True when an external contract fixes the parameter list: the function (or the object or array literal holding it) is
 * an argument of a call to an imported or builtin callee, a `satisfies`/`as` operand or annotated binding whose type is
 * imported or global, or a member of a default-exported object a platform or framework consumes.
 */
function isTypedBySite(node: ParentNode): boolean {
  let current: AnyNode = node as AnyNode;
  for (let parent = current.parent; parent !== undefined && parent !== null; parent = current.parent) {
    if (wrappers.has(parent.type)) {
      current = parent;
      continue;
    }
    if (parent.type === "Property" && parent["value"] === current) {
      current = parent.parent as AnyNode;
      continue;
    }
    if (parent.type === "ObjectExpression" || parent.type === "ArrayExpression") {
      current = parent;
      continue;
    }
    if (parent.type === "CallExpression" || parent.type === "NewExpression")
      return (parent["arguments"] as readonly AnyNode[]).includes(current) && isExternalReference(parent["callee"]);
    if (typedSites.has(parent.type)) return isExternalType(parent["typeAnnotation"]);
    if (parent.type === "VariableDeclarator")
      return parent["init"] === current && isExternalType(parent["id"]?.typeAnnotation);
    if (parent.type === "PropertyDefinition")
      return parent["value"] === current && isExternalType(parent["typeAnnotation"]);
    if (parent.type === "ExportDefaultDeclaration") return current !== (node as AnyNode);
    return false;
  }
  return false;
}

/** A method marked `override` of a class extending an imported or builtin class takes the signature it overrides. */
function isOverride(node: ParentNode): boolean {
  const parent = node.parent as AnyNode | null | undefined;
  if (parent?.type !== "MethodDefinition" || parent["override"] !== true) return false;
  const superClass = parent.parent?.parent?.["superClass"] as AnyNode | null | undefined;
  return superClass !== null && superClass !== undefined && isExternalReference(superClass);
}

/** Signatures an external contract fixes: a free design choice would have been an object input. */
function isExternallyTyped(node: ParentNode): boolean {
  if (isOverride(node)) return true;
  if (node.type === "FunctionDeclaration") return false;
  return isTypedBySite(node);
}

function shouldReport(node: ParentNode, context: RuleContextWithOptions): node is FunctionLike {
  if (!hasMultipleParameters(node as FunctionLike)) return false;
  if (isExternallyTyped(node)) return false;

  const options = getOptions(context);
  if (options.exemptFileBasenames.includes(getFileBasename(context))) return false;

  const name = getDeclaredName(node as FunctionLike);
  return name === undefined || !options.exemptFunctionNames.includes(name);
}

export const noMultiPositionalParameters: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require object inputs instead of multiple positional parameters for functions you design; externally imposed signatures only: callbacks and objects handed to an imported or builtin callee, bindings typed by an imported or global type, and overrides of an imported or global class are exempt.",
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
