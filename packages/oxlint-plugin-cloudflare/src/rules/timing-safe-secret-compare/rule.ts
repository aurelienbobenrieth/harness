/**
 * Forbid `===` / `!==` comparison against secret-named Worker env values;
 * short-circuiting string equality leaks the secret through response timing.
 *
 * @attribution https://developers.cloudflare.com/workers/best-practices/workers-best-practices/ (inspiration; independently implemented)
 */
import { memberPropertyName, unwrapExpression } from "@aurelienbbn/oxlint-kit/ast";
import type { ESTree, Rule } from "@oxlint/plugins";

const message =
  "Comparing a secret with ===/!== returns as soon as a character differs, so response timing reveals the secret. Encode both values and compare them with `crypto.subtle.timingSafeEqual()` after checking their lengths match.";

const secretName = /SECRET|TOKEN|PASSWORD|PASSPHRASE|API_?KEY|PRIVATE_?KEY|SIGNING_?KEY|SIGNATURE|CREDENTIAL/i;

/** `env.<NAME>`, `this.env.<NAME>`, `c.env.<NAME>` where NAME looks like a secret; Node's `process.env` is out of scope. */
function isSecretEnvRead(node: ESTree.Node): boolean {
  const value = unwrapExpression(node);
  const name = memberPropertyName(value);
  if (name === undefined || value.type !== "MemberExpression" || !secretName.test(name)) return false;
  const owner = unwrapExpression(value.object);
  if (owner.type === "Identifier") return owner.name === "env";
  if (owner.type !== "MemberExpression" || memberPropertyName(owner) !== "env") return false;
  const root = unwrapExpression(owner.object);
  return !(root.type === "Identifier" && root.name === "process");
}

/** A secret env read, or a template literal embedding one, such as a `Bearer` header value. */
function carriesSecret(node: ESTree.Node): boolean {
  const value = unwrapExpression(node);
  if (value.type === "TemplateLiteral") return value.expressions.some((entry) => isSecretEnvRead(entry));
  return isSecretEnvRead(value);
}

/** `undefined`, `null`, `""`: presence checks, not secret comparison. */
function isPresenceOperand(node: ESTree.Node): boolean {
  const value = unwrapExpression(node);
  if (value.type === "Identifier") return value.name === "undefined";
  if (value.type === "UnaryExpression") return value.operator === "void" || value.operator === "typeof";
  return value.type === "Literal" && (value.value === null || value.value === "");
}

const equalityOperators: ReadonlySet<string> = new Set(["===", "!==", "==", "!="]);

export const timingSafeSecretCompare: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid ===, !==, == and != comparisons against secret-named env values (SECRET, TOKEN, PASSWORD, API_KEY, SIGNATURE, ...); compare with crypto.subtle.timingSafeEqual().",
    },
    messages: {
      timingUnsafeCompare: message,
    },
    schema: [],
  },
  createOnce(context) {
    return {
      BinaryExpression(node) {
        if (!equalityOperators.has(node.operator)) return;
        const left = node.left as ESTree.Node;
        const right = node.right as ESTree.Node;
        const other = carriesSecret(left) ? right : carriesSecret(right) ? left : undefined;
        if (other === undefined || isPresenceOperand(other)) return;
        context.report({ node, messageId: "timingUnsafeCompare" });
      },
    };
  },
};
