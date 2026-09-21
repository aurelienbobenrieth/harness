import { defineRule, type ChangeRule } from "@aurelienbbn/agentlint";
import { matchesPattern } from "../jsx-support.js";

const defaultManifestPattern = /(?:^|\/)shopify\.app(?:\.[^/]+)?\.toml$/;

export type ScopeChangeReviewOptions = {
  /** Repository-relative app manifest paths. Defaults to `shopify.app.toml` and `shopify.app.<name>.toml`. */
  readonly manifestPattern?: RegExp;
};

type DeclaredScopes = {
  readonly required: ReadonlySet<string>;
  readonly optional: ReadonlySet<string>;
  /** One-based line of the first scope declaration, used to anchor the finding. */
  readonly line: number;
};

function stripComment(line: string): string {
  let quote: string | undefined;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (quote) {
      if (character === "\\" && quote === '"') index++;
      else if (character === quote) quote = undefined;
    } else if (character === '"' || character === "'") quote = character;
    else if (character === "#") return line.slice(0, index);
  }
  return line;
}

function scopeNames(value: string): string[] {
  return [...value.matchAll(/"([^"]*)"|'([^']*)'/g)]
    .flatMap((match) => (match[1] ?? match[2] ?? "").split(","))
    .map((scope) => scope.trim())
    .filter((scope) => scope !== "");
}

/**
 * Reads `scopes` and `optional_scopes` from the `[access_scopes]` table, plus the legacy top-level
 * `scopes` key. Accepts comma-separated strings and string arrays, including multi-line arrays. This
 * is a key reader for two known fields, not a TOML parser.
 */
function readScopes(source: string | undefined): DeclaredScopes {
  const required = new Set<string>();
  const optional = new Set<string>();
  let line = 0;
  let table = "";
  let open: Set<string> | undefined;
  for (const [index, raw] of (source ?? "").split(/\r?\n/).entries()) {
    const text = stripComment(raw).trim();
    if (open) {
      for (const scope of scopeNames(text)) open.add(scope);
      if (text.includes("]")) open = undefined;
      continue;
    }
    const header = /^\[\[?\s*([^\]]+?)\s*\]?\]$/.exec(text);
    if (header) {
      table = header[1] ?? "";
      continue;
    }
    const assignment = /^(scopes|optional_scopes)\s*=\s*(.*)$/.exec(text);
    if (!assignment) continue;
    if (table !== "access_scopes" && !(table === "" && assignment[1] === "scopes")) continue;
    const target = assignment[1] === "scopes" ? required : optional;
    const value = assignment[2] ?? "";
    for (const scope of scopeNames(value)) target.add(scope);
    if (line === 0) line = index + 1;
    if (value.startsWith("[") && !value.includes("]")) open = target;
  }
  return { required, optional, line };
}

/**
 * @attribution https://shopify.dev/docs/apps/build/authentication-authorization/app-installation/manage-access-scopes (inspiration; independently implemented)
 */
export function defineScopeChangeReview(options: ScopeChangeReviewOptions = {}): ChangeRule {
  options = structuredClone(options);
  const manifestPattern = options.manifestPattern ?? defaultManifestPattern;

  return defineRule({
    lifecycle: "change",
    standard: {
      id: "shopify-app/scope-change-review",
      revision: 1,
      title: "Scope Change Review",
      summary: "Flags access scopes added to a Shopify app manifest since the baseline for necessity review.",
      guidance: {
        standard:
          "An app requests only the access it needs. Adding a required scope makes every installed merchant approve new permissions before the app keeps working, and App Store review rejects unused access. Scope necessity cannot be derived from the manifest; pass when each added scope satisfies the checks below.",
        checks: [
          "Usage: each added scope maps to a named Admin API operation, webhook topic, or extension capability that exists in this repository; cite the file.",
          "Write access: a `write_` scope is added only where a mutation on that resource exists; read-only features request the `read_` scope. A `write_` scope already implies its `read_` counterpart, and declaring both causes deployment errors.",
          "Optional access: a scope that serves a feature only some merchants enable is declared in `optional_scopes` and requested at the point of use through the scopes API (`scopes.request`), with the feature degrading cleanly when access is declined.",
          "`read_all_orders` sits beside `read_orders` or `write_orders` and has a documented need for orders older than the default window.",
          "Protected customer data: a scope exposing customer names, addresses, phone numbers, or email has matching protected customer data access and the data-handling obligations recorded.",
          "Rollout: the release plan accounts for merchants being prompted to approve the new required scopes.",
        ],
        refs: [
          {
            type: "url",
            href: "https://shopify.dev/docs/apps/build/authentication-authorization/app-installation/manage-access-scopes",
          },
          { type: "url", href: "https://shopify.dev/docs/apps/launch/protected-customer-data" },
        ],
      },
    },
    binding: {
      id: "shopify-app/scope-change-review",
      authority: "agent",
      include: ["**/shopify.app.toml", "**/shopify.app.*.toml"],
      options: {
        manifestPattern: options.manifestPattern
          ? { source: options.manifestPattern.source, flags: options.manifestPattern.flags }
          : null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            before: { "shopify.app.toml": '[access_scopes]\nscopes = "read_products"\n' },
            after: {
              "shopify.app.toml": '[access_scopes]\nscopes = "read_products,write_orders"\n',
            },
          },
        ],
        mustStaySilent: [
          {
            before: {
              "shopify.app.toml": 'name = "a"\n[access_scopes]\nscopes = "read_products"\n',
            },
            after: {
              "shopify.app.toml": 'name = "b"\n[access_scopes]\nscopes = "read_products"\n',
            },
          },
        ],
      },
      id: "shopify-app/scope-change-review",
      version: 1,
      detect(context) {
        for (const file of context.change.files) {
          if (file.after === null || !matchesPattern(manifestPattern, file.path)) continue;
          if (file.after.content === undefined) throw new Error(`Missing change snapshot: ${file.path}`);
          const before = readScopes(file.before?.content);
          const after = readScopes(file.after.content);
          const addedRequired = [...after.required].filter((scope) => !before.required.has(scope)).toSorted();
          const addedOptional = [...after.optional]
            .filter((scope) => !before.required.has(scope) && !before.optional.has(scope))
            .toSorted();
          if (addedRequired.length === 0 && addedOptional.length === 0) continue;
          const parts = [
            ...(addedRequired.length > 0 ? [`required ${addedRequired.join(", ")}`] : []),
            ...(addedOptional.length > 0 ? [`optional ${addedOptional.join(", ")}`] : []),
          ];
          context.report({
            key: "access-scopes",
            file: file.path,
            message: `Access scopes added (${parts.join("; ")}): tie each scope to an operation in this repository and move feature-gated access to optional_scopes.`,
            evidence: { addedRequired, addedOptional },
            startLine: after.line,
            endLine: after.line,
          });
        }
      },
    },
  });
}

export const scopeChangeReview = defineScopeChangeReview();
