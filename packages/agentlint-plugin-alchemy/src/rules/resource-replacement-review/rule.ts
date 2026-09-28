/**
 * Flags diffs that make Alchemy plan a replacement or deletion of a stateful resource: a logical ID changed without
 * `renamedFrom`, a declaration removed, a replace-triggering prop changed, or the stack renamed.
 *
 * Change detectors see text only, so declarations are read lexically from the before and after sources.
 *
 * @attribution Alchemy renaming and resource lifecycle docs, https://alchemy.run/infrastructure-as-code/renaming (Apache-2.0 project; concept, independently implemented)
 * @attribution Alchemy provider diff functions in alchemy/src/Cloudflare/R2/Bucket.ts and D1/Database.ts, 2.0.0-beta.79 (Apache-2.0; replace triggers read, not copied)
 */
import { defineRule, type ChangeRule } from "@aurelienbbn/agentlint";
import {
  resourceDeclarations,
  stackDeclarations,
  type ResourceDeclaration,
  type StackDeclaration,
} from "../alchemy-declarations.js";
import { changedSources, normalizeExpression, scriptExcludes, scriptGlobs } from "../source-scan.js";

/**
 * When a prop change makes the provider plan a replace: `"changed"` for any difference, including removal;
 * `"set"` only when the after side sets a value that differs (removing it keeps the deployed value).
 */
export type ReplacementTrigger = "changed" | "set";

/** A trigger, optionally with the value the provider assumes when the prop is unset (R2 and D1 `jurisdiction`: `"default"`). */
export type ReplacementProp = ReplacementTrigger | { readonly trigger: ReplacementTrigger; readonly absent: string };

export type ResourceReplacementReviewOptions = {
  /**
   * Watched resource constructors, written as they follow the provider namespace (`R2.Bucket`), each with the props
   * whose change the provider's `diff` answers with `replace`. Replaces the default map.
   */
  readonly resources?: Readonly<Record<string, Readonly<Record<string, ReplacementProp>>>>;
};

/**
 * Verified against the provider `diff` functions of alchemy 2.0.0-beta.79. KV namespaces carry no replace-triggering
 * prop: a `title` change is an in-place update (`Cloudflare/KV/Namespace.ts`).
 */
const defaultJurisdiction: ReplacementProp = { trigger: "changed", absent: "default" };
const defaultResources: Readonly<Record<string, Readonly<Record<string, ReplacementProp>>>> = {
  "R2.Bucket": { name: "set", jurisdiction: defaultJurisdiction, locationHint: "changed" },
  "D1.Database": { name: "set", jurisdiction: defaultJurisdiction, primaryLocationHint: "set" },
  "KV.Namespace": {},
};

const ruleId = "alchemy/resource-replacement-review";

type Report = {
  readonly key: string;
  readonly file: string;
  readonly line: number;
  readonly excerpt: string;
  readonly message: string;
  readonly evidence: Readonly<Record<string, string>>;
};

const keyOf = (declaration: ResourceDeclaration): string => `${declaration.type}\u0000${declaration.id}`;

function counts(declarations: readonly ResourceDeclaration[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const declaration of declarations) result.set(keyOf(declaration), (result.get(keyOf(declaration)) ?? 0) + 1);
  return result;
}

/** Declarations whose key occurs more often in `from` than in `to`, once per key. */
function surplus(from: readonly ResourceDeclaration[], to: readonly ResourceDeclaration[]): ResourceDeclaration[] {
  const fromCounts = counts(from);
  const toCounts = counts(to);
  const seen = new Set<string>();
  return from.filter((declaration) => {
    const key = keyOf(declaration);
    if (seen.has(key) || (fromCounts.get(key) ?? 0) <= (toCounts.get(key) ?? 0)) return false;
    seen.add(key);
    return true;
  });
}

function claims(declarations: readonly ResourceDeclaration[]): Set<string> {
  return new Set(
    declarations.flatMap((declaration) =>
      declaration.renamedFrom.map((former) => `${declaration.type}\u0000${former.split("/").at(-1) ?? former}`),
    ),
  );
}

function display(value: string | undefined): string {
  return value ?? "(unset)";
}

function propChanges(
  before: ResourceDeclaration,
  after: ResourceDeclaration,
  triggers: Readonly<Record<string, ReplacementProp>>,
): Report[] {
  if (!before.props || !after.props) return [];
  return Object.entries(triggers).flatMap(([prop, spec]) => {
    const trigger = typeof spec === "string" ? spec : spec.trigger;
    const absent = typeof spec === "string" ? undefined : normalizeExpression(JSON.stringify(spec.absent));
    const set = after.props?.get(prop);
    const from = before.props?.get(prop) ?? absent;
    const to = set ?? absent;
    if (from === to || (trigger === "set" && set === undefined)) return [];
    return [
      {
        key: `replace-prop:${after.type}:${after.id}:${prop}`,
        file: after.path,
        line: after.line,
        excerpt: after.excerpt,
        message: `${after.type} "${after.id}" changes \`${prop}\` (${display(from)} → ${display(to)}): Alchemy plans a replace, which creates a new, empty ${after.type} and deletes the old one with its data. Revert the prop or confirm the data is disposable or migrated.`,
        evidence: {
          kind: "replace-prop",
          type: after.type,
          id: after.id,
          prop,
          before: display(from),
          after: display(to),
        },
      },
    ];
  });
}

function stackRenames(before: readonly StackDeclaration[], after: readonly StackDeclaration[]): Report[] {
  return after.flatMap((stack) => {
    if (before.some((previous) => previous.name === stack.name)) return [];
    const previous = before.find(
      (candidate) => candidate.path === stack.path && !after.some((current) => current.name === candidate.name),
    );
    if (!previous) return [];
    return [
      {
        key: `stack-name:${previous.name}`,
        file: stack.path,
        line: stack.line,
        excerpt: `Stack("${stack.name}")`,
        message: `Stack "${previous.name}" is renamed to "${stack.name}": state and physical names are keyed by stack name, so the next deploy creates every resource again, empty, and leaves the "${previous.name}" resources orphaned. Keep the name or plan the data migration.`,
        evidence: { kind: "stack-name", before: previous.name, after: stack.name },
      },
    ];
  });
}

export function defineResourceReplacementReview(options: ResourceReplacementReviewOptions = {}): ChangeRule {
  options = structuredClone(options);
  const resources = options.resources ?? defaultResources;
  const types = Object.keys(resources);

  return defineRule({
    lifecycle: "change",
    standard: {
      id: ruleId,
      revision: 1,
      title: "Resource Replacement Review",
      summary:
        "Flags diffs that make Alchemy replace or delete a stateful resource: a logical ID changed without renamedFrom, a declaration removed, a replace-triggering prop changed, or the stack renamed.",
      guidance: {
        standard:
          "Alchemy keys state by stack, stage and logical ID, and derives physical names from `${stack}-${id}-${stage}` (`alchemy/src/PhysicalName.ts`). A replace creates a new resource under a fresh instance ID, repoints dependents, then deletes the old generation; a removed declaration is deleted as an orphan. The new resource starts empty: D1 databases and KV namespaces are deleted with their data, and an R2 bucket is emptied first when it sets `forceDestroy: true` (without it R2 refuses to delete a non-empty bucket and the deploy fails). `RemovalPolicy.retain()` keeps the old cloud object but not the data's place in the application. Sources: `alchemy/src/Rename.ts`, `alchemy/src/Cloudflare/R2/Bucket.ts` (`diff`, `delete`), `alchemy/src/Cloudflare/D1/Database.ts` (`diff`), https://alchemy.run/infrastructure-as-code/resource-lifecycle.",
        checks: [
          'Logical ID changed: pass when the change pipes the resource through `Alchemy.renamedFrom("<old id>")`, which migrates the state row and plans an update. A swap (A ⇄ B) fails the plan; rename through a temporary ID across two deploys.',
          "Declaration removed: pass when the data is disposable, or the merge-base declaration already carried an unconditional `RemovalPolicy.retain()` and was deployed to every stage with it.",
          "Replace-triggering prop (R2 `name`, `jurisdiction`, `locationHint`; D1 `name`, `jurisdiction`, `primaryLocationHint`): pass only with a written migration plan (export, copy, cut over) or disposable data. Removing an explicit `name` keeps the deployed name and plans no replace.",
          "Stack renamed: every resource is created again under the new stack's empty state; resources with explicit names collide with the old stack's and fail as `OwnedBySomeoneElse`. Pass only for a stack with no data yet in any stage.",
          "Fail: the replacement is a side effect of a refactor (tidier IDs, moved files, renamed stack) rather than an intended data migration.",
        ],
        examples: [
          {
            label: "rename without replacement",
            code: '-const bucket = yield* Cloudflare.R2.Bucket("Bucket");\n+const bucket = yield* Cloudflare.R2.Bucket("Assets").pipe(Alchemy.renamedFrom("Bucket"));',
          },
        ],
        refs: [
          { type: "url", href: "https://alchemy.run/infrastructure-as-code/renaming" },
          { type: "url", href: "https://alchemy.run/infrastructure-as-code/resource-lifecycle" },
          { type: "url", href: "https://github.com/alchemy-run/alchemy/issues/1248" },
        ],
      },
    },
    binding: {
      id: ruleId,
      authority: "human",
      include: [...scriptGlobs],
      exclude: [...scriptExcludes],
      options: { resources: options.resources ?? null },
    },
    detector: {
      id: ruleId,
      version: 2,
      fixtures: {
        mustReport: [
          {
            before: { "alchemy.run.ts": 'const db = yield* Cloudflare.D1.Database("Orders");\n' },
            after: { "alchemy.run.ts": 'const db = yield* Cloudflare.D1.Database("OrdersDb");\n' },
          },
          {
            before: { "alchemy.run.ts": 'const b = yield* Cloudflare.R2.Bucket("Uploads", { jurisdiction: "eu" });\n' },
            after: {
              "alchemy.run.ts": 'const b = yield* Cloudflare.R2.Bucket("Uploads", { jurisdiction: "fedramp" });\n',
            },
          },
        ],
        mustStaySilent: [
          {
            before: { "alchemy.run.ts": 'const b = yield* Cloudflare.R2.Bucket("Bucket");\n' },
            after: {
              "alchemy.run.ts":
                'const b = yield* Cloudflare.R2.Bucket("Assets").pipe(Alchemy.renamedFrom("Bucket"));\n',
            },
          },
          {
            before: { "alchemy.run.ts": 'const kv = yield* Cloudflare.KV.Namespace("Cache", { title: "cache" });\n' },
            after: { "alchemy.run.ts": 'const kv = yield* Cloudflare.KV.Namespace("Cache", { title: "cache-v2" });\n' },
          },
          {
            before: { "alchemy.run.ts": 'const b = yield* Cloudflare.R2.Bucket("Uploads");\n' },
            after: {
              "alchemy.run.ts": 'const b = yield* Cloudflare.R2.Bucket("Uploads", { jurisdiction: "default" });\n',
            },
          },
        ],
      },
      detect({ context }) {
        const sources = changedSources(context.change, ruleId);
        const before = sources.flatMap((source) =>
          source.before === undefined ? [] : resourceDeclarations(source.path, source.before, types),
        );
        const after = sources.flatMap((source) =>
          source.after === undefined ? [] : resourceDeclarations(source.path, source.after, types),
        );
        const claimed = claims(after);
        const added = surplus(after, before).filter((declaration) => declaration.renamedFrom.length === 0);
        const reports: Report[] = [];

        for (const gone of surplus(before, after)) {
          if (claimed.has(keyOf(gone))) continue;
          const index = added.findIndex((candidate) => candidate.type === gone.type);
          const successor = index < 0 ? undefined : added.splice(index, 1)[0];
          if (successor) {
            reports.push({
              key: `logical-id:${gone.type}:${gone.id}`,
              file: successor.path,
              line: successor.line,
              excerpt: successor.excerpt,
              message: `${gone.type} logical ID "${gone.id}" became "${successor.id}" without \`Alchemy.renamedFrom("${gone.id}")\`: the next deploy creates a new, empty ${gone.type} and deletes the old one with its data. Pipe it through \`Alchemy.renamedFrom("${gone.id}")\` or confirm the replacement.`,
              evidence: { kind: "logical-id", type: gone.type, before: gone.id, after: successor.id },
            });
          } else if (!gone.retained) {
            reports.push({
              key: `removed:${gone.type}:${gone.id}`,
              file: gone.path,
              line: gone.line,
              excerpt: gone.excerpt,
              message: `${gone.type} "${gone.id}" is removed: the next deploy deletes it as an orphan, with its data. Confirm the data is disposable, or deploy it with \`RemovalPolicy.retain()\` before removing the declaration.`,
              evidence: { kind: "removed", type: gone.type, id: gone.id },
            });
          }
        }

        for (const current of after) {
          const previous = before.find((candidate) => keyOf(candidate) === keyOf(current));
          if (previous) reports.push(...propChanges(previous, current, resources[current.type] ?? {}));
        }

        const beforeStacks = sources.flatMap((source) =>
          source.before === undefined ? [] : stackDeclarations(source.path, source.before),
        );
        const afterStacks = sources.flatMap((source) =>
          source.after === undefined ? [] : stackDeclarations(source.path, source.after),
        );
        reports.push(...stackRenames(beforeStacks, afterStacks));

        const reported = new Set<string>();
        for (const report of reports) {
          if (reported.has(`${report.file}\u0000${report.key}`)) continue;
          reported.add(`${report.file}\u0000${report.key}`);
          context.report({
            key: report.key,
            lineageKey: report.key,
            file: report.file,
            message: report.message,
            evidence: report.evidence,
            excerpt: report.excerpt,
            startLine: report.line,
            endLine: report.line,
          });
        }
      },
    },
  });
}

export const resourceReplacementReview = defineResourceReplacementReview();
