/**
 * Flags a file that calls several operations of another module through its public entry: code that drives a module's
 * model belongs to that module.
 *
 * @attribution "Feature Envy" from Martin Fowler's Refactoring (concept, lifted from classes to modules)
 */
import { type AgentlintNode, defineRule, type StateRule } from "@aurelienbbn/agentlint";
import { namedChildren, nonTestExcludes, sourceGlobs } from "../judgment-support-b.js";

const defaultMinOperations = 4;
// A module's public entry: `api.ts` (or `.js`, `.tsx`…), the file other modules are allowed to import.
const defaultEntryPattern = String.raw`(^|/)api(\.[cm]?[jt]sx?)?$`;
const operationName = /^[a-z_$]/u;

export type OperationsStayWithOwnerOptions = {
  /** Fewest operations one file may call from one other module's entry before review. Default: 4. */
  readonly minOperations?: number;
  /** Regular expression a resolved import path matches when it is a module's public entry. Default: `api.*` files. */
  readonly entryPattern?: string;
  /** Bare specifiers that are modules too (`@acme/billing`); a trailing `/*` matches a scope. Default: none. */
  readonly packages?: readonly string[];
};

function positiveInteger(value: number, option: string): void {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error(`operations-stay-with-owner: ${option} must be a positive integer.`);
}

function unquoted(text: string): string {
  return text.replace(/^["'`]|["'`]$/gu, "");
}

function resolvedPath(from: string, specifier: string): string {
  const parts = from.split("/").slice(0, -1);
  for (const segment of specifier.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return parts.join("/");
}

function isPackageModule(specifier: string, packages: readonly string[]): boolean {
  return packages.some((entry) =>
    entry.endsWith("/*") ? specifier.startsWith(entry.slice(0, -1)) : specifier === entry,
  );
}

function hasTypeKeyword(node: AgentlintNode): boolean {
  return node.children.some((child) => child.type === "type");
}

// The value names a statement imports, as the module exports them (an alias renames only the local binding).
function importedValues(statement: AgentlintNode): readonly string[] {
  if (hasTypeKeyword(statement)) return [];
  const names: string[] = [];
  for (const specifier of statement.descendantsOfType("import_specifier")) {
    if (hasTypeKeyword(specifier)) continue;
    const name = specifier.childByFieldName("name") ?? namedChildren(specifier)[0];
    if (name !== undefined && name !== null) names.push(name.text);
  }
  return names;
}

export function defineOperationsStayWithOwner(options: OperationsStayWithOwnerOptions = {}): StateRule {
  options = structuredClone(options);
  const minOperations = options.minOperations ?? defaultMinOperations;
  positiveInteger(minOperations, "minOperations");
  const entryPattern = new RegExp(options.entryPattern ?? defaultEntryPattern, "u");
  const packages = options.packages ?? [];

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "core/operations-stay-with-owner",
      revision: 1,
      title: "Operations stay with the module that owns them",
      summary:
        "Flags a file that calls several operations of another module through its public entry, so a reviewer decides whether that code belongs to the owner or the owner's entry exposes its internals.",
      guidance: {
        standard:
          "A module owns its model and the operations on it. Another module asks for an outcome through a small public entry; it does not drive the owner's model step by step. A file that calls many of another module's operations is doing that module's work (feature envy at module scale), and the owner's entry grows a name for every step it takes.",
        checks: [
          "List the operations the file calls and what they achieve together.",
          "PASS when each call is one outcome the owner offers (start, find, decide) and the file composes outcomes of several owners, like a read model or the composition root.",
          "FAIL when the calls replay the owner's own steps (its state moves, its records): move that code into the owner and let it expose one operation, or have the owner contribute it through a declaration the composition collects.",
          "FAIL when names were added to the owner's entry only for this file.",
        ],
        examples: [
          {
            label: "REVIEW",
            code: 'import { requestComposed, requestSent, requestBounced, requestReplied } from "../takedown/api.ts";\n\nconst story = [requestComposed, requestSent, requestReplied];',
            description: "A seed module replays another feature's state moves; the seed belongs to that feature.",
          },
          {
            label: "PASS",
            code: 'import { merchantsStart, TakedownSource } from "../takedown/api.ts";\n\nexport const act = (ids) => merchantsStart(ids);',
            description: "One outcome the owner offers, plus its vocabulary.",
          },
        ],
        refs: [{ type: "url", href: "https://refactoring.com/catalog/moveFunction.html" }],
      },
    },
    binding: {
      id: "core/operations-stay-with-owner",
      authority: "agent",
      include: sourceGlobs,
      exclude: nonTestExcludes,
      options: {
        minOperations: options.minOperations ?? null,
        entryPattern: options.entryPattern ?? null,
        packages: options.packages ? [...options.packages] : null,
      },
    },
    detector: {
      id: "core/operations-stay-with-owner",
      version: 1,
      scan: "file",
      fixtures: {
        mustReport: [
          {
            file: "src/qa/story.ts",
            source:
              'import { requestComposed, requestSent, requestBounced, requestReplied } from "../takedown/api.ts";\nexport const story = [requestComposed, requestSent, requestBounced, requestReplied];',
          },
        ],
        mustStaySilent: [
          {
            file: "src/ops/views.ts",
            source:
              'import { TakedownSource, TakedownRequest, TakedownMerchant, TakedownReply } from "../takedown/api.ts";\nexport const views = [TakedownSource, TakedownRequest, TakedownMerchant, TakedownReply];',
          },
          {
            file: "src/takedown/compose.ts",
            source:
              'import { requestComposed, requestSent, requestBounced, requestReplied } from "./domain/request.ts";\nexport const story = [requestComposed, requestSent, requestBounced, requestReplied];',
          },
        ],
      },
      createOnce({ context }) {
        return {
          program(root) {
            const byTarget = new Map<string, { readonly node: AgentlintNode; readonly names: Set<string> }>();
            for (const statement of root.descendantsOfType("import_statement")) {
              const source = statement.childByFieldName("source");
              if (!source) continue;
              const specifier = unquoted(source.text);
              const relative = specifier.startsWith(".");
              const target = relative ? resolvedPath(context.path, specifier) : specifier;
              if (relative ? !entryPattern.test(target) : !isPackageModule(specifier, packages)) continue;
              const operations = importedValues(statement).filter((name) => operationName.test(name));
              if (operations.length === 0) continue;
              const entry = byTarget.get(target) ?? { node: statement, names: new Set<string>() };
              for (const name of operations) entry.names.add(name);
              byTarget.set(target, entry);
            }
            for (const [target, { node, names }] of byTarget) {
              if (names.size < minOperations) continue;
              const sorted = [...names].toSorted();
              context.report({
                node,
                key: target,
                message: `This file calls ${sorted.length} operations of \`${target}\` (${sorted.join(", ")}); code that drives another module's model belongs to that module: move it there, or have the owner offer the one outcome this file needs.`,
                evidence: { target, operations: sorted },
              });
            }
          },
        };
      },
    },
  });
}

export const operationsStayWithOwner = defineOperationsStayWithOwner();
