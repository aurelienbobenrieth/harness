import type { Context, ESTree, Rule } from "@oxlint/plugins";
import {
  importedSpecifierName,
  optionsObject,
  stringLiteralValue,
  unwrapExpression,
} from "@aurelienbbn/oxlint-kit/ast";
import { moduleMethod } from "../binding-support.js";

const defaultSuffix = "Error";
const schemaConstructors: ReadonlySet<string> = new Set(["TaggedError", "TaggedErrorClass"]);

/** The Effect member a callee denotes, through `<Module>.<member>` (namespace or root import) or a named import. */
function effectMember(context: Context, callee: ESTree.Node, moduleName: "Data" | "Schema"): string | undefined {
  return (
    moduleMethod(context, callee, moduleName) ??
    importedSpecifierName(context, callee, (source) => source === `effect/${moduleName}`)
  );
}

/**
 * The tag argument of a tagged error superclass: `Schema.TaggedError<Self>()(tag, ...)`,
 * `Schema.TaggedErrorClass<Self>()(tag, ...)` or `Data.TaggedError(tag)`. `undefined` when the superclass is not one
 * of them; `{ tag: undefined }` when it is, but without a tag argument.
 */
export function taggedErrorSuperclass(
  context: Context,
  superClass: ESTree.Node,
): { readonly tag: ESTree.Node | undefined; readonly call: ESTree.CallExpression } | undefined {
  const call = unwrapExpression(superClass);
  if (call.type !== "CallExpression") return undefined;
  const [tag] = call.arguments;
  const curried = call.callee.type === "CallExpression" ? call.callee.callee : undefined;
  if (curried !== undefined && schemaConstructors.has(effectMember(context, curried, "Schema") ?? ""))
    return { tag, call };
  return effectMember(context, call.callee, "Data") === "TaggedError" ? { tag, call } : undefined;
}

/**
 * A tag equals the class name, or qualifies it with a namespace so tags stay unique across packages
 * (`"git/GitError"`, `"GCP.SQL.InstanceFailed"`, `"NeonOperationPending"`): the class name still ends the tag.
 */
function tagNamesClass(tag: string, name: string): boolean {
  if (!tag.endsWith(name)) return false;
  const prefix = tag.slice(0, tag.length - name.length);
  return prefix === "" || !/[A-Za-z0-9]$/u.test(prefix) || /^[A-Z]/u.test(name);
}

function suffixOption(context: Context): string {
  const suffix = optionsObject(context)["suffix"];
  return typeof suffix === "string" ? suffix : defaultSuffix;
}

/**
 * Keep tagged error classes recognizable: the class name carries the error suffix and its `_tag` repeats the class
 * name (or ends with it after a namespace prefix), so `catchTag("NotFoundError")` greps straight to `class NotFoundError`. Set `suffix` to an empty string to keep only the tag check.
 */
export const taggedErrorName: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require classes extending Schema.TaggedError, Schema.TaggedErrorClass, or Data.TaggedError to end with the error suffix and to use their class name as the literal _tag.",
    },
    messages: {
      missingSuffix:
        'Rename the tagged error class "{{name}}" to end with "{{suffix}}", and set its _tag to the new name.',
      tagMismatch:
        'Change the _tag "{{tag}}" to "{{name}}": a tagged error\'s _tag equals its class name, so catchTag("{{name}}") leads back to the class.',
    },
    schema: [
      {
        type: "object",
        properties: { suffix: { type: "string" } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ suffix: defaultSuffix }],
  },
  createOnce(context) {
    function check(node: ESTree.Class): void {
      if (node.id === null || node.superClass === null) return;
      const superclass = taggedErrorSuperclass(context, node.superClass);
      if (superclass === undefined) return;

      const name = node.id.name;
      const suffix = suffixOption(context);
      if (!name.endsWith(suffix)) context.report({ node: node.id, messageId: "missingSuffix", data: { name, suffix } });

      const tag = stringLiteralValue(superclass.tag);
      if (superclass.tag !== undefined && tag !== undefined && !tagNamesClass(tag, name))
        context.report({ node: superclass.tag, messageId: "tagMismatch", data: { tag, name } });
    }

    return { ClassDeclaration: check, ClassExpression: check };
  },
};
