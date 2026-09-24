/**
 * Forbid runtime values interpolated or concatenated into SQL text passed to
 * D1 `prepare` / `exec` and Durable Object `sql.exec`.
 *
 * @attribution https://developers.cloudflare.com/d1/worker-api/d1-database/ (inspiration; independently implemented)
 * @attribution https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/ (inspiration; independently implemented)
 */
import { binding, memberPropertyName, unwrapExpression } from "../ast.js";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const message =
  "Runtime values are spliced into this SQL text, which opens it to SQL injection. Write `?` placeholders and pass the values separately: `.prepare(sql).bind(...values)` for D1, `sql.exec(sql, ...values)` for Durable Object SQLite.";

/** True for `env.<BINDING>`, `this.env.<BINDING>`, `c.env.<BINDING>`: a member read off something named `env`. */
function isEnvBinding(node: ESTree.Node): boolean {
  const value = unwrapExpression(node);
  if (value.type !== "MemberExpression") return false;
  const owner = unwrapExpression(value.object);
  if (owner.type === "Identifier") return owner.name === "env";
  return memberPropertyName(owner) === "env";
}

/** An env binding, or a local initialised from one (`const db = env.DB`). */
function isD1Receiver(context: Context, node: ESTree.Node): boolean {
  if (isEnvBinding(node)) return true;
  const value = unwrapExpression(node);
  if (value.type !== "Identifier") return false;
  return (binding(context, value, value.name)?.defs ?? []).some(
    (definition) =>
      definition.node.type === "VariableDeclarator" &&
      definition.node.id.type === "Identifier" &&
      definition.node.init !== null &&
      definition.node.init !== undefined &&
      isEnvBinding(definition.node.init),
  );
}

/** `<x>.sql.exec(...)` (e.g. `this.ctx.storage.sql.exec`) or `sql.exec(...)` on a local named `sql`. */
function isDurableObjectSql(node: ESTree.Node): boolean {
  const value = unwrapExpression(node);
  if (value.type === "Identifier") return value.name === "sql";
  return memberPropertyName(value) === "sql";
}

function isSqlCall(context: Context, node: ESTree.CallExpression): boolean {
  const callee = unwrapExpression(node.callee);
  if (callee.type !== "MemberExpression") return false;
  const method = memberPropertyName(callee);
  if (method === "prepare") return isD1Receiver(context, callee.object);
  if (method === "exec") return isD1Receiver(context, callee.object) || isDurableObjectSql(callee.object);
  return false;
}

/** A literal, or a `const` bound to a literal: text fixed at author time, not runtime input. */
function isStaticValue(context: Context, node: ESTree.Node, depth = 0): boolean {
  if (depth > 8) return false;
  const value = unwrapExpression(node);
  if (value.type === "Literal") return true;
  if (value.type === "TemplateLiteral")
    return value.expressions.every((entry) => isStaticValue(context, entry, depth + 1));
  if (value.type === "BinaryExpression" && value.operator === "+")
    return isStaticValue(context, value.left, depth + 1) && isStaticValue(context, value.right, depth + 1);
  if (value.type !== "Identifier") return false;
  return (binding(context, value, value.name)?.defs ?? []).some((definition) => {
    if (definition.node.type !== "VariableDeclarator" || definition.parent?.type !== "VariableDeclaration")
      return false;
    const initial = definition.node.init;
    return (
      definition.parent.kind === "const" &&
      initial !== null &&
      initial !== undefined &&
      isStaticValue(context, initial, depth + 1)
    );
  });
}

function isInterpolatedSql(context: Context, node: ESTree.Node | undefined): boolean {
  if (node === undefined) return false;
  const value = unwrapExpression(node);
  if (value.type === "TemplateLiteral") return !isStaticValue(context, value);
  if (value.type === "BinaryExpression" && value.operator === "+") return !isStaticValue(context, value);
  if (value.type !== "Identifier") return false;
  // `const query = `...${id}`; db.prepare(query)`: follow one const hop.
  return (binding(context, value, value.name)?.defs ?? []).some((definition) => {
    if (definition.node.type !== "VariableDeclarator" || definition.parent?.type !== "VariableDeclaration")
      return false;
    const initial = definition.node.init;
    if (definition.parent.kind !== "const" || initial === null || initial === undefined) return false;
    const unwrapped = unwrapExpression(initial);
    return (
      (unwrapped.type === "TemplateLiteral" || (unwrapped.type === "BinaryExpression" && unwrapped.operator === "+")) &&
      !isStaticValue(context, unwrapped)
    );
  });
}

export const noInterpolatedSql: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid template-literal interpolation or string concatenation of runtime values into SQL passed to D1 prepare()/exec() or Durable Object sql.exec(); bind parameters instead.",
    },
    messages: {
      noInterpolatedSql: message,
    },
    schema: [],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isSqlCall(context, node)) return;
        const first = node.arguments[0];
        if (first === undefined || first.type === "SpreadElement" || !isInterpolatedSql(context, first)) return;
        context.report({ node: first, messageId: "noInterpolatedSql" });
      },
    };
  },
};
