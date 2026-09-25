import type { Context, ESTree } from "@oxlint/plugins";
import { describe, expect, it } from "vitest";
import {
  binding,
  importedNameFrom,
  importedSpecifierName,
  isFunctionNode,
  memberPropertyName,
  nearestFunction,
  optionsObject,
  parentOf,
  propertyKeyName,
  stringLiteralValue,
  unwrapExpression,
  unwrapExpressionKeepingChain,
  walk,
} from "./ast.js";

/** Hand-built ESTree fragments: only the fields a helper reads are present. */
function node(fields: Record<string, unknown>): ESTree.Node {
  return fields as unknown as ESTree.Node;
}

/** Set the `parent` links oxlint would set, so parent-walking helpers can run. */
function withParents(root: ESTree.Node): ESTree.Node {
  walk(root, (parent) => {
    for (const [key, value] of Object.entries(parent)) {
      if (key === "parent") continue;
      for (const child of Array.isArray(value) ? value : [value])
        if (typeof child === "object" && child !== null && "type" in child) Object.assign(child, { parent });
    }
  });
  return root;
}

const identifier = (name: string) => node({ type: "Identifier", name });
const literal = (value: unknown) => node({ type: "Literal", value });

type FakeDefinition = { readonly node: ESTree.Node; readonly parent?: ESTree.Node };

/** A context whose scope chain is `scopes[0]` (innermost) up to the last entry. */
function contextWithScopes(...scopes: readonly Record<string, readonly FakeDefinition[]>[]): Context {
  const chain = scopes.reduceRight<unknown>(
    (upper, variables) => ({
      upper,
      set: new Map(Object.entries(variables).map(([name, defs]) => [name, { name, defs }])),
    }),
    null,
  );
  return { sourceCode: { getScope: () => chain } } as unknown as Context;
}

function importOf(source: string, specifier: ESTree.Node): FakeDefinition {
  return { node: specifier, parent: node({ type: "ImportDeclaration", source: { value: source } }) };
}

const named = (imported: string) => node({ type: "ImportSpecifier", imported: identifier(imported) });
const namespace = node({ type: "ImportNamespaceSpecifier" });
const defaultImport = node({ type: "ImportDefaultSpecifier" });
const member = (object: string, property: string) =>
  node({ type: "MemberExpression", computed: false, object: identifier(object), property: identifier(property) });

describe("isFunctionNode", () => {
  it("accepts every function form with a body", () => {
    for (const type of ["ArrowFunctionExpression", "FunctionDeclaration", "FunctionExpression"])
      expect(isFunctionNode(node({ type }))).toBe(true);
  });

  it("rejects other nodes and missing nodes", () => {
    expect(isFunctionNode(node({ type: "TSDeclareFunction" }))).toBe(false);
    expect(isFunctionNode(null)).toBe(false);
    expect(isFunctionNode(undefined)).toBe(false);
  });
});

describe("parentOf and nearestFunction", () => {
  const inner = identifier("x");
  const outer = withParents(
    node({
      type: "FunctionDeclaration",
      body: node({ type: "BlockStatement", body: [node({ type: "ExpressionStatement", expression: inner })] }),
    }),
  );

  it("climbs to the closest enclosing function", () => {
    expect(parentOf(inner)?.type).toBe("ExpressionStatement");
    expect(nearestFunction(inner)).toBe(outer);
  });

  it("returns undefined at the root and never returns the node itself", () => {
    expect(parentOf(outer)).toBeUndefined();
    expect(nearestFunction(outer)).toBeUndefined();
  });
});

describe("unwrapExpression", () => {
  const target = identifier("value");
  const chain = node({ type: "ChainExpression", expression: target });
  const wrapped = node({
    type: "TSAsExpression",
    expression: node({
      type: "ParenthesizedExpression",
      expression: node({ type: "TSNonNullExpression", expression: chain }),
    }),
  });

  it("strips type wrappers, parentheses, and optional chains", () => {
    expect(unwrapExpression(wrapped)).toBe(target);
  });

  it("keeps an optional chain in the chain-preserving variant", () => {
    expect(unwrapExpressionKeepingChain(wrapped)).toBe(chain);
  });

  it("returns an unwrapped node unchanged", () => {
    expect(unwrapExpression(target)).toBe(target);
    expect(unwrapExpressionKeepingChain(target)).toBe(target);
  });
});

describe("stringLiteralValue", () => {
  it("reads string literals and substitution-free templates", () => {
    expect(stringLiteralValue(literal("a"))).toBe("a");
    expect(
      stringLiteralValue(node({ type: "TemplateLiteral", expressions: [], quasis: [{ value: { cooked: "b" } }] })),
    ).toBe("b");
  });

  it("ignores non-string literals, templates with substitutions, and missing nodes", () => {
    expect(stringLiteralValue(literal(1))).toBeUndefined();
    expect(
      stringLiteralValue(node({ type: "TemplateLiteral", expressions: [identifier("x")], quasis: [] })),
    ).toBeUndefined();
    expect(stringLiteralValue(null)).toBeUndefined();
  });
});

describe("propertyKeyName", () => {
  it("names identifier and string keys of properties and class members", () => {
    expect(propertyKeyName(node({ type: "Property", computed: false, key: identifier("a") }))).toBe("a");
    expect(propertyKeyName(node({ type: "Property", computed: false, key: literal("b") }))).toBe("b");
    expect(propertyKeyName(node({ type: "MethodDefinition", computed: false, key: identifier("c") }))).toBe("c");
  });

  it("returns undefined for computed keys and other nodes", () => {
    expect(propertyKeyName(node({ type: "Property", computed: true, key: literal("a") }))).toBeUndefined();
    expect(propertyKeyName(identifier("a"))).toBeUndefined();
  });
});

describe("memberPropertyName", () => {
  it("names a non-computed member", () => {
    expect(memberPropertyName(member("a", "b"))).toBe("b");
  });

  it("returns undefined for computed members and other nodes", () => {
    expect(
      memberPropertyName(
        node({ type: "MemberExpression", computed: true, object: identifier("a"), property: identifier("b") }),
      ),
    ).toBeUndefined();
    expect(memberPropertyName(identifier("a"))).toBeUndefined();
  });
});

describe("walk", () => {
  const skipped = identifier("skipped");
  const tree = withParents(
    node({
      type: "Program",
      body: [
        node({ type: "ExpressionStatement", expression: identifier("kept") }),
        node({ type: "BlockStatement", body: [skipped] }),
      ],
    }),
  );

  it("visits every node depth-first without following parent links", () => {
    const seen: string[] = [];
    walk(tree, (visited) => {
      seen.push(visited.type === "Identifier" ? visited.name : visited.type);
    });
    expect(seen).toEqual(["Program", "ExpressionStatement", "kept", "BlockStatement", "skipped"]);
  });

  it("skips the children of a node when the visitor returns false", () => {
    const seen: string[] = [];
    walk(tree, (visited) => {
      seen.push(visited.type);
      return visited.type !== "BlockStatement";
    });
    expect(seen).toEqual(["Program", "ExpressionStatement", "Identifier", "BlockStatement"]);
  });
});

describe("binding", () => {
  it("resolves the innermost declaration of a name", () => {
    const inner = { node: identifier("inner") };
    const outer = { node: identifier("outer") };
    const context = contextWithScopes({ x: [inner] }, { x: [outer], y: [outer] });
    expect(binding(context, identifier("x"), "x")?.defs).toEqual([inner]);
    expect(binding(context, identifier("y"), "y")?.defs).toEqual([outer]);
  });

  it("returns undefined for an unknown name", () => {
    expect(binding(contextWithScopes({}), identifier("x"), "x")).toBeUndefined();
  });
});

describe("importedNameFrom", () => {
  const context = contextWithScopes({
    alias: [importOf("pkg", named("original"))],
    ns: [importOf("pkg", namespace)],
    def: [importOf("pkg", defaultImport)],
    other: [importOf("elsewhere", named("original"))],
  });

  it("resolves named, default, namespace-member, and default-member references", () => {
    expect(importedNameFrom(context, identifier("alias"), ["pkg"])).toBe("original");
    expect(importedNameFrom(context, identifier("def"), ["pkg"])).toBe("default");
    expect(importedNameFrom(context, member("ns", "run"), ["pkg"])).toBe("run");
    expect(importedNameFrom(context, member("def", "run"), ["pkg"])).toBe("run");
  });

  it("looks through type wrappers", () => {
    expect(
      importedNameFrom(context, node({ type: "TSNonNullExpression", expression: identifier("alias") }), ["pkg"]),
    ).toBe("original");
  });

  it("ignores other sources and unbound names", () => {
    expect(importedNameFrom(context, identifier("other"), ["pkg"])).toBeUndefined();
    expect(importedNameFrom(context, identifier("missing"), ["pkg"])).toBeUndefined();
  });
});

const isPkg = (source: string) => source === "pkg";

describe("importedSpecifierName", () => {
  const context = contextWithScopes({
    alias: [importOf("pkg", named("original"))],
    ns: [importOf("pkg", namespace)],
    def: [importOf("pkg", defaultImport)],
  });

  it("resolves named imports and namespace members", () => {
    expect(importedSpecifierName(context, identifier("alias"), isPkg)).toBe("original");
    expect(importedSpecifierName(context, member("ns", "run"), isPkg)).toBe("run");
  });

  it("never matches default imports, wrapped nodes, or rejected sources", () => {
    expect(importedSpecifierName(context, identifier("def"), isPkg)).toBeUndefined();
    expect(importedSpecifierName(context, member("def", "run"), isPkg)).toBeUndefined();
    expect(
      importedSpecifierName(context, node({ type: "TSNonNullExpression", expression: identifier("alias") }), isPkg),
    ).toBeUndefined();
    expect(importedSpecifierName(context, identifier("alias"), () => false)).toBeUndefined();
  });
});

describe("optionsObject", () => {
  it("returns the first option when it is an object", () => {
    expect(optionsObject({ options: [{ allow: [] }] } as unknown as Context)).toEqual({ allow: [] });
  });

  it("falls back to an empty object", () => {
    expect(optionsObject({ options: ["string"] } as unknown as Context)).toEqual({});
    expect(optionsObject({} as unknown as Context)).toEqual({});
  });
});
