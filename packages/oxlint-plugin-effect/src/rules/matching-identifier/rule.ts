import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { moduleMethod, optionsObject, stringArrayOption, stringLiteralValue } from "../sota-support.js";

type IdentifierKind = "tag" | "path";

type IdentifierSite = {
  readonly kind: IdentifierKind;
  readonly literal: ESTree.Node;
  readonly value: string;
};

const factories: Readonly<Record<string, readonly string[]>> = {
  Context: ["Service"],
  Data: ["TaggedClass", "TaggedError"],
  Schema: ["Class", "Error", "TaggedClass", "TaggedError"],
};

const pathSeparators = /[/.:#]/u;

function literalSite(kind: IdentifierKind, node: ESTree.Node | undefined): IdentifierSite | undefined {
  const value = stringLiteralValue(node);
  return node === undefined || value === undefined ? undefined : { kind, literal: node, value };
}

function factoryCalls(superClass: ESTree.Node): readonly ESTree.CallExpression[] {
  const calls: ESTree.CallExpression[] = [];
  let current: ESTree.Node = superClass;
  while (current.type === "CallExpression") {
    calls.unshift(current);
    current = current.callee;
  }
  return calls;
}

function identifierSites(
  moduleName: string,
  member: string,
  calls: readonly ESTree.CallExpression[],
): readonly (IdentifierSite | undefined)[] {
  const first = calls[0]?.arguments[0];
  const second = calls[1]?.arguments[0];
  if (moduleName === "Data") return [literalSite("tag", first)];
  if (moduleName === "Context") return [literalSite("path", first) ?? literalSite("path", second)];
  if (member === "Class" || member === "Error") return [literalSite("path", first)];
  return [literalSite("path", first), literalSite("tag", second)];
}

function lastSegment(value: string): string {
  return value.split(pathSeparators).at(-1) ?? "";
}

function matches(site: IdentifierSite, className: string, suffixes: readonly string[]): boolean {
  const candidate = lastSegment(site.value);
  if (candidate === className) return true;
  return suffixes.some(
    (suffix) =>
      className.length > suffix.length &&
      className.endsWith(suffix) &&
      className.slice(0, -suffix.length) === candidate,
  );
}

function replacement(site: IdentifierSite, className: string): string {
  return `${site.value.slice(0, site.value.length - lastSegment(site.value).length)}${className}`;
}

function selfTypeName(call: ESTree.CallExpression): (ESTree.Node & { readonly name: string }) | undefined {
  const self = call.typeArguments?.params[0];
  if (self?.type !== "TSTypeReference" || self.typeName.type !== "Identifier") return undefined;
  return self.typeName;
}

function resolveFactory(context: Context, callee: ESTree.Node): readonly [string, string] | undefined {
  for (const [moduleName, members] of Object.entries(factories)) {
    const member = moduleMethod(context, callee, moduleName);
    if (member !== undefined && members.includes(member)) return [moduleName, member];
  }
  return undefined;
}

/**
 * Keep the string identity of Effect services, schema classes and tagged errors in sync with the owning class.
 *
 * @attribution @effect/language-service classSelfMismatch and deterministicKeys diagnostics (concept)
 * @attribution Effect bundled AGENTS.md service-key and error-tag convention (concept)
 */
export const matchingIdentifier: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require Context.Service keys, Schema class identifiers, tagged error tags, and Self type arguments to name the class that declares them.",
    },
    hasSuggestions: true,
    messages: {
      identifier:
        'Rename "{{value}}" to end with the class name {{className}}: a copied {{what}} makes two classes share one runtime identity.',
      self: "Pass {{className}} as the Self type argument: {{actual}} belongs to another class.",
      rename: 'Replace with "{{replacement}}".',
    },
    schema: [
      {
        type: "object",
        properties: {
          ignore: { type: "array", items: { type: "string" } },
          stripSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ ignore: [], stripSuffixes: [] }],
  },
  createOnce(context) {
    function check(node: ESTree.Class): void {
      if (node.id === null || node.superClass === null) return;
      const calls = factoryCalls(node.superClass);
      const root = calls[0];
      if (root === undefined) return;
      const factory = resolveFactory(context, root.callee);
      if (factory === undefined) return;

      const options = optionsObject(context);
      const className = node.id.name;
      if (stringArrayOption(options, "ignore", []).includes(className)) return;
      const suffixes = stringArrayOption(options, "stripSuffixes", []);

      const self = selfTypeName(root);
      if (self !== undefined && self.name !== className) {
        context.report({ node: self, messageId: "self", data: { className, actual: self.name } });
      }

      for (const site of identifierSites(factory[0], factory[1], calls)) {
        if (site === undefined || matches(site, className, suffixes)) continue;
        const next = replacement(site, className);
        context.report({
          node: site.literal,
          messageId: "identifier",
          data: { value: site.value, className, what: site.kind === "tag" ? "tag" : "key" },
          suggest: [
            {
              messageId: "rename",
              data: { replacement: next },
              fix: (fixer) => fixer.replaceText(site.literal, JSON.stringify(next)),
            },
          ],
        });
      }
    }

    return {
      ClassDeclaration: check,
      ClassExpression: check,
    };
  },
};
