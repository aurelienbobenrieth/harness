import { isBoundaryFile } from "../ast.js";
/**
 * @attribution anti-slop by Dillon Mulroy (MIT, concept re-implemented)
 */
import type { ESTree, Rule } from "@oxlint/plugins";
import {
  collectAlias,
  findAncestor,
  isBroadKeyType,
  isTypeReferenceNamed,
  isUnsafeDictionaryValueType,
  type AliasMap,
} from "../ast.js";

const message =
  "This dictionary type gives its values no contract. Name the value shape, or model the finite keys explicitly.";

type DictionaryCandidate = {
  readonly node: ESTree.Node;
  readonly key: ESTree.TSType;
  readonly value: ESTree.TSType;
};

function isInsideTypeParameterConstraint(node: ESTree.Node): boolean {
  return findAncestor(node, (candidate) => candidate.type === "TSTypeParameter") !== undefined;
}

export const noUnsafeDictionaryType: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow dictionary types whose broad keys map to contract-free values.",
    },
    messages: {
      unsafeDictionary: message,
    },
  },
  createOnce(context) {
    const aliases: AliasMap = new Map();
    let candidates: DictionaryCandidate[] = [];

    const collect = (candidate: DictionaryCandidate): void => {
      if (isInsideTypeParameterConstraint(candidate.node)) return;
      candidates.push(candidate);
    };

    return {
      before() {
        if (isBoundaryFile(context.filename)) return false;
        aliases.clear();
        candidates = [];
      },
      TSTypeAliasDeclaration(node) {
        collectAlias(aliases, node);
      },
      TSTypeReference(node) {
        if (!isTypeReferenceNamed(node, "Record")) return;
        const params = node.typeArguments?.params;
        if (params === undefined || params.length !== 2) return;
        collect({ node, key: params[0], value: params[1] });
      },
      TSIndexSignature(node) {
        const keyAnnotation = node.parameters[0]?.typeAnnotation;
        if (keyAnnotation === undefined) return;
        collect({ node, key: keyAnnotation.typeAnnotation, value: node.typeAnnotation.typeAnnotation });
      },
      TSMappedType(node) {
        if (node.typeAnnotation === null) return;
        collect({ node, key: node.constraint, value: node.typeAnnotation });
      },
      "Program:exit"() {
        for (const candidate of candidates) {
          if (!isBroadKeyType(candidate.key, aliases)) continue;
          if (!isUnsafeDictionaryValueType(candidate.value, aliases)) continue;
          context.report({ node: candidate.node, messageId: "unsafeDictionary" });
        }
      },
    };
  },
};
