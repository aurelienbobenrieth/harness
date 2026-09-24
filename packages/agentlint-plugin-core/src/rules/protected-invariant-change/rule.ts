/**
 * Turns repository-owned architectural invariants into human review gates over matching changes.
 *
 * @attribution https://alexn.org/blog/2026/09/22/ai-has-no-wisdom-and-neither-will-you/ (inspiration; independently implemented)
 */
import { defineRule, type ChangeRule } from "@aurelienbbn/agentlint";
import { matches, serializePattern, type SerializedPattern } from "../judgment-support-b.js";

export type ProtectedInvariant = {
  /** Stable repository-owned identifier. */
  readonly id: string;
  /** Short invariant a reviewer can falsify against the changed code. */
  readonly statement: string;
  /** Changed paths that can affect the invariant. */
  readonly protectedPaths: readonly RegExp[];
  /** Tests, policies or decision records whose change also invalidates the judgment. */
  readonly evidencePaths?: readonly RegExp[];
};

export type ProtectedInvariantChangeOptions = {
  readonly invariants?: readonly ProtectedInvariant[];
};

type CompiledInvariant = ProtectedInvariant & {
  readonly protectedPathOptions: readonly SerializedPattern[];
  readonly evidencePathOptions: readonly SerializedPattern[];
};

function compile(options: ProtectedInvariantChangeOptions): readonly CompiledInvariant[] {
  const ids = new Set<string>();
  return (options.invariants ?? []).map((invariant) => {
    if (invariant.id.trim().length === 0 || invariant.statement.trim().length === 0)
      throw new Error("protected-invariant-change: id and statement must not be empty.");
    if (ids.has(invariant.id)) throw new Error(`protected-invariant-change: duplicate id ${invariant.id}.`);
    ids.add(invariant.id);
    if (invariant.protectedPaths.length === 0)
      throw new Error(`protected-invariant-change: ${invariant.id} needs at least one protected path.`);
    return {
      ...invariant,
      protectedPathOptions: invariant.protectedPaths.map((pattern) => serializePattern(pattern)),
      evidencePathOptions: (invariant.evidencePaths ?? []).map((pattern) => serializePattern(pattern)),
    };
  });
}

function firstChangedLine(file: {
  readonly hunks: ReadonlyArray<{ readonly newStart: number; readonly oldStart: number }>;
}): number {
  const hunk = file.hunks[0];
  return Math.max(1, hunk?.newStart ?? hunk?.oldStart ?? 1);
}

export function defineProtectedInvariantChange(options: ProtectedInvariantChangeOptions = {}): ChangeRule {
  options = structuredClone(options);
  const invariants = compile(options);

  return defineRule({
    lifecycle: "change",
    standard: {
      id: "core/protected-invariant-change",
      revision: 1,
      title: "Protected invariants receive human review",
      summary:
        "Flags changes to repository-declared invariant surfaces and their supporting evidence so architectural guarantees cannot change silently.",
      guidance: {
        standard:
          "A change to a protected surface preserves the named invariant, and the evidence used to establish that claim remains applicable. Only a human may accept an intentional exception.",
        checks: [
          "Read the invariant statement before reading the proposed solution.",
          "Trace the affected value or capability across every relevant process and persistence boundary.",
          "Inspect the named tests, probes or policy records; their existence alone is not evidence that they exercise this change.",
          "PASS with a concrete path showing the invariant still holds. FAIL by repairing the design or explicitly changing the repository-owned invariant.",
        ],
        examples: [
          {
            label: "REVIEW",
            code: "protectedPaths: [/^src\\/biometrics\\//, /^src\\/server\\/uploads\\//]",
            description:
              "A repository can gate every path capable of violating a client-only biometric-data invariant.",
          },
        ],
        refs: [
          { type: "url", href: "https://alexn.org/blog/2026/09/22/ai-has-no-wisdom-and-neither-will-you/#isso-thread" },
        ],
      },
    },
    binding: {
      id: "core/protected-invariant-change",
      authority: "human",
      include: ["**/*"],
      options: {
        invariants: invariants.map((invariant) => ({
          id: invariant.id,
          statement: invariant.statement,
          protectedPaths: invariant.protectedPathOptions,
          evidencePaths: invariant.evidencePathOptions,
        })),
      },
    },
    detector: {
      id: "core/protected-invariant-change",
      version: 1,
      fixtures: {
        mustReport: [],
        mustStaySilent: [{ before: {}, after: { "src/module.ts": "export const value = 1;\n" } }],
      },
      detect({ context }) {
        for (const invariant of invariants) {
          const affected = context.change.files.filter((file) =>
            [...invariant.protectedPaths, ...(invariant.evidencePaths ?? [])].some((pattern) =>
              matches(pattern, file.path),
            ),
          );
          const first = affected.toSorted((left, right) => left.path.localeCompare(right.path))[0];
          if (!first) continue;
          const paths = affected.map((file) => file.path).toSorted();
          context.report({
            key: invariant.id,
            file: first.path,
            lineageKey: invariant.id,
            message: `Protected invariant \`${invariant.id}\` is affected: ${invariant.statement}`,
            evidence: { id: invariant.id, statement: invariant.statement, files: paths },
            relatedFiles: paths.filter((path) => path !== first.path),
            excerpt: invariant.statement,
            startLine: firstChangedLine(first),
            endLine: firstChangedLine(first),
          });
        }
      },
    },
  });
}

export const protectedInvariantChange = defineProtectedInvariantChange();
