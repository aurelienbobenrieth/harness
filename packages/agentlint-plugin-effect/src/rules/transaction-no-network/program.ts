import { readdirSync, readFileSync, statSync } from "node:fs";
import { posix } from "node:path";
import { parseSync } from "oxc-parser";
import { type AstNode, field, identifierName, isNode, listField, nodeField, stringField } from "./ast.js";

/**
 * How a rule sees the checkout: file text by repository-relative POSIX path, the files of one
 * workspace member or of all of them, and which member a file belongs to (the nearest folder with a
 * `package.json`).
 */
export interface Repo {
  readonly read: (file: string) => string | undefined;
  readonly list: (member: string) => readonly string[];
  readonly all: () => readonly string[];
  readonly memberOf: (file: string) => string;
}

/** Generated or vendored; a folder starting with a dot (`.alchemy`, `.next`, `.wrangler`) is never source either. */
const SKIPPED_FOLDERS: ReadonlySet<string> = new Set(["node_modules", "dist", "build", "coverage"]);
const SOURCE_FILE = /\.[cm]?[jt]sx?$/u;
const MAX_LISTED_FILES = 20_000;

/** A repository read from disk below `root`; `list` stops at nested workspace members. */
export const diskRepo = (root: string): Repo => {
  const members = new Map<string, string>();
  const exists = (rel: string): boolean => {
    try {
      return statSync(`${root}/${rel}`).isFile();
    } catch {
      return false;
    }
  };
  const memberOf = (file: string): string => {
    let dir = posix.dirname(file);
    const trail: string[] = [];
    for (;;) {
      const known = members.get(dir);
      if (known !== undefined) {
        for (const seen of trail) members.set(seen, known);
        return known;
      }
      trail.push(dir);
      if (exists(dir === "." ? "package.json" : `${dir}/package.json`) || dir === ".") {
        for (const seen of trail) members.set(seen, dir === "." ? "" : dir);
        return dir === "." ? "" : dir;
      }
      dir = posix.dirname(dir);
    }
  };

  const sources = (start: string, enters: (folder: string) => boolean): readonly string[] => {
    const found: string[] = [];
    const visit = (dir: string): void => {
      let entries;
      try {
        entries = readdirSync(dir === "" ? root : `${root}/${dir}`, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const rel = dir === "" ? entry.name : `${dir}/${entry.name}`;
        if (found.length >= MAX_LISTED_FILES) return;
        if (entry.isDirectory()) {
          if (!entry.name.startsWith(".") && !SKIPPED_FOLDERS.has(entry.name) && enters(rel)) visit(rel);
        } else if (SOURCE_FILE.test(entry.name) && !entry.name.endsWith(".d.ts")) {
          found.push(rel);
        }
      }
    };
    visit(start);
    return found;
  };

  return {
    all: () => sources("", () => true),
    list: (member) => sources(member, (folder) => !exists(`${folder}/package.json`)),
    memberOf,
    read: (file) => {
      try {
        return readFileSync(`${root}/${file}`, "utf8");
      } catch {
        return undefined;
      }
    },
  };
};

/** Where the checkout lives when agentlint hands real files; none for fixtures held in memory. */
export const rootOf = (path: string, absolutePath: string): string | undefined => {
  const absolute = absolutePath.replaceAll("\\", "/");
  return absolute !== path && absolute.endsWith(`/${path}`)
    ? absolute.slice(0, absolute.length - path.length - 1)
    : undefined;
};

/** A repository held in memory (fixtures and tests): `files` maps relative paths to text. */
export const memoryRepo = (files: Readonly<Record<string, string>>): Repo => ({
  all: () => Object.keys(files).filter((file) => SOURCE_FILE.test(file)),
  list: (member) =>
    Object.keys(files).filter(
      (file) =>
        (member === "" || file.startsWith(`${member}/`)) &&
        SOURCE_FILE.test(file) &&
        memoryMember(files, file) === member,
    ),
  memberOf: (file) => memoryMember(files, file),
  read: (file) => (Object.hasOwn(files, file) ? files[file] : undefined),
});

const memoryMember = (files: Readonly<Record<string, string>>, file: string): string => {
  let dir = posix.dirname(file);
  while (dir !== ".") {
    if (Object.hasOwn(files, `${dir}/package.json`)) return dir;
    dir = posix.dirname(dir);
  }
  return "";
};

/** A name an import brings into a file. `imported` is `*` for a namespace import. */
interface ImportBinding {
  readonly from: string;
  readonly imported: string;
  readonly typeOnly: boolean;
}

/** Where a name is declared. */
export interface Declaration {
  readonly file: string;
  readonly name: string;
  readonly node: AstNode;
}

interface Forward {
  readonly from: string;
  readonly imported: string;
}

/** A parsed file: its top-level declarations, imports and exports. */
interface Module {
  readonly file: string;
  readonly text: string;
  readonly body: readonly AstNode[];
  readonly imports: ReadonlyMap<string, ImportBinding>;
  readonly top: ReadonlyMap<string, AstNode>;
  readonly exported: ReadonlyMap<string, string | Forward>;
  readonly stars: readonly string[];
}

const patternNames = (pattern: AstNode | undefined): readonly string[] => {
  if (pattern === undefined) return [];
  switch (pattern.type) {
    case "Identifier":
      return [identifierName(pattern) ?? ""];
    case "ObjectPattern":
      return listField(pattern, "properties").flatMap((property) =>
        property.type === "RestElement"
          ? patternNames(nodeField(property, "argument"))
          : patternNames(nodeField(property, "value")),
      );
    case "ArrayPattern":
      return (field(pattern, "elements") as readonly unknown[])
        .filter(isNode)
        .flatMap((element) => patternNames(element));
    case "AssignmentPattern":
      return patternNames(nodeField(pattern, "left"));
    case "RestElement":
      return patternNames(nodeField(pattern, "argument"));
    default:
      return [];
  }
};

const literalValue = (node: AstNode | undefined): string | undefined =>
  node === undefined ? undefined : stringField(node, "value");

/** The syntax tree of `text`; the grammar follows the extension of `file` (`.ts` and `.tsx` differ on `<T>(x) =>`). */
export const parseTree = (file: string, text: string): AstNode => parseSync(file, text).program as unknown as AstNode;

const moduleOf = (file: string, text: string): Module => {
  const body = listField(parseTree(file, text), "body");
  const imports = new Map<string, ImportBinding>();
  const top = new Map<string, AstNode>();
  const exported = new Map<string, string | Forward>();
  const stars: string[] = [];

  const declare = (declaration: AstNode | undefined, exportedAs?: "named" | "default"): void => {
    if (declaration === undefined) return;
    const names: string[] = [];
    if (declaration.type === "VariableDeclaration") {
      for (const declarator of listField(declaration, "declarations")) {
        for (const name of patternNames(nodeField(declarator, "id"))) {
          top.set(name, declarator);
          names.push(name);
        }
      }
    } else {
      const name = identifierName(nodeField(declaration, "id"));
      if (name !== undefined) {
        top.set(name, declaration);
        names.push(name);
      }
    }
    if (exportedAs === "named") for (const name of names) exported.set(name, name);
    if (exportedAs === "default") {
      if (names[0] === undefined) top.set("default", declaration);
      exported.set("default", names[0] ?? "default");
    }
  };

  for (const statement of body) {
    switch (statement.type) {
      case "ImportDeclaration": {
        const from = literalValue(nodeField(statement, "source")) ?? "";
        const declaredTypeOnly = stringField(statement, "importKind") === "type";
        for (const specifier of listField(statement, "specifiers")) {
          const local = identifierName(nodeField(specifier, "local"));
          if (local === undefined) continue;
          const typeOnly = declaredTypeOnly || stringField(specifier, "importKind") === "type";
          const imported =
            specifier.type === "ImportNamespaceSpecifier"
              ? "*"
              : specifier.type === "ImportDefaultSpecifier"
                ? "default"
                : (identifierName(nodeField(specifier, "imported")) ??
                  literalValue(nodeField(specifier, "imported")) ??
                  local);
          imports.set(local, { from, imported, typeOnly });
        }
        break;
      }
      case "ExportAllDeclaration": {
        const from = literalValue(nodeField(statement, "source"));
        const as = nodeField(statement, "exported");
        if (from === undefined) break;
        if (as === undefined || as === null) stars.push(from);
        else exported.set(identifierName(as) ?? literalValue(as) ?? "", { from, imported: "*" });
        break;
      }
      case "ExportNamedDeclaration": {
        const declaration = nodeField(statement, "declaration");
        if (declaration !== undefined) {
          declare(declaration, "named");
          break;
        }
        const from = literalValue(nodeField(statement, "source"));
        for (const specifier of listField(statement, "specifiers")) {
          const local = identifierName(nodeField(specifier, "local")) ?? literalValue(nodeField(specifier, "local"));
          const name =
            identifierName(nodeField(specifier, "exported")) ?? literalValue(nodeField(specifier, "exported")) ?? local;
          if (local === undefined || name === undefined) continue;
          exported.set(name, from === undefined ? local : { from, imported: local });
        }
        break;
      }
      case "ExportDefaultDeclaration": {
        const declaration = nodeField(statement, "declaration");
        if (declaration?.type === "Identifier") {
          exported.set("default", identifierName(declaration) ?? "default");
        } else if (declaration?.type === "FunctionDeclaration" || declaration?.type === "ClassDeclaration") {
          declare(declaration, "default");
        } else if (declaration !== undefined) {
          top.set("default", declaration);
          exported.set("default", "default");
        }
        break;
      }
      default:
        declare(statement);
    }
  }

  return { body, exported, file, imports, stars, text, top };
};

const EXTENSIONS = ["", ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", "/index.ts", "/index.tsx", "/index.js"];
const JS_TO_TS = /\.([cm]?)js$/u;
const MAX_REEXPORT_DEPTH = 8;

/** The checkout as the rule walks it: files parsed once, relative imports resolved, names followed through re-exports. */
export interface Program {
  readonly repo: Repo;
  readonly module: (file: string) => Module | undefined;
  readonly resolve: (from: string, specifier: string) => string | undefined;
  readonly declaration: (file: string, name: string, depth?: number) => Declaration | undefined;
  readonly invalidate: (file: string) => void;
}

/** A program over `repo`; one per detector run. */
export const programOf = (repo: Repo): Program => {
  const modules = new Map<string, Module | undefined>();
  const module = (file: string): Module | undefined => {
    if (!modules.has(file)) {
      const text = repo.read(file);
      modules.set(file, text === undefined ? undefined : moduleOf(file, text));
    }
    return modules.get(file);
  };
  const resolve = (from: string, specifier: string): string | undefined => {
    if (!specifier.startsWith(".")) return undefined;
    const base = posix.normalize(posix.join(posix.dirname(from), specifier));
    const bases = [base, base.replace(JS_TO_TS, ".$1ts"), base.replace(JS_TO_TS, ".$1tsx")];
    for (const candidate of bases) {
      for (const extension of EXTENSIONS) {
        const file = `${candidate}${extension}`;
        if (SOURCE_FILE.test(file) && repo.read(file) !== undefined) return file;
      }
    }
    return undefined;
  };
  const declaration = (file: string, name: string, depth = 0): Declaration | undefined => {
    const found = module(file);
    if (found === undefined || depth > MAX_REEXPORT_DEPTH) return undefined;
    const target = found.exported.get(name);
    if (typeof target === "string") {
      const node = found.top.get(target);
      if (node !== undefined) return { file, name: target, node };
      const imported = found.imports.get(target);
      const next = imported && resolve(file, imported.from);
      return imported && next ? declaration(next, imported.imported, depth + 1) : undefined;
    }
    if (target !== undefined) {
      const next = resolve(file, target.from);
      return next === undefined || target.imported === "*" ? undefined : declaration(next, target.imported, depth + 1);
    }
    for (const star of found.stars) {
      const next = resolve(file, star);
      const via = next === undefined ? undefined : declaration(next, name, depth + 1);
      if (via !== undefined) return via;
    }
    return undefined;
  };

  return {
    declaration,
    invalidate: (file) => {
      modules.delete(file);
    },
    module,
    repo,
    resolve,
  };
};
