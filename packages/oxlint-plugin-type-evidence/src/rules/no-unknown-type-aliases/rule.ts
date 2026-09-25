import { isBoundaryFile } from "../ast.js";
/**
 * @attribution anti-slop by Dillon Mulroy (MIT, concept re-implemented)
 */
import type { ESTree, Rule } from "@oxlint/plugins";
import { collectAlias, typeMatches, type AliasMap } from "../ast.js";

const message =
  'Type alias "{{name}}" resolves to unknown, so it names the absence of evidence. Define the actual shape, or delete the alias and parse at the boundary.';

export const noUnknownTypeAliases: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow type aliases that resolve to unknown.",
    },
    messages: {
      unknownAlias: message,
    },
  },
  createOnce(context) {
    const aliases: AliasMap = new Map();
    let declarations: ESTree.TSTypeAliasDeclaration[] = [];

    return {
      before() {
        if (isBoundaryFile(context.filename)) return false;
        aliases.clear();
        declarations = [];
      },
      TSTypeAliasDeclaration(node) {
        collectAlias(aliases, node);
        declarations.push(node);
      },
      "Program:exit"() {
        for (const declaration of declarations) {
          if (!typeMatches(declaration.typeAnnotation, (member) => member.type === "TSUnknownKeyword", aliases)) {
            continue;
          }
          context.report({ node: declaration.id, messageId: "unknownAlias", data: { name: declaration.id.name } });
        }
      },
    };
  },
};
