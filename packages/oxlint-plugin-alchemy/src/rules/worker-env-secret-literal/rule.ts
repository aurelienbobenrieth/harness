/**
 * Forbid plain string values for secret-named keys in a Cloudflare Worker's
 * `env` prop: Alchemy uploads a string as a `plain_text` binding, readable in
 * the dashboard and API; only `Config` and `Redacted` values become `secret_text`.
 *
 * @attribution https://alchemy.run/cloudflare/compute/workers (alchemy-run/alchemy docs and Cloudflare/Workers/Worker.ts `env` JSDoc, Apache-2.0; inspiration, independently implemented)
 */
import {
  memberPropertyName,
  optionsObject,
  propertyKeyName,
  stringLiteralValue,
  unwrapExpression,
} from "@aurelienbbn/oxlint-kit/ast";
import { secretNameMatcher, secretNameOptionsSchema } from "@aurelienbbn/oxlint-kit/secret-name";
import type { ESTree, Rule } from "@oxlint/plugins";
import { runtimeDeclaration } from "../runtime.js";

const message =
  'env.{{key}} looks like a secret but is a plain string, so Alchemy binds it as plain_text, visible in the Cloudflare dashboard and API. Bind it as Config.Redacted("{{key}}") (or a Redacted value) so it deploys as secret_text.';

const defaultSecretPattern =
  "SECRET|TOKEN|PASSWORD|PASSWD|PASSPHRASE|API_?KEY|PRIVATE_?KEY|SIGNING_?KEY|ACCESS_?KEY|CREDENTIAL|DSN|DATABASE_URL|CONNECTION_STRING";
const defaultBenignPattern = "PUBLIC|PUBLISHABLE|_(TTL|LENGTH|NAME|HEADER|PREFIX|COUNT|ENABLED)$";

/** `process.env.X` or `process.env["X"]`: the deploying shell's value, still a plain string. */
function isProcessEnvRead(node: ESTree.Node): boolean {
  if (node.type !== "MemberExpression") return false;
  const owner = unwrapExpression(node.object);
  if (owner.type !== "MemberExpression" || memberPropertyName(owner) !== "env") return false;
  const root = unwrapExpression(owner.object);
  return root.type === "Identifier" && root.name === "process";
}

/** True for a value that reaches the Worker as a plain string: a non-empty literal, a template, `process.env.X`. */
function isPlainString(node: ESTree.Node): boolean {
  const value = unwrapExpression(node);
  if (value.type === "LogicalExpression") return isPlainString(value.left) || isPlainString(value.right);
  if (value.type === "TemplateLiteral") return value.expressions.length > 0 || stringLiteralValue(value) !== "";
  if (value.type === "Literal") return typeof value.value === "string" && value.value !== "";
  return isProcessEnvRead(value);
}

function envObject(props: ESTree.Node | undefined): ESTree.ObjectExpression | undefined {
  if (props === undefined) return undefined;
  const value = unwrapExpression(props);
  if (value.type !== "ObjectExpression") return undefined;
  for (const property of value.properties) {
    if (property.type !== "Property" || propertyKeyName(property) !== "env") continue;
    const env = unwrapExpression(property.value);
    return env.type === "ObjectExpression" ? env : undefined;
  }
  return undefined;
}

export const workerEnvSecretLiteral: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid string literals, template literals and process.env reads as values of secret-named keys (SECRET, TOKEN, PASSWORD, API_KEY, DSN, ...) in the env prop of an Alchemy Cloudflare Worker; bind them with Config.Redacted or a Redacted value.",
    },
    messages: {
      plainTextSecret: message,
    },
    schema: [secretNameOptionsSchema],
    defaultOptions: [{ secretPattern: defaultSecretPattern, benignPattern: defaultBenignPattern }],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const declaration = runtimeDeclaration(context, node);
        if (declaration?.kind !== "worker") return;
        const env = envObject(declaration.props);
        if (env === undefined) return;
        const isSecret = secretNameMatcher(optionsObject(context), {
          secretPattern: defaultSecretPattern,
          benignPattern: defaultBenignPattern,
        });
        for (const property of env.properties) {
          if (property.type !== "Property") continue;
          const key = propertyKeyName(property);
          if (key === undefined || !isSecret(key)) continue;
          if (!isPlainString(property.value)) continue;
          context.report({ node: property.value, messageId: "plainTextSecret", data: { key } });
        }
      },
    };
  },
};
