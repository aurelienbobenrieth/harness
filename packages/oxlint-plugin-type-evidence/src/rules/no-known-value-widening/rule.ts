/**
 * @attribution anti-slop by Dillon Mulroy (MIT, concept re-implemented)
 */
import type { ESTree, Rule, Variable, Scope } from "@oxlint/plugins";
import {
  isBroadRecordType,
  isEmptyObjectLiteral,
  isKnownValueExpression,
  isOpenDictionaryType,
  nearestFunction,
  typeMatches,
  type AliasMap,
} from "../ast.js";

const message =
  "The explicit broad type discards known type evidence. Keep inference, validate with `satisfies`, or use a named owner contract.";

const emptyAliases: AliasMap = new Map();

type AnnotatedNode = ESTree.Node & { readonly typeAnnotation?: ESTree.TSTypeAnnotation | null };

type PendingAssignment = {
  readonly variable: Variable | undefined;
  readonly node: ESTree.AssignmentExpression;
};

function isBroadAnnotation(type: ESTree.TSType): boolean {
  return typeMatches(
    type,
    (member) =>
      member.type === "TSUnknownKeyword" ||
      member.type === "TSObjectKeyword" ||
      isBroadRecordType(member, emptyAliases) ||
      (member.type === "TSTypeLiteral" && member.members.length === 0),
    emptyAliases,
  );
}

function isAccumulatorSeed(value: ESTree.Node, annotation: ESTree.TSType): boolean {
  return isEmptyObjectLiteral(value) && isOpenDictionaryType(annotation, emptyAliases);
}

function widens(value: ESTree.Node, annotation: ESTree.TSType): boolean {
  return isKnownValueExpression(value) && isBroadAnnotation(annotation) && !isAccumulatorSeed(value, annotation);
}

function readAnnotation(node: ESTree.Node): ESTree.TSType | undefined {
  return (node as AnnotatedNode).typeAnnotation?.typeAnnotation ?? undefined;
}

export const noKnownValueWidening: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow flowing syntactically known values into explicitly broad type annotations.",
    },
    messages: {
      knownValueWidening: message,
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
    const declaredBroad = new Map<Variable, ESTree.TSType | null>();
    let pendingAssignments: PendingAssignment[] = [];

    const checkAssertion = (node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): void => {
      if (!widens(node.expression, node.typeAnnotation)) return;
      context.report({ node, messageId: "knownValueWidening" });
    };

    return {
      before() {
        declaredBroad.clear();
        pendingAssignments = [];
      },
      VariableDeclarator(node) {
        const annotation = readAnnotation(node.id);
        if (node.id.type === "Identifier") {
          const broad = annotation !== undefined && isBroadAnnotation(annotation) ? annotation : null;
          const variable = resolve(node.id, node.id.name);
          if (variable !== undefined) declaredBroad.set(variable, broad);
        }
        if (annotation === undefined || node.init === null) return;
        if (!widens(node.init, annotation)) return;
        context.report({ node: annotation, messageId: "knownValueWidening" });
      },
      PropertyDefinition(node) {
        const annotation = readAnnotation(node);
        if (annotation === undefined || node.value === null) return;
        if (!widens(node.value, annotation)) return;
        context.report({ node: annotation, messageId: "knownValueWidening" });
      },
      AssignmentExpression(node) {
        if (node.operator !== "=" || node.left.type !== "Identifier") return;
        if (!isKnownValueExpression(node.right)) return;
        pendingAssignments.push({ variable: resolve(node.left, node.left.name), node });
      },
      ReturnStatement(node) {
        if (node.argument === null) return;
        const owner = nearestFunction(node);
        if (owner === undefined) return;
        const annotation = owner.returnType?.typeAnnotation;
        if (annotation === undefined || annotation === null) return;
        if (!widens(node.argument, annotation)) return;
        context.report({ node, messageId: "knownValueWidening" });
      },
      ArrowFunctionExpression(node) {
        const annotation = node.returnType?.typeAnnotation;
        if (annotation === undefined || annotation === null || node.body.type === "BlockStatement") return;
        if (!widens(node.body, annotation)) return;
        context.report({ node: node.body, messageId: "knownValueWidening" });
      },
      TSAsExpression: checkAssertion,
      TSTypeAssertion: checkAssertion,
      "Program:exit"() {
        for (const assignment of pendingAssignments) {
          const annotation = assignment.variable === undefined ? undefined : declaredBroad.get(assignment.variable);
          if (annotation === undefined || annotation === null) continue;
          if (!widens(assignment.node.right, annotation)) continue;
          context.report({ node: assignment.node, messageId: "knownValueWidening" });
        }
      },
    };
  },
};
