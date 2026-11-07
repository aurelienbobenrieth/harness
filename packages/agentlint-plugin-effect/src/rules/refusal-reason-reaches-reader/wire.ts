import {
  field,
  identifierName,
  isNode,
  listField,
  nodeField,
  walk,
  type AstNode,
} from "../transaction-no-network/ast.js";
import { parseTree, type Repo } from "../transaction-no-network/program.js";

/** Errors a program sends to its callers, and the files that tell one of them apart. */
export interface Wire {
  readonly errors: ReadonlySet<string>;
  readonly readers: ReadonlyMap<string, ReadonlySet<string>>;
}

const testCode =
  /\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)(?:tests?|__tests__|testing|fixtures)\/|(?:^|\/)testing\.[cm]?[jt]sx?$/u;
const declaration = /\bclass\s+(\w+)\s+extends\b/gu;
/** `Schema.is(X)`, `X["reason"]`, `instanceof X`, a tag written out (`"X"`), or a handler key (`X:`). */
const read = /\.is\((\w+)\)|\b(\w+)\["reason"\]|\binstanceof\s+(\w+)|["'`](\w+)["'`]|\b(\w+)\s*:/gu;

/** A comment naming an error tells nothing apart. */
const comments = /\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gmu;

const isRpcMake = (callee: AstNode | undefined): boolean => {
  if (callee?.type !== "MemberExpression") return false;
  const object = identifierName(nodeField(callee, "object"));
  return object === "Rpc" && identifierName(nodeField(callee, "property")) === "make";
};

const namesIn = (node: AstNode): readonly string[] => {
  const names: string[] = [];
  walk(node, (child) => {
    const name = identifierName(child);
    if (name !== undefined) names.push(name);
  });
  return names;
};

const errorsOfRpc = (call: AstNode): readonly string[] => {
  const options = listField(call, "arguments").find((argument) => argument.type === "ObjectExpression");
  if (options === undefined) return [];
  const entry = listField(options, "properties").find(
    (property) => identifierName(nodeField(property, "key")) === "error",
  );
  const value = entry === undefined ? undefined : field(entry, "value");
  return isNode(value) ? namesIn(value) : [];
};

/** Names declared as errors of an `Rpc.make(…, { error })` or an endpoint's `.addError(X)`. */
const wireErrorsOf = (file: string, text: string): readonly string[] => {
  if (!text.includes("Rpc.make(") && !text.includes(".addError(")) return [];
  const names: string[] = [];
  walk(parseTree(file, text), (node) => {
    if (node.type !== "CallExpression") return;
    const callee = nodeField(node, "callee");
    if (isRpcMake(callee)) names.push(...errorsOfRpc(node));
    if (callee?.type === "MemberExpression" && identifierName(nodeField(callee, "property")) === "addError") {
      const name = identifierName(listField(node, "arguments")[0]);
      if (name !== undefined) names.push(name);
    }
  });
  return names;
};

/** Reads the checkout once: runtime code only, because a test telling an error apart shows nobody anything. */
export const wireOf = (repo: Repo): Wire => {
  const files = repo.all().filter((file) => !testCode.test(file));
  const errors = new Set(files.flatMap((file) => wireErrorsOf(file, repo.read(file) ?? "")));
  const readers = new Map<string, Set<string>>();
  for (const file of files) {
    const text = (repo.read(file) ?? "").replaceAll(comments, " ");
    const declared = new Set([...text.matchAll(declaration)].map((match) => match[1]));
    for (const match of text.matchAll(read)) {
      const name = match.slice(1).find((group) => group !== undefined);
      if (name === undefined || !errors.has(name) || declared.has(name)) continue;
      const found = readers.get(name) ?? new Set<string>();
      found.add(file);
      readers.set(name, found);
    }
  }
  return { errors, readers };
};
