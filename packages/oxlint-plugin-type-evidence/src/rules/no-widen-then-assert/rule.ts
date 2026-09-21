/**
 * @attribution anti-slop by Dillon Mulroy (MIT, concept re-implemented)
 */
import type { ESTree, Rule, Variable, Scope } from "@oxlint/plugins";
import {
  isAssertionExpression,
  isBroadRecordType,
  isConstAssertion,
  isKnownValueExpression,
  typeMatches,
  unwrapExpressionParens,
  type AliasMap,
} from "../ast.js";

const message =
  'Binding "{{name}}" discards type evidence and later recreates it with an assertion. Keep the precise type from initialization through use.';

const emptyAliases: AliasMap = new Map();

type BroadDeclaration = {
  readonly name: string;
  readonly scope: Variable | undefined;
  readonly end: number;
  reassigned: boolean;
  duplicate: boolean;
};

type NarrowingAssertion = {
  readonly name: string;
  readonly scope: Variable | undefined;
  readonly node: ESTree.TSAsExpression | ESTree.TSTypeAssertion;
};

function isBroadType(type: ESTree.TSType): boolean {
  return typeMatches(
    type,
    (member) =>
      member.type === "TSUnknownKeyword" ||
      member.type === "TSAnyKeyword" ||
      member.type === "TSObjectKeyword" ||
      isBroadRecordType(member, emptyAliases),
    emptyAliases,
  );
}

function hasBroadDeclaredType(declarator: ESTree.VariableDeclarator): boolean {
  const annotation = (declarator.id as { readonly typeAnnotation?: ESTree.TSTypeAnnotation | null }).typeAnnotation;
  if (annotation !== undefined && annotation !== null) return isBroadType(annotation.typeAnnotation);
  if (declarator.init === null) return false;
  const initializer = unwrapExpressionParens(declarator.init);
  return (
    isAssertionExpression(initializer) && !isConstAssertion(initializer) && isBroadType(initializer.typeAnnotation)
  );
}

function initializerHasKnownEvidence(declarator: ESTree.VariableDeclarator): boolean {
  if (declarator.init === null) return false;
  let value: ESTree.Node = declarator.init;
  for (;;) {
    const unwrapped = unwrapExpressionParens(value);
    if (!isAssertionExpression(unwrapped)) return isKnownValueExpression(unwrapped);
    value = unwrapped.expression;
  }
}

export const noWidenThenAssert: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow widening a known const initializer and re-narrowing it later with an assertion.",
    },
    messages: {
      widenThenAssert: message,
    },
  },
  createOnce(context) {
    const resolve = (node: ESTree.Node, name: string): Variable | undefined => {
      for (let scope: Scope | null = context.sourceCode.getScope(node); scope !== null; scope = scope.upper) {
        const variable = scope.set.get(name);
        if (variable !== undefined) return variable;
      }
      return undefined;
    };
    let declarations: BroadDeclaration[] = [];
    let assertions: NarrowingAssertion[] = [];

    const collectAssertion = (node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): void => {
      if (isConstAssertion(node) || isBroadType(node.typeAnnotation)) return;
      const subject = unwrapExpressionParens(node.expression);
      if (subject.type !== "Identifier") return;
      assertions.push({
        name: (subject as ESTree.IdentifierReference).name,
        scope: resolve(subject, subject.name),
        node,
      });
    };

    return {
      before() {
        declarations = [];
        assertions = [];
      },
      VariableDeclarator(node) {
        if (node.id.type !== "Identifier") return;
        const name = node.id.name;
        const scope = resolve(node.id, name);
        const existing = declarations.find((declaration) => declaration.name === name && declaration.scope === scope);
        if (existing !== undefined) {
          existing.duplicate = true;
          return;
        }
        if (node.parent.type === "VariableDeclaration" && node.parent.kind !== "const") return;
        if (!hasBroadDeclaredType(node) || !initializerHasKnownEvidence(node)) return;
        declarations.push({ name, scope, end: node.end, reassigned: false, duplicate: false });
      },
      AssignmentExpression(node) {
        if (node.left.type !== "Identifier") return;
        const scope = resolve(node.left, node.left.name);
        for (const declaration of declarations) {
          if (declaration.name === node.left.name && declaration.scope === scope) declaration.reassigned = true;
        }
      },
      TSAsExpression: collectAssertion,
      TSTypeAssertion: collectAssertion,
      "Program:exit"() {
        for (const assertion of assertions) {
          const declaration = declarations.find(
            (candidate) => candidate.name === assertion.name && candidate.scope === assertion.scope,
          );
          if (declaration === undefined || declaration.duplicate || declaration.reassigned) continue;
          if (assertion.node.start <= declaration.end) continue;
          context.report({ node: assertion.node, messageId: "widenThenAssert", data: { name: assertion.name } });
        }
      },
    };
  },
};
