import { defineRule } from "@aurelienbbn/agentlint";

const exportedInterfacePattern = /^\s*export\s+interface\s+\w+/u;
const exportedObjectTypePattern = /^\s*export\s+type\s+\w+\s*=\s*\{/u;
const schemaHelperSource = String.raw`Schema\.(?:Schema\.Type|Codec\.Encoded)<\s*typeof\s+[\w$.]+\s*>`;
const schemaMemberSource = String.raw`typeof\s+[\w$.]+\s*(?:\.\s*(?:Type|Encoded)\b|\[\s*["'](?:Type|Encoded)["']\s*\])`;
const schemaDerivedTypePattern = new RegExp(
  String.raw`^\s*export\s+type\s+\w+\s*=\s*(?:${schemaMemberSource}|${schemaHelperSource})\s*;?\s*$`,
  "u",
);
const schemaDerivedInterfacePattern = new RegExp(
  String.raw`^\s*export\s+interface\s+\w+\s+extends\s+${schemaHelperSource}\s*\{\s*\}\s*$`,
  "u",
);

function shouldReportManualContract(text: string): boolean {
  if (schemaDerivedTypePattern.test(text) || schemaDerivedInterfacePattern.test(text)) return false;

  return exportedInterfacePattern.test(text) || exportedObjectTypePattern.test(text);
}

export const preferSchemaContracts = defineRule({
  lifecycle: "state",
  standard: {
    id: "effect/prefer-schema-contracts",
    revision: 2,
    title: "Prefer Schema Contracts",
    summary: "Flags exported manual object contracts that need Effect Schema ownership.",
    guidance: {
      standard:
        "Exported object contracts in Effect projects should come from Effect Schema when decoding untrusted inputs or serializing persisted or wire data. A module export alone does not require runtime validation.",
      checks: [
        'Boundary contracts use a Schema declaration with an adjacent derived alias: `typeof X["Type"]` / `typeof X["Encoded"]` (the spelling in `effect/ai-docs/src/01_effect/02_schema/10_schema-basics.ts`), `typeof X.Type` / `typeof X.Encoded`, or `Schema.Schema.Type<typeof X>` / `Schema.Codec.Encoded<typeof X>`.',
        "Manual exported object contracts are limited to internal compile-time structures, helper generics, or intentionally non-runtime contracts.",
        "The reason for keeping a manual exported contract is clear from naming, placement, or nearby code.",
      ],
    },
  },
  binding: {
    id: "effect/prefer-schema-contracts",
    authority: "agent",
    include: ["**/*.{ts,tsx}"],
    exclude: ["**/*.d.ts"],
  },
  detector: {
    fixtures: {
      mustReport: [{ file: "src/module.ts", source: "export interface User {id:string}" }],
      mustStaySilent: [
        { file: "src/module.ts", source: "interface Internal {id:string}" },
        { file: "src/module.ts", source: 'export type User = typeof User["Type"];' },
        {
          file: "src/module.ts",
          source: "export interface User extends Schema.Schema.Type<typeof UserSchema> {}",
        },
      ],
    },
    id: "effect/prefer-schema-contracts",
    version: 2,
    scan: "file",
    createOnce(context) {
      return {
        interface_declaration(node) {
          if (!shouldReportManualContract(node.parent?.type === "export_statement" ? node.parent.text : node.text))
            return;

          context.report({
            node,
            message: "Exported interface needs an Effect Schema source of truth or an explicit non-runtime reason.",
          });
        },
        type_alias_declaration(node) {
          if (!shouldReportManualContract(node.parent?.type === "export_statement" ? node.parent.text : node.text))
            return;

          context.report({
            node,
            message: "Exported object type needs an Effect Schema source of truth or an explicit non-runtime reason.",
          });
        },
      };
    },
  },
});
