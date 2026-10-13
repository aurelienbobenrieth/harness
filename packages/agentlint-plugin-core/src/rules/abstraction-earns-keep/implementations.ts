/** Resolves implementation evidence from captured source text, without filesystem reads. */
import { posix } from "node:path";
import { parseSync, type Expression, type Program, type TSType } from "oxc-parser";

type Reference = { readonly file: string; readonly name: string };
type Implementer = {
  readonly name: string;
  readonly members: readonly string[];
  readonly file: string;
  readonly kind: "class" | "object" | "factory";
};
type Implementation = Omit<Implementer, "file"> & { readonly types: readonly string[] };
type Module = {
  readonly imports: Map<string, Reference>;
  readonly exports: Map<string, Reference>;
  readonly stars: string[];
  readonly bases: Map<string, readonly string[]>;
  readonly implementations: Implementation[];
};

type EntityName = Extract<TSType, { type: "TSTypeReference" }>["typeName"];
const capturedModules = new WeakMap<Readonly<Record<string, string>>, ReadonlyMap<string, Module>>();

function entityName(node: EntityName | Expression): string | undefined {
  if (node.type === "Identifier") return node.name;
  if (node.type === "TSQualifiedName") {
    const left = entityName(node.left);
    return left === undefined ? undefined : `${left}.${node.right.name}`;
  }
  if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") {
    const left = entityName(node.object);
    return left === undefined ? undefined : `${left}.${node.property.name}`;
  }
  return undefined;
}

function references(type: TSType): readonly string[] {
  if (type.type === "TSTypeReference") {
    const name = entityName(type.typeName);
    return name === undefined ? [] : [name];
  }
  return type.type === "TSIntersectionType" ? type.types.flatMap(references) : [];
}

function objectMembers(expression: Expression): readonly string[] | undefined {
  if (expression.type === "ParenthesizedExpression") return objectMembers(expression.expression);
  if (
    expression.type !== "ObjectExpression" ||
    expression.properties.some((property) => property.type === "SpreadElement")
  )
    return undefined;
  const names: string[] = [];
  for (const property of expression.properties) {
    if (property.type !== "Property" || property.computed) return undefined;
    if (property.key.type === "Identifier") names.push(property.key.name);
    else if (property.key.type === "Literal" && typeof property.key.value === "string") names.push(property.key.value);
    else return undefined;
  }
  return names;
}

function returnedObject(
  body: Extract<Expression, { type: "ArrowFunctionExpression" }>["body"],
): readonly string[] | undefined {
  if (body.type !== "BlockStatement") return objectMembers(body);
  const locals = new Map<string, readonly string[]>();
  for (const statement of body.body) {
    if (statement.type === "VariableDeclaration" && statement.kind === "const") {
      for (const item of statement.declarations) {
        if (item.id.type !== "Identifier" || item.init === null) continue;
        const members = objectMembers(item.init);
        if (members !== undefined) locals.set(item.id.name, members);
      }
    }
    if (statement.type === "ReturnStatement" && statement.argument !== null) {
      const members =
        statement.argument.type === "Identifier"
          ? locals.get(statement.argument.name)
          : objectMembers(statement.argument);
      if (members !== undefined) return members;
    }
  }
  return undefined;
}

function moduleFacts(file: string, source: string): Module {
  const parsed = parseSync(file, source);
  if (parsed.errors.length > 0)
    throw new Error(`Cannot inspect abstraction implementations in ${file}: ${parsed.errors[0]?.message}`);
  const facts: Module = { imports: new Map(), exports: new Map(), stars: [], bases: new Map(), implementations: [] };
  const declaration = (node: Program["body"][number]): void => {
    if (node.type === "TSInterfaceDeclaration") {
      facts.bases.set(
        node.id.name,
        node.extends.flatMap((parent) => {
          const name = entityName(parent.expression);
          return name === undefined ? [] : [name];
        }),
      );
    } else if (node.type === "TSTypeAliasDeclaration") {
      facts.bases.set(node.id.name, references(node.typeAnnotation));
    } else if (node.type === "ClassDeclaration" && node.id !== null && !node.abstract && !node.declare) {
      const types = (node.implements ?? []).flatMap((type) => {
        const name = entityName(type.expression);
        return name === undefined ? [] : [name];
      });
      const members = node.body.body.flatMap((member) => {
        if (member.type !== "MethodDefinition" && member.type !== "PropertyDefinition") return [];
        if (
          member.static ||
          member.accessibility === "private" ||
          member.accessibility === "protected" ||
          (member.type === "MethodDefinition" && member.kind === "constructor")
        )
          return [];
        return member.key.type === "Identifier" ? [member.key.name] : [];
      });
      facts.implementations.push({ name: node.id.name, members, types, kind: "class" });
    } else if (
      node.type === "FunctionDeclaration" &&
      node.id !== null &&
      node.body !== null &&
      node.returnType !== null &&
      node.returnType !== undefined
    ) {
      const members = returnedObject(node.body);
      if (members !== undefined)
        facts.implementations.push({
          name: node.id.name,
          members,
          types: references(node.returnType.typeAnnotation),
          kind: "factory",
        });
    } else if (node.type === "VariableDeclaration") {
      for (const item of node.declarations) {
        if (item.id.type !== "Identifier" || item.init === null) continue;
        const value = item.init;
        const types =
          item.id.typeAnnotation === null || item.id.typeAnnotation === undefined
            ? []
            : [...references(item.id.typeAnnotation.typeAnnotation)];
        let members = objectMembers(value);
        if (value.type === "TSSatisfiesExpression") {
          types.push(...references(value.typeAnnotation));
          members = objectMembers(value.expression);
        } else if (
          (value.type === "ArrowFunctionExpression" || value.type === "FunctionExpression") &&
          value.returnType !== null &&
          value.returnType !== undefined &&
          value.body !== null
        ) {
          types.push(...references(value.returnType.typeAnnotation));
          members = returnedObject(value.body);
        }
        if (members !== undefined)
          facts.implementations.push({
            name: item.id.name,
            members,
            types: [...new Set(types)],
            kind:
              value.type === "ArrowFunctionExpression" || value.type === "FunctionExpression" ? "factory" : "object",
          });
      }
    }
  };
  for (const statement of parsed.program.body) {
    if (statement.type === "ImportDeclaration") {
      for (const specifier of statement.specifiers) {
        const name =
          specifier.type === "ImportSpecifier"
            ? specifier.imported.type === "Identifier"
              ? specifier.imported.name
              : String(specifier.imported.value)
            : specifier.type === "ImportNamespaceSpecifier"
              ? "*"
              : "default";
        facts.imports.set(specifier.local.name, { file: statement.source.value, name });
      }
    } else if (statement.type === "ExportNamedDeclaration") {
      for (const specifier of statement.specifiers) {
        const local = specifier.local.type === "Identifier" ? specifier.local.name : String(specifier.local.value);
        const exported =
          specifier.exported.type === "Identifier" ? specifier.exported.name : String(specifier.exported.value);
        facts.exports.set(exported, { file: statement.source?.value ?? file, name: local });
      }
      if (statement.declaration !== null) {
        declaration(statement.declaration);
        const value = statement.declaration;
        if (value.type === "TSInterfaceDeclaration" || value.type === "TSTypeAliasDeclaration")
          facts.exports.set(value.id.name, { file, name: value.id.name });
      }
    } else if (statement.type === "ExportAllDeclaration") {
      facts.stars.push(statement.source.value);
    } else declaration(statement);
  }
  return facts;
}

function importedFile(file: string, specifier: string, modules: ReadonlyMap<string, Module>): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const base = posix.normalize(posix.join(posix.dirname(file), specifier));
  if (modules.has(base)) return base;
  const stem = base.replace(/\.(?:js|jsx|mjs|cjs)$/, "");
  return [".ts", ".tsx", ".mts", ".cts", "/index.ts", "/index.tsx"]
    .map((extension) => `${stem}${extension}`)
    .find((candidate) => modules.has(candidate));
}

/** Includes only identities proven through local declarations or captured relative imports. */
export function implementationIndex(file: string, source: string, dependencies: Readonly<Record<string, string>>) {
  let captured = capturedModules.get(dependencies);
  if (captured === undefined) {
    captured = new Map(Object.entries(dependencies).map(([path, text]) => [path, moduleFacts(path, text)]));
    capturedModules.set(dependencies, captured);
  }
  const modules = new Map(captured);
  if (dependencies[file] !== source) modules.set(file, moduleFacts(file, source));
  const exported = (target: string, name: string, seen: Set<string>): Reference | undefined => {
    const key = `${target}#export:${name}`;
    if (seen.has(key)) return undefined;
    seen.add(key);
    const facts = modules.get(target);
    const ref = facts?.exports.get(name);
    if (ref) {
      if (ref.file === target) return resolve(target, ref.name, seen);
      const next = importedFile(target, ref.file, modules);
      return next === undefined ? undefined : exported(next, ref.name, seen);
    }
    const candidates =
      facts?.stars.flatMap((specifier) => {
        const next = importedFile(target, specifier, modules);
        const result = next === undefined ? undefined : exported(next, name, new Set(seen));
        return result === undefined ? [] : [result];
      }) ?? [];
    const distinct = new Map(candidates.map((candidate) => [`${candidate.file}#${candidate.name}`, candidate]));
    return distinct.size === 1 ? [...distinct.values()][0] : undefined;
  };
  const resolve = (target: string, name: string, seen: Set<string>): Reference | undefined => {
    const key = `${target}#${name}`;
    if (seen.has(key)) return undefined;
    seen.add(key);
    const facts = modules.get(target);
    if (facts?.bases.has(name)) return { file: target, name };
    const [local, member] = name.split(".");
    const imported = facts?.imports.get(local ?? "");
    if (!imported) return undefined;
    const next = importedFile(target, imported.file, modules);
    const symbol = imported.name === "*" ? member : imported.name;
    return next === undefined || symbol === undefined ? undefined : exported(next, symbol, seen);
  };
  const derives = (ref: Reference, target: Reference, seen: Set<string>): boolean => {
    if (ref.file === target.file && ref.name === target.name) return true;
    const key = `${ref.file}#${ref.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return (modules.get(ref.file)?.bases.get(ref.name) ?? []).some((base) => {
      const parent = resolve(ref.file, base, new Set());
      return parent !== undefined && derives(parent, target, seen);
    });
  };
  return (name: string): readonly Implementer[] => {
    const target = resolve(file, name, new Set());
    if (!target) return [];
    return [...modules].flatMap(([path, facts]) =>
      facts.implementations
        .filter((implementation) =>
          implementation.types.some((type) => {
            const ref = resolve(path, type, new Set());
            return ref !== undefined && derives(ref, target, new Set());
          }),
        )
        .map((implementation) => ({ ...implementation, file: path })),
    );
  };
}
