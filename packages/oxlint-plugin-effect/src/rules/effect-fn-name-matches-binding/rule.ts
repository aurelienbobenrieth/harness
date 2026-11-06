import type { ESTree, Rule } from "@oxlint/plugins";
import { optionsObject, parentOf, stringLiteralValue } from "@aurelienbbn/oxlint-kit/ast";
import { effectMethod } from "../binding-support.js";

function keyName(key: ESTree.Node, computed: boolean): string | undefined {
  if (computed) return undefined;
  if (key.type === "Identifier") return key.name;
  return stringLiteralValue(key);
}

function bindingName(value: ESTree.Node): string | undefined {
  const parent = parentOf(value);
  if (parent === undefined) return undefined;
  if (parent.type === "VariableDeclarator") {
    return parent.init === value && parent.id.type === "Identifier" ? parent.id.name : undefined;
  }
  if (parent.type === "Property" || parent.type === "PropertyDefinition") {
    return parent.value === value ? keyName(parent.key, parent.computed) : undefined;
  }
  return undefined;
}

/** Split `createOrder`, `create_order`, `CreateOrder` and `create-order` into lowercase words. */
function words(name: string): readonly string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((word) => word.length > 0);
}

/**
 * Whether the span's last segment names the binding: the same words in any case style (`write_ui_mirror` for
 * `writeUiMirror`), or the trailing words of a longer binding (`view_run` for `leaksViewRun`).
 */
function namesBinding(segment: string, binding: string): boolean {
  const segmentWords = words(segment);
  const bindingWords = words(binding);
  if (segmentWords.length === 0 || segmentWords.length > bindingWords.length) return false;
  const offset = bindingWords.length - segmentWords.length;
  return segmentWords.every((word, index) => bindingWords[offset + index] === word);
}

function ignorePattern(options: Readonly<Record<string, unknown>>): RegExp | undefined {
  const pattern = options["ignorePattern"];
  return typeof pattern === "string" && pattern.length > 0 ? new RegExp(pattern, "u") : undefined;
}

/**
 * Keep `Effect.fn` span names in sync with the binding they trace. The last segment may use the binding's spelling or
 * the snake_case of its words, so the rule agrees with `telemetry-name-format`.
 *
 * @attribution Effect bundled AGENTS.md "The name string should match the function name" (concept)
 */
export const effectFnNameMatchesBinding: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require the last dot-segment of an Effect.fn span name to name the variable or property the function is bound to, in camelCase or snake_case, or as its trailing words.",
    },
    hasSuggestions: true,
    messages: {
      mismatch:
        'Rename the span "{{spanName}}" to end with "{{bindingName}}": traces attribute this function to a different one.',
      rename: 'Replace with "{{replacement}}".',
    },
    schema: [
      {
        type: "object",
        properties: { ignorePattern: { type: "string" } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{}],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (effectMethod(context, node.callee) !== "fn") return;
        const nameNode = node.arguments[0];
        const spanName = stringLiteralValue(nameNode);
        if (nameNode === undefined || spanName === undefined || spanName.trim().length === 0) return;

        const parent = parentOf(node);
        const curried = parent?.type === "CallExpression" && parent.callee === node ? parent : undefined;
        if (curried === undefined) return;
        const name = bindingName(curried);
        if (name === undefined) return;

        const segments = spanName.split(".");
        const last = segments.at(-1) ?? "";
        if (last === name || namesBinding(last, name)) return;
        if (ignorePattern(optionsObject(context))?.test(spanName) === true) return;

        const replacement = [...segments.slice(0, -1), last.includes("_") ? words(name).join("_") : name].join(".");
        context.report({
          node: nameNode,
          messageId: "mismatch",
          data: { spanName, bindingName: name },
          suggest: [
            {
              messageId: "rename",
              data: { replacement },
              fix: (fixer) => fixer.replaceText(nameNode, JSON.stringify(replacement)),
            },
          ],
        });
      },
    };
  },
};
