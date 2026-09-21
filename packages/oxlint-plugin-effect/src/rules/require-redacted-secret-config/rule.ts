import type { Rule } from "@oxlint/plugins";
import { moduleMethod, optionsObject, stringLiteralValue } from "../sota-support.js";

const plainStringConstructors: ReadonlySet<string> = new Set(["String", "NonEmptyString", "string", "nonEmptyString"]);

const defaultSecretPattern = "(SECRET|PASSWORD|PASSWD|TOKEN|API_?KEY|PRIVATE_?KEY|CREDENTIAL|DATABASE_URL|_DSN$)";
const defaultBenignPattern = "_(TTL|LENGTH|NAME|HEADER|URL_PREFIX|COUNT|ENABLED)$";

function patternOption(options: Readonly<Record<string, unknown>>, name: string, fallback: string): RegExp {
  const value = options[name];
  return new RegExp(typeof value === "string" && value.length > 0 ? value : fallback, "iu");
}

/** Require secrets to be read as `Redacted` so they never print in logs, spans, or error causes. */
export const requireRedactedSecretConfig: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require Config.Redacted instead of Config.String or Config.NonEmptyString for configuration keys whose name looks like a secret.",
    },
    hasSuggestions: true,
    messages: {
      redact:
        'Read "{{name}}" with Config.Redacted and unwrap it with Redacted.value at the point of use: a plain string config leaks into logs, span attributes, and error causes.',
      useRedacted: "Replace with Config.{{replacement}}.",
    },
    schema: [
      {
        type: "object",
        properties: {
          secretPattern: { type: "string" },
          benignPattern: { type: "string" },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ secretPattern: defaultSecretPattern, benignPattern: defaultBenignPattern }],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const constructor = moduleMethod(context, node.callee, "Config");
        if (constructor === undefined || !plainStringConstructors.has(constructor)) return;
        const name = stringLiteralValue(node.arguments[0]);
        if (name === undefined) return;

        const options = optionsObject(context);
        if (!patternOption(options, "secretPattern", defaultSecretPattern).test(name)) return;
        if (patternOption(options, "benignPattern", defaultBenignPattern).test(name)) return;

        const callee = node.callee;
        if (callee.type !== "MemberExpression") return;
        const replacement = /^[A-Z]/u.test(constructor) ? "Redacted" : "redacted";
        context.report({
          node,
          messageId: "redact",
          data: { name },
          suggest: [
            {
              messageId: "useRedacted",
              data: { replacement },
              fix: (fixer) => fixer.replaceText(callee.property, replacement),
            },
          ],
        });
      },
    };
  },
};
