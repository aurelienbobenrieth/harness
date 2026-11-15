import type { ESTree, Rule } from "@oxlint/plugins";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { isTestFile, type RuleContextWithFilename } from "../filename-support.js";
import {
  aliasesFrom,
  type ForbiddenImport,
  moduleViolation,
  normalizeSourceRoot,
  type SubpathAlias,
  type UnitPolicy,
} from "./units.js";

type Options = {
  readonly sourceRoot?: string;
  readonly units?: readonly string[];
  readonly forbidden?: readonly ForbiddenImport[];
  readonly private?: readonly string[];
  readonly includeTestFiles?: boolean;
};

type SourceNode =
  | ESTree.ImportDeclaration
  | ESTree.ExportAllDeclaration
  | ESTree.ExportNamedDeclaration
  | ESTree.ImportExpression;

/** The nearest package.json above a file: its directory and its `imports` field. */
type Member = {
  readonly dir: string;
  readonly imports: unknown;
};

/** One read per member directory per lint process; an editor language server sees `imports` edits after a restart. */
const membersByDirectory = new Map<string, Member | undefined>();

function memberOf(directory: string): Member | undefined {
  if (membersByDirectory.has(directory)) return membersByDirectory.get(directory);
  const manifest = path.join(directory, "package.json");
  const parent = path.dirname(directory);
  const member = existsSync(manifest)
    ? { dir: directory, imports: (JSON.parse(readFileSync(manifest, "utf8")) as { imports?: unknown }).imports }
    : parent === directory
      ? undefined
      : memberOf(parent);
  membersByDirectory.set(directory, member);
  return member;
}

function literalSource(node: SourceNode): ESTree.StringLiteral | undefined {
  const source = node.source;
  return source !== null && source.type === "Literal" && typeof source.value === "string"
    ? (source as ESTree.StringLiteral)
    : undefined;
}

export const moduleBoundaries: Rule = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description:
        "Keep the units of one workspace member apart: other units are imported through a `#` subpath and never by relative path, the own unit by relative path, and configured edges and private paths never across units.",
    },
    schema: [
      {
        type: "object",
        properties: {
          sourceRoot: { type: "string" },
          units: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
          forbidden: {
            type: "array",
            items: {
              type: "object",
              properties: {
                from: { type: "string", minLength: 1 },
                to: { type: "string", minLength: 1 },
                message: { type: "string", minLength: 1 },
              },
              required: ["from", "to"],
              additionalProperties: false,
            },
          },
          private: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
          includeTestFiles: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = (context.options[0] ?? {}) as Options;
    const filename = context.filename;
    const member = memberOf(path.dirname(filename));
    if (member === undefined) return {};

    const sourceRoot = normalizeSourceRoot(options.sourceRoot ?? "src");
    const fromMember = path.relative(member.dir, filename).replaceAll("\\", "/");
    if (sourceRoot !== "" && !fromMember.startsWith(`${sourceRoot}/`)) return {};

    const policy: UnitPolicy = {
      sourceRoot,
      units: options.units ?? [],
      forbidden: options.forbidden ?? [],
      private: options.private ?? [],
    };
    const aliases: readonly SubpathAlias[] = aliasesFrom(member.imports, sourceRoot);
    const importer = sourceRoot === "" ? fromMember : fromMember.slice(sourceRoot.length + 1);
    const judgeDependencies = options.includeTestFiles === true || !isTestFile(context as RuleContextWithFilename);
    const check = (node: SourceNode): void => {
      const source = literalSource(node);
      if (source === undefined) return;
      const violation = moduleViolation({ policy, aliases, importer, specifier: source.value, judgeDependencies });
      if (violation === undefined) return;

      const { replacement } = violation;
      if (replacement === undefined) {
        context.report({ node, message: violation.message });
        return;
      }
      const quote = source.raw?.[0] === "'" ? "'" : '"';
      context.report({
        node,
        message: violation.message,
        fix: (fixer) => fixer.replaceText(source, `${quote}${replacement}${quote}`),
      });
    };

    return {
      ImportDeclaration: check,
      ExportAllDeclaration: check,
      ExportNamedDeclaration: check,
      ImportExpression: check,
    };
  },
};
