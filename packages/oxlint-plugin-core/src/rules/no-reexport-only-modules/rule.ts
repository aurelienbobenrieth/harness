import type { ESTree, Rule } from "@oxlint/plugins";
import { getFilename, type RuleContextWithFilename } from "../filename-support.js";

const defaultAllow: readonly string[] = ["index.ts"];

type RuleOptions = {
  readonly allow?: readonly string[];
};

type RuleContextWithOptions = RuleContextWithFilename & {
  readonly options?: readonly unknown[];
};

function getAllow(context: RuleContextWithOptions): readonly string[] {
  const candidate = context.options?.[0];
  if (typeof candidate !== "object" || candidate === null) return defaultAllow;

  const allow = (candidate as RuleOptions).allow;
  return Array.isArray(allow) && allow.every((entry) => typeof entry === "string") ? allow : defaultAllow;
}

function isAllowedFile(filename: string, patterns: readonly string[]): boolean {
  const basename = filename.split("/").at(-1) ?? filename;
  return patterns.some((pattern) => {
    const normalized = pattern.replaceAll("\\", "/");
    return basename === normalized || filename === normalized || filename.endsWith(`/${normalized}`);
  });
}

function isReexportStatement(statement: ESTree.Program["body"][number]): boolean {
  if (statement.type === "ImportDeclaration" || statement.type === "ExportAllDeclaration") return true;
  if (statement.type !== "ExportNamedDeclaration" || statement.declaration !== null) return false;

  return statement.source !== null || statement.specifiers.length === 0;
}

function hasReexport(statements: readonly ESTree.Program["body"][number][]): boolean {
  return statements.some(
    (statement) =>
      statement.type === "ExportAllDeclaration" ||
      (statement.type === "ExportNamedDeclaration" && statement.source !== null),
  );
}

export const noReexportOnlyModules: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow modules that only re-export other modules, except allowed entrypoint barrels.",
    },
    messages: {
      reexportOnly:
        "This module only re-exports: import from the owning module or add this entrypoint to the allow option.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allow: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    return {
      Program(node) {
        if (node.body.length === 0) return;
        if (!hasReexport(node.body)) return;
        if (!node.body.every((statement) => isReexportStatement(statement))) return;
        if (isAllowedFile(getFilename(context as RuleContextWithOptions), getAllow(context as RuleContextWithOptions)))
          return;

        context.report({ node, messageId: "reexportOnly" });
      },
    };
  },
};
