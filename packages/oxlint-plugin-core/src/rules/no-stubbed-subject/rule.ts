import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { resolveVariable, unwrapExpression } from "../ast-support.js";
import { getFilename, type RuleContextWithFilename } from "../filename-support.js";
import { testApi } from "../test-api-support.js";

const testFileStemPattern = /([^/]+)\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const stubbingMethodPattern = /^mock(?:ReturnValue|ResolvedValue|RejectedValue|Implementation)(?:Once)?$/u;

/** `./cart`, `../cart.js` and `./cart/index` all name the module `cart`; bare package specifiers name none. */
function relativeModuleStem(specifier: string): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const segments = specifier
    .replace(/\.[cm]?[jt]sx?$/u, "")
    .split("/")
    .filter((segment) => segment !== "");
  if (segments.at(-1) === "index") segments.pop();
  const stem = segments.at(-1);
  return stem === undefined || stem === "." || stem === ".." ? undefined : stem;
}

/** The module specifier behind a namespace or default import binding. */
function importedModule(context: Context, node: ESTree.Node | undefined): string | undefined {
  if (node === undefined) return undefined;
  const variable = resolveVariable(context, unwrapExpression(node));
  for (const definition of variable?.defs ?? []) {
    if (definition.parent?.type !== "ImportDeclaration" || definition.parent.importKind === "type") continue;
    if (definition.node.type === "ImportNamespaceSpecifier" || definition.node.type === "ImportDefaultSpecifier")
      return String(definition.parent.source.value);
  }
  return undefined;
}

function stubbingMethod(member: ESTree.Node | null | undefined): string | undefined {
  if (member?.type !== "MemberExpression" || member.computed || member.property.type !== "Identifier") return undefined;
  if (member.parent?.type !== "CallExpression" || member.parent.callee !== member) return undefined;
  return stubbingMethodPattern.test(member.property.name) ? member.property.name : undefined;
}

/** Follows `spy.a().b()` upward from the spy expression and returns the first canned-behavior method. */
function chainedStub(spy: ESTree.Node): string | undefined {
  let current: ESTree.Node = spy;
  for (;;) {
    const member = current.parent;
    if (member?.type !== "MemberExpression" || member.object !== current) return undefined;
    const method = stubbingMethod(member);
    if (method !== undefined) return method;
    if (member.parent?.type !== "CallExpression" || member.parent.callee !== member) return undefined;
    current = member.parent;
  }
}

/** `const spy = vi.spyOn(...)` followed by `spy.mockReturnValue(...)` is the same stub written in two statements. */
function bindingStub(context: Context, spy: ESTree.CallExpression): string | undefined {
  const declarator = spy.parent;
  if (declarator?.type !== "VariableDeclarator" || declarator.init !== spy || declarator.id.type !== "Identifier")
    return undefined;
  for (const reference of resolveVariable(context, declarator.id)?.references ?? []) {
    const method = chainedStub(reference.identifier as ESTree.Node);
    if (method !== undefined) return method;
  }
  return undefined;
}

export const noStubbedSubject: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a `<stem>.test` file from replacing behavior of its own `<stem>` module through `vi.spyOn(...)` followed by a canned return value or implementation.",
    },
    messages: {
      stubbedSubject:
        'This test stubs "{{member}}" on "{{source}}", the module this file exists to test, through {{method}}: the assertion then checks the stub. Call the real function and replace only the collaborators it depends on; a spy without canned behavior stays allowed.',
    },
  },
  create(context) {
    const stem = testFileStemPattern.exec(getFilename(context as RuleContextWithFilename))?.[1];
    if (stem === undefined) return {};

    return {
      CallExpression(node) {
        if (testApi(context as Context, node.callee) !== "vi.spyOn") return;
        const source = importedModule(context as Context, node.arguments[0]);
        if (source === undefined || relativeModuleStem(source) !== stem) return;
        const method = chainedStub(node) ?? bindingStub(context as Context, node);
        if (method === undefined) return;
        const member = node.arguments[1];
        context.report({
          node,
          messageId: "stubbedSubject",
          data: {
            member: member?.type === "Literal" ? String(member.value) : "a member",
            source,
            method,
          },
        });
      },
    };
  },
};
