/**
 * Require XState machines to declare their types: `types` (XState v5) or
 * `schemas` (XState v6) on `createMachine(...)`, or on the setup that builds the
 * machine: `setup(...)`, `setupEffect(...)` from `@xstate/effect`, or
 * `<system>.setup(...)`. A setup without either is accepted when every machine
 * or extension built from it in the same file declares them instead.
 *
 * @attribution ai-automation by Sandro Maglione (inspiration, independently re-implemented)
 */
import { binding, memberPropertyName, parentOf, unwrapExpressionKeepingChain } from "@aurelienbbn/oxlint-kit/ast";
import { findProperty, isSetupCall } from "../ast.js";
import { effectImportedName, importedName } from "../binding-support.js";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const machineMessage =
  "createMachine() without types or schemas leaves context and events untyped: declare types (XState v5) or schemas (XState v6) on the machine or on the setup() that builds it.";

const setupMessage =
  "{{callee}}() without types or schemas leaves context, events and implementations untyped: declare types (XState v5) or schemas (XState v6) here or on the machine it creates.";

const typeKeys: readonly string[] = ["types", "schemas"];

const derivingMethods: ReadonlySet<string> = new Set(["createMachine", "extend"]);

/** False only when the config is statically known to declare neither `types` nor `schemas`. */
function mayDeclareTypes(argument: ESTree.Node | undefined): boolean {
  if (argument === undefined) return false;
  if (argument.type === "SpreadElement") return true;
  const config = unwrapExpressionKeepingChain(argument);
  if (config.type !== "ObjectExpression") return true;
  if (config.properties.some((property) => property.type !== "Property" || property.computed)) return true;
  return typeKeys.some((key) => findProperty(config, key) !== undefined);
}

/** The `.createMachine(...)` / `.extend(...)` call made on `receiver`, if any. */
function derivingCall(receiver: ESTree.Node): ESTree.CallExpression | undefined {
  const member = parentOf(receiver);
  if (member?.type !== "MemberExpression" || member.object !== receiver) return undefined;
  const name = memberPropertyName(member);
  const call = parentOf(member);
  return name !== undefined && derivingMethods.has(name) && call?.type === "CallExpression" && call.callee === member
    ? call
    : undefined;
}

/**
 * True when the setup result is consumed in this file only by `.createMachine`
 * / `.extend` calls that may declare types, either chained directly or through
 * a `const` binding.
 */
function typedDownstream(context: Context, setupCall: ESTree.CallExpression): boolean {
  const direct = derivingCall(setupCall);
  if (direct !== undefined) return mayDeclareTypes(direct.arguments[0]);
  const declarator = parentOf(setupCall);
  if (declarator?.type !== "VariableDeclarator" || declarator.id.type !== "Identifier") return false;
  const uses = (binding(context, declarator.id, declarator.id.name)?.references ?? []).filter(
    (reference) => reference.identifier !== declarator.id,
  );
  return (
    uses.length > 0 &&
    uses.every((reference) => {
      const call = derivingCall(reference.identifier);
      return call !== undefined && mayDeclareTypes(call.arguments[0]);
    })
  );
}

function setupName(context: Context, call: ESTree.CallExpression): string {
  return effectImportedName(context, call.callee) === "setupEffect" ? "setupEffect" : "setup";
}

export const requireSetupCreateMachine: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require XState machines to declare types (XState v5) or schemas (XState v6) on createMachine(), setup(), setupEffect() or system.setup().",
    },
    messages: {
      requireSetupCreateMachine: machineMessage,
      requireSetupTypes: setupMessage,
    },
    schema: [],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (importedName(context, node.callee) === "createMachine") {
          if (!mayDeclareTypes(node.arguments[0])) context.report({ node, messageId: "requireSetupCreateMachine" });
          return;
        }
        if (!isSetupCall(context, node) || mayDeclareTypes(node.arguments[0]) || typedDownstream(context, node)) return;
        context.report({ node, messageId: "requireSetupTypes", data: { callee: setupName(context, node) } });
      },
    };
  },
};
