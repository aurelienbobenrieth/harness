/**
 * @attribution ai-automation by Sandro Maglione (inspiration, independently re-implemented)
 */
import type { ESTree, Rule } from "@oxlint/plugins";
import { isIdentifier } from "../ast.js";
import { binding } from "../binding-support.js";
import { hasEffectImport } from "../effect-modules.js";

const timeMessage = "Ambient time reads make Effect code nondeterministic. Use Clock or DateTime from effect.";
const randomnessMessage = "Ambient randomness makes Effect code nondeterministic. Use Random from effect.";
const cryptoMessage =
  "Ambient crypto randomness makes Effect code nondeterministic. Inject a cryptographically secure service; preserve the security guarantees of the original crypto API.";

function isGlobalObjectReference(node: ESTree.Node | undefined, name: string): boolean {
  if (isIdentifier(node, name)) return true;

  return (
    node?.type === "MemberExpression" && isIdentifier(node.object, "globalThis") && isIdentifier(node.property, name)
  );
}

function isGlobalMethodCallee(callee: ESTree.Node, objectName: string, propertyName: string): boolean {
  return (
    callee.type === "MemberExpression" &&
    isGlobalObjectReference(callee.object, objectName) &&
    isIdentifier(callee.property, propertyName)
  );
}

function ambientCallMessageId(callee: ESTree.Node): "ambientCrypto" | "ambientRandomness" | "ambientTime" | undefined {
  if (isGlobalMethodCallee(callee, "Date", "now")) return "ambientTime";
  if (isGlobalMethodCallee(callee, "performance", "now")) return "ambientTime";
  if (isGlobalMethodCallee(callee, "Math", "random")) return "ambientRandomness";
  if (isGlobalMethodCallee(callee, "crypto", "randomUUID")) return "ambientCrypto";
  if (isGlobalMethodCallee(callee, "crypto", "getRandomValues")) return "ambientCrypto";

  return undefined;
}

export const noAmbientNondeterminism: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow ambient time, randomness, and crypto reads in Effect code.",
    },
    messages: {
      ambientTime: timeMessage,
      ambientRandomness: randomnessMessage,
      ambientCrypto: cryptoMessage,
    },
  },
  createOnce(context) {
    let fileImportsEffect = false;

    return {
      Program(node: ESTree.Program) {
        fileImportsEffect = hasEffectImport(node);
      },
      CallExpression(node) {
        if (!fileImportsEffect) return;

        if (
          node.callee.type === "MemberExpression" &&
          node.callee.object.type === "Identifier" &&
          (binding(context, node.callee.object, node.callee.object.name)?.defs.length ?? 0) > 0
        )
          return;
        const messageId = ambientCallMessageId(node.callee);
        if (messageId === undefined) return;

        context.report({ node, messageId });
      },
      NewExpression(node) {
        if (!fileImportsEffect) return;
        if (
          node.callee.type === "Identifier" &&
          (binding(context, node.callee, node.callee.name)?.defs.length ?? 0) > 0
        )
          return;
        if (!isGlobalObjectReference(node.callee, "Date") || node.arguments.length > 0) return;

        context.report({ node, messageId: "ambientTime" });
      },
    };
  },
};
