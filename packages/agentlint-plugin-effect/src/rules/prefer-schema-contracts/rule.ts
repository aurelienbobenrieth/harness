import { defineRule } from "@aurelienbbn/agentlint";

const exportedInterfacePattern = /^\s*export\s+interface\s+\w+/u;
const exportedObjectTypePattern = /^\s*export\s+type\s+\w+\s*=\s*\{/u;
const schemaDerivedTypePattern =
  /^\s*export\s+type\s+\w+\s*=\s*typeof\s+\w+\.(?:Type|Encoded)\s*;?\s*$/u;

function shouldReportManualContract(text: string): boolean {
  if (schemaDerivedTypePattern.test(text)) return false;

  return exportedInterfacePattern.test(text) || exportedObjectTypePattern.test(text);
}

export const preferSchemaContracts = defineRule({
  id: "effect/prefer-schema-contracts",
  description: "Flags exported manual object contracts that need Effect Schema ownership.",
  guidance: {
    standard:
      "Exported object contracts in Effect projects should come from Effect Schema when they cross runtime or module boundaries.",
    checks: [
      "Boundary contracts use a Schema declaration with an adjacent `typeof Schema.Type` or `typeof Schema.Encoded` alias.",
      "Manual exported object contracts are limited to internal compile-time structures, helper generics, or intentionally non-runtime contracts.",
      "The reason for keeping a manual exported contract is clear from naming, placement, or nearby code.",
    ],
  },
  createOnce(context) {
    return {
      interface_declaration(node) {
        if (!shouldReportManualContract(node.text)) return;

        context.report({
          node,
          message:
            "Exported interface needs an Effect Schema source of truth or an explicit non-runtime reason.",
        });
      },
      type_alias_declaration(node) {
        if (!shouldReportManualContract(node.text)) return;

        context.report({
          node,
          message:
            "Exported object type needs an Effect Schema source of truth or an explicit non-runtime reason.",
        });
      },
    };
  },
});
