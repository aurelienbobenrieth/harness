import type { ESTree } from "@oxlint/plugins";

export type AliasMap = Map<string, ESTree.TSType>;

export type ParentedNode = ESTree.Node & { readonly parent?: ESTree.Node | null };

type AnnotatedNode = ESTree.Node & { readonly typeAnnotation?: ESTree.TSTypeAnnotation | null };

type FunctionLikeNode = ESTree.Node & {
  readonly params?: readonly ESTree.Node[];
  readonly returnType?: ESTree.TSTypeAnnotation | null;
};

export type ParameterInfo = {
  readonly name: string | undefined;
  readonly annotation: ESTree.TSType | undefined;
  readonly reportNode: ESTree.Node;
};

const functionNodeTypes = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "TSDeclareFunction",
  "TSEmptyBodyFunctionExpression",
]);

export function getReturnTypeAnnotation(node: ESTree.Node): ESTree.TSTypeAnnotation | undefined {
  return (node as FunctionLikeNode).returnType ?? undefined;
}

export function unwrapExpressionParens(expression: ESTree.Node): ESTree.Node {
  let current = expression;
  while (current.type === "ParenthesizedExpression") current = (current as ESTree.ParenthesizedExpression).expression;
  return current;
}

export function unwrapTypeParens(type: ESTree.TSType): ESTree.TSType {
  let current = type;
  while (current.type === "TSParenthesizedType") current = current.typeAnnotation;
  return current;
}

export function isAssertionExpression(node: ESTree.Node): node is ESTree.TSAsExpression | ESTree.TSTypeAssertion {
  return node.type === "TSAsExpression" || node.type === "TSTypeAssertion";
}

export function isConstAssertion(node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): boolean {
  const target = unwrapTypeParens(node.typeAnnotation);
  return (
    target.type === "TSTypeReference" &&
    target.typeName.type === "Identifier" &&
    target.typeName.name === "const" &&
    target.typeArguments == null
  );
}

export function isTypeReferenceNamed(type: ESTree.TSType, name: string): type is ESTree.TSTypeReference {
  return type.type === "TSTypeReference" && type.typeName.type === "Identifier" && type.typeName.name === name;
}

export function collectAlias(aliases: AliasMap, declaration: ESTree.TSTypeAliasDeclaration): void {
  if (declaration.typeParameters !== null) return;
  aliases.set(declaration.id.name, declaration.typeAnnotation);
}

export function typeMatches(
  type: ESTree.TSType,
  predicate: (member: ESTree.TSType) => boolean,
  aliases: AliasMap,
  seen: Set<string> = new Set(),
): boolean {
  const unwrapped = unwrapTypeParens(type);
  if (predicate(unwrapped)) return true;
  if (unwrapped.type === "TSUnionType") {
    return unwrapped.types.some((member) => typeMatches(member, predicate, aliases, seen));
  }
  if (
    unwrapped.type === "TSTypeReference" &&
    unwrapped.typeName.type === "Identifier" &&
    unwrapped.typeArguments == null
  ) {
    const aliasName = unwrapped.typeName.name;
    const body = aliases.get(aliasName);
    if (body === undefined || seen.has(aliasName)) return false;
    seen.add(aliasName);
    return typeMatches(body, predicate, aliases, seen);
  }
  return false;
}

export function isBroadKeyType(type: ESTree.TSType, aliases: AliasMap): boolean {
  return typeMatches(
    type,
    (member) =>
      member.type === "TSStringKeyword" ||
      member.type === "TSNumberKeyword" ||
      member.type === "TSSymbolKeyword" ||
      isTypeReferenceNamed(member, "PropertyKey"),
    aliases,
  );
}

export function isUnsafeDictionaryValueType(type: ESTree.TSType, aliases: AliasMap): boolean {
  return typeMatches(
    type,
    (member) =>
      member.type === "TSUnknownKeyword" ||
      member.type === "TSAnyKeyword" ||
      member.type === "TSObjectKeyword" ||
      (member.type === "TSTypeLiteral" && member.members.length === 0),
    aliases,
  );
}

export function isBroadRecordType(type: ESTree.TSType, aliases: AliasMap): boolean {
  return typeMatches(
    type,
    (member) => {
      if (!isTypeReferenceNamed(member, "Record")) return false;
      const keyArgument = member.typeArguments?.params[0];
      return keyArgument !== undefined && isBroadKeyType(keyArgument, aliases);
    },
    aliases,
  );
}

export function isOpenDictionaryType(type: ESTree.TSType, aliases: AliasMap): boolean {
  return typeMatches(
    type,
    (member) => {
      if (isBroadRecordType(member, aliases)) return true;
      return (
        member.type === "TSTypeLiteral" && member.members.some((signature) => signature.type === "TSIndexSignature")
      );
    },
    aliases,
  );
}

function unwrapKnownValueWrappers(expression: ESTree.Node): ESTree.Node {
  let current = expression;
  for (;;) {
    if (current.type === "ParenthesizedExpression") {
      current = (current as ESTree.ParenthesizedExpression).expression;
      continue;
    }
    if (current.type === "TSNonNullExpression" || current.type === "TSSatisfiesExpression") {
      current = (current as ESTree.TSNonNullExpression | ESTree.TSSatisfiesExpression).expression;
      continue;
    }
    if (isAssertionExpression(current) && isConstAssertion(current)) {
      current = current.expression;
      continue;
    }
    return current;
  }
}

const knownValueNodeTypes = new Set([
  "ObjectExpression",
  "ArrayExpression",
  "ArrowFunctionExpression",
  "FunctionExpression",
  "ClassExpression",
  "NewExpression",
  "Literal",
  "TemplateLiteral",
]);

export function isKnownValueExpression(expression: ESTree.Node): boolean {
  return knownValueNodeTypes.has(unwrapKnownValueWrappers(expression).type);
}

export function isEmptyObjectLiteral(expression: ESTree.Node): boolean {
  const unwrapped = unwrapKnownValueWrappers(expression);
  return unwrapped.type === "ObjectExpression" && unwrapped.properties.length === 0;
}

function readParameter(parameter: ESTree.Node): ParameterInfo {
  let current = parameter;
  if (current.type === "TSParameterProperty") current = (current as ESTree.TSParameterProperty).parameter;

  let annotation = (current as AnnotatedNode).typeAnnotation ?? undefined;
  if (current.type === "RestElement") {
    const argument = (current as ESTree.FormalParameterRest).argument;
    annotation ??= (argument as AnnotatedNode).typeAnnotation ?? undefined;
    current = argument;
  }
  if (current.type === "AssignmentPattern") {
    const left = (current as ESTree.AssignmentPattern).left;
    annotation ??= (left as AnnotatedNode).typeAnnotation ?? undefined;
    current = left;
  }

  const name = current.type === "Identifier" ? (current as ESTree.BindingIdentifier).name : undefined;
  return { name, annotation: annotation?.typeAnnotation, reportNode: annotation ?? parameter };
}

export function readParameters(node: ESTree.Node): readonly ParameterInfo[] {
  const params = (node as FunctionLikeNode).params ?? [];
  return params.map((parameter) => readParameter(parameter));
}

export function findAncestor(
  node: ESTree.Node,
  predicate: (candidate: ESTree.Node) => boolean,
): ESTree.Node | undefined {
  let current = (node as ParentedNode).parent ?? undefined;
  while (current !== undefined && current !== null) {
    if (predicate(current)) return current;
    current = (current as ParentedNode).parent ?? undefined;
  }
  return undefined;
}

export function nearestFunction(node: ESTree.Node): FunctionLikeNode | undefined {
  return findAncestor(node, (candidate) => functionNodeTypes.has(candidate.type)) as FunctionLikeNode | undefined;
}

export function hasTypePredicateReturn(node: ESTree.Node): boolean {
  const returnType = getReturnTypeAnnotation(node);
  return returnType !== undefined && unwrapTypeParens(returnType.typeAnnotation).type === "TSTypePredicate";
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Explicit decoding/transport modules may retain unknown until validation. */
export function isBoundaryFile(filename: string): boolean {
  return /(?:^|[/\\])(?:boundaries|decoders|adapters)(?:[/\\])|\.boundary\.[cm]?[jt]sx?$/.test(filename);
}
