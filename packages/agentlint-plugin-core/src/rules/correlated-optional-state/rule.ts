/**
 * Flags object types that pair a literal-union status field with several optional fields.
 *
 * Bags of lifecycle booleans are out of scope here: `no-impossible-state-bag` in the type-evidence oxlint plugin
 * owns that shape deterministically.
 *
 * @attribution "Designing with types: Making illegal states unrepresentable" by Scott Wlaschin (concept)
 */
import { type AgentlintNode, defineRule, type StateRule } from "@aurelienbbn/agentlint";
import {
  matches,
  namedChildren,
  serializePattern,
  sourceFileGlobs,
  testFileExcludeGlobs,
} from "../judgment-support.js";

const defaultDiscriminantNames = ["status", "state", "kind", "type", "phase", "step", "mode", "variant"];
const defaultMinOptionalSiblings = 2;
const defaultSkipNamePattern = /(?:Props|Options|Config|Params|Args|Input|Query|Filter|Patch|Update)$/;

const nullablePattern = /\|\s*(?:null|undefined)\b/;

export type CorrelatedOptionalStateOptions = {
  /** Property names read as a state discriminant. Providing this REPLACES the built-in list. */
  readonly discriminantNames?: readonly string[];
  /** Optional or nullable sibling fields needed before the type is reported. Default: 2 */
  readonly minOptionalSiblings?: number;
  /** Declared type names that are skipped: bags of independent optionals by convention. */
  readonly skipNamePattern?: RegExp;
};

function unionMembers(type: AgentlintNode): readonly AgentlintNode[] {
  if (type.type !== "union_type") return [type];
  return namedChildren(type).flatMap(unionMembers);
}

function isStringLiteralUnion(type: AgentlintNode | undefined): boolean {
  if (!type || type.type !== "union_type") return false;
  const members = unionMembers(type);
  return (
    members.length >= 2 &&
    members.every((member) => member.type === "literal_type" && namedChildren(member)[0]?.type === "string")
  );
}

function declaredType(signature: AgentlintNode): AgentlintNode | undefined {
  return namedChildren(signature.childByFieldName("type"))[0];
}

function isOptional(signature: AgentlintNode): boolean {
  return signature.children.some((child) => child.type === "?");
}

export function defineCorrelatedOptionalState(options: CorrelatedOptionalStateOptions = {}): StateRule {
  options = structuredClone(options);
  const discriminantNames = new Set(options.discriminantNames ?? defaultDiscriminantNames);
  const minOptionalSiblings = options.minOptionalSiblings ?? defaultMinOptionalSiblings;
  const skipNamePattern = options.skipNamePattern ?? defaultSkipNamePattern;
  if (!Number.isSafeInteger(minOptionalSiblings) || minOptionalSiblings < 1)
    throw new Error("correlated-optional-state: minOptionalSiblings must be a positive integer.");

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "core/correlated-optional-state",
      revision: 1,
      title: "Correlated Optional State",
      summary:
        "Flags object types that pair a literal-union status field with two or more optional fields, where a discriminated union would make illegal combinations unrepresentable.",
      guidance: {
        standard:
          "When which fields are present depends on a status, the type says so: one union member per status, each carrying exactly its own fields. A flat record of status plus optionals admits combinations that never occur, and every reader pays for it with non-null assertions and re-checks.",
        checks: [
          "Search the package for read and construction sites of this type. Fails on correlation evidence, cited: a read that checks the discriminant and then non-null-asserts, re-checks or `??`-defaults one of the optionals; or construction sites that always set a given optional together with a given status value.",
          "Passes when no such site exists: the optionals are orthogonal to the discriminant.",
          "Passes when the type mirrors an external wire or database shape that is parsed into a union one step later; cite the parser.",
          "Passes for partial, patch and form-draft types where absence is the point.",
          "On fail, model one union member per status with exactly its own fields, then delete the downstream `!` and re-checks.",
        ],
        examples: [
          {
            label: "FAIL",
            description: 'Nothing stops `{ status: "idle", url }` or a failed upload without an error.',
            code: 'type Upload = { status: "idle" | "uploading" | "done" | "failed"; progress?: number; url?: string; error?: Error };',
          },
          {
            label: "PASS",
            description: "Each status carries its own fields and nothing else.",
            code: 'type Upload =\n  | { status: "idle" }\n  | { status: "uploading"; progress: number }\n  | { status: "done"; url: string }\n  | { status: "failed"; error: Error };',
          },
        ],
        refs: [
          {
            type: "url",
            href: "https://fsharpforfunandprofit.com/posts/designing-with-types-making-illegal-states-unrepresentable/",
          },
          {
            type: "url",
            href: "https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/",
          },
        ],
      },
    },
    binding: {
      id: "core/correlated-optional-state",
      authority: "agent",
      include: [...sourceFileGlobs],
      exclude: ["**/*.d.ts", ...testFileExcludeGlobs],
      options: {
        discriminantNames: options.discriminantNames ? [...options.discriminantNames] : null,
        minOptionalSiblings: options.minOptionalSiblings ?? null,
        skipNamePattern: serializePattern(options.skipNamePattern),
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            file: "src/upload.ts",
            source: 'type Upload = { status: "idle" | "done" | "failed"; url?: string; error?: Error };',
          },
        ],
        mustStaySilent: [
          {
            file: "src/upload.ts",
            source:
              'type Upload = { status: "idle" } | { status: "done"; url: string } | { status: "failed"; error: Error };',
          },
          {
            file: "src/upload.ts",
            source: 'type UploadProps = { status: "idle" | "done" | "failed"; url?: string; error?: Error };',
          },
        ],
      },
      id: "core/correlated-optional-state",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        function inspect(declaration: AgentlintNode, body: AgentlintNode | null): void {
          const name = declaration.childByFieldName("name");
          if (!name || !body || matches(skipNamePattern, name.text)) return;
          const signatures = body.children.filter((child) => child.type === "property_signature");
          const discriminant = signatures.find(
            (signature) =>
              discriminantNames.has(signature.childByFieldName("name")?.text ?? "") &&
              !isOptional(signature) &&
              isStringLiteralUnion(declaredType(signature)),
          );
          if (!discriminant) return;
          const optional = signatures
            .filter(
              (signature) =>
                signature !== discriminant &&
                (isOptional(signature) || nullablePattern.test(declaredType(signature)?.text ?? "")),
            )
            .map((signature) => signature.childByFieldName("name")?.text ?? "")
            .toSorted();
          if (optional.length < minOptionalSiblings) return;
          const discriminantName = discriminant.childByFieldName("name")?.text ?? "";
          context.report({
            node: name,
            message: `\`${name.text}\` pairs the \`${discriminantName}\` union with optional fields (${optional.join(", ")}); if their presence depends on \`${discriminantName}\`, model one union member per value.`,
            evidence: { discriminant: discriminantName, optional },
          });
        }

        return {
          interface_declaration(node) {
            inspect(node, node.childByFieldName("body"));
          },
          type_alias_declaration(node) {
            const value = node.childByFieldName("value");
            inspect(node, value?.type === "object_type" ? value : null);
          },
        };
      },
    },
  });
}

export const correlatedOptionalState = defineCorrelatedOptionalState();
