import type { Context, ESTree, Rule } from "@oxlint/plugins";
import {
  importedSpecifierName,
  optionsObject,
  stringLiteralValue,
  unwrapExpression,
} from "@aurelienbbn/oxlint-kit/ast";
import { moduleMethod } from "../binding-support.js";

type LiteralCase = "snake" | "kebab" | "camel" | "pascal";

const defaultCase: LiteralCase = "snake";

const casePatterns: Readonly<Record<LiteralCase, { readonly pattern: RegExp; readonly example: string }>> = {
  snake: { pattern: /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u, example: "partially_refunded" },
  kebab: { pattern: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u, example: "partially-refunded" },
  camel: { pattern: /^[a-z][a-zA-Z0-9]*$/u, example: "partiallyRefunded" },
  pascal: { pattern: /^[A-Z][a-zA-Z0-9]*$/u, example: "PartiallyRefunded" },
};

function isLiteralCase(value: unknown): value is LiteralCase {
  return value === "snake" || value === "kebab" || value === "camel" || value === "pascal";
}

function caseOption(context: Context): LiteralCase {
  const value = optionsObject(context)["case"];
  return isLiteralCase(value) ? value : defaultCase;
}

/** `Schema.Literals(...)` through a `Schema` namespace or root import, or a named `Literals` import from `effect/Schema`. */
function isSchemaLiterals(context: Context, callee: ESTree.Node): boolean {
  return (
    (moduleMethod(context, callee, "Schema") ??
      importedSpecifierName(context, callee, (source) => source === "effect/Schema")) === "Literals"
  );
}

/**
 * Keep the string values of `Schema.Literals([...])` in one case. These values leave the process as data (URL
 * parameters, SQL columns, log fields, wire contracts), so a mixed `"WrongState"` next to `"no lease"` leaks into every
 * consumer. Spread elements are skipped; only the string literals written in the array are checked.
 */
export const schemaLiteralCase: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require the string values of Schema.Literals([...]) to follow one case: snake_case by default, or kebab, camel, or pascal.",
    },
    messages: {
      wrongCase:
        'Rename the literal "{{value}}" to {{case}} case (like "{{example}}"): Schema.Literals values travel as data in URLs, SQL, logs, and wire contracts, so they share one case.',
    },
    schema: [
      {
        type: "object",
        properties: { case: { enum: ["snake", "kebab", "camel", "pascal"] } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ case: defaultCase }],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isSchemaLiterals(context, node.callee)) return;
        const list = node.arguments[0] === undefined ? undefined : unwrapExpression(node.arguments[0]);
        if (list?.type !== "ArrayExpression") return;

        const literalCase = caseOption(context);
        const { pattern, example } = casePatterns[literalCase];
        for (const element of list.elements) {
          const value = stringLiteralValue(element);
          if (element === null || value === undefined || pattern.test(value)) continue;
          context.report({ node: element, messageId: "wrongCase", data: { value, case: literalCase, example } });
        }
      },
    };
  },
};
