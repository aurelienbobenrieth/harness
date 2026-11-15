/** Minimal view of an ESTree node as `oxc-parser` returns it. */
export interface AstNode {
  readonly type: string;
  readonly start: number;
  readonly end: number;
}

type Bag = Readonly<Record<string, unknown>>;

/** Keys whose subtrees are type positions: never runtime references. */
const TYPE_KEYS: ReadonlySet<string> = new Set([
  "typeAnnotation",
  "returnType",
  "typeParameters",
  "typeArguments",
  "superTypeArguments",
  "superTypeParameters",
  "implements",
  "decorators",
]);

const TYPE_DECLARATIONS: ReadonlySet<string> = new Set([
  "TSInterfaceDeclaration",
  "TSTypeAliasDeclaration",
  "TSModuleDeclaration",
  "TSEnumDeclaration",
]);

export const isNode = (value: unknown): value is AstNode =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Bag)["type"] === "string" &&
  typeof (value as Bag)["start"] === "number";

export const field = (node: AstNode, key: string): unknown => (node as unknown as Bag)[key];

export const nodeField = (node: AstNode, key: string): AstNode | undefined => {
  const value = field(node, key);
  return isNode(value) ? value : undefined;
};

export const listField = (node: AstNode, key: string): readonly AstNode[] => {
  const value = field(node, key);
  return Array.isArray(value) ? value.filter(isNode) : [];
};

export const stringField = (node: AstNode, key: string): string | undefined => {
  const value = field(node, key);
  return typeof value === "string" ? value : undefined;
};

/** The name of an `Identifier`, otherwise `undefined`. */
export const identifierName = (node: AstNode | undefined): string | undefined =>
  node?.type === "Identifier" ? stringField(node, "name") : undefined;

/** `foo` for `foo`, `bar` for `x.bar`; `undefined` for anything else. */
export const calleeName = (node: AstNode | undefined): string | undefined => {
  if (node === undefined) return undefined;
  if (node.type === "Identifier") return identifierName(node);
  if (node.type === "MemberExpression" && field(node, "computed") !== true) {
    return identifierName(nodeField(node, "property"));
  }
  return undefined;
};

export const isFunction = (node: AstNode | undefined): boolean =>
  node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression";

/** Where a visited node sits under its parent. */
export interface Slot {
  readonly parent: AstNode | undefined;
  readonly key: string;
}

const isReferencePosition = (node: AstNode, slot: Slot): boolean => {
  const { parent, key } = slot;
  if (parent === undefined) return true;
  const computed = field(parent, "computed") === true;
  switch (parent.type) {
    case "MemberExpression":
      return key !== "property" || computed;
    case "Property":
    case "PropertyDefinition":
    case "MethodDefinition":
    case "AccessorProperty":
      return key !== "key" || computed;
    case "VariableDeclarator":
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ClassDeclaration":
    case "ClassExpression":
      return key !== "id" && !(key === "params" && node.type === "Identifier");
    case "ArrowFunctionExpression":
      return !(key === "params" && node.type === "Identifier");
    case "LabeledStatement":
    case "BreakStatement":
    case "ContinueStatement":
      return false;
    default:
      return true;
  }
};

/**
 * Visits `root` and every runtime descendant, depth first. `visit` returns `false` to skip a subtree.
 * Type annotations and type-only declarations are never entered.
 */
export const walk = (
  root: AstNode,
  visit: (node: AstNode, slot: Slot & { readonly reference: boolean }) => boolean | void,
): void => {
  const enter = (node: AstNode, slot: Slot): void => {
    if (TYPE_DECLARATIONS.has(node.type)) return;
    if (visit(node, { ...slot, reference: isReferencePosition(node, slot) }) === false) return;
    for (const [key, value] of Object.entries(node as unknown as Bag)) {
      if (TYPE_KEYS.has(key)) continue;
      if (Array.isArray(value)) {
        for (const item of value) if (isNode(item)) enter(item, { parent: node, key });
      } else if (isNode(value)) {
        enter(value, { parent: node, key });
      }
    }
  };
  enter(root, { parent: undefined, key: "" });
};
