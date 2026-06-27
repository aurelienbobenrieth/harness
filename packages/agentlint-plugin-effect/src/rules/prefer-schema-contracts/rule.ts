import { defineRule } from "@aurelienbbn/agentlint";

const exportedInterfacePattern = /^\s*export\s+interface\s+\w+/u;
const exportedObjectTypePattern = /^\s*export\s+type\s+\w+\s*=\s*\{/u;
const schemaDerivedTypePattern = /^\s*export\s+type\s+\w+\s*=\s*typeof\s+\w+\.(?:Type|Encoded)\s*;?\s*$/u;

function shouldReportManualContract(text: string): boolean {
  if (schemaDerivedTypePattern.test(text)) return false;

  return exportedInterfacePattern.test(text) || exportedObjectTypePattern.test(text);
}

export const preferSchemaContracts = defineRule({
  meta: {
    name: "effect/prefer-schema-contracts",
    description: "Flags exported manual object contracts that should usually be backed by Effect Schema.",
    languages: ["ts", "tsx"],
    instruction:
      "Review exported manual object contracts in Effect projects. Convert the contract to a Schema declaration plus adjacent `typeof Schema.Type` alias when it crosses a boundary or needs validation, decoding, or encoding. Keep the manual type only when it is purely internal compile-time structure, helper generics, or intentionally not a runtime contract, and record that reason.",
  },
  createOnce(context) {
    return {
      interface_declaration(node) {
        if (!shouldReportManualContract(node.text)) return;

        context.flag({
          node,
          message: "Exported interface should be reviewed for an Effect Schema source of truth.",
        });
      },
      type_alias_declaration(node) {
        if (!shouldReportManualContract(node.text)) return;

        context.flag({
          node,
          message: "Exported object type should be reviewed for an Effect Schema source of truth.",
        });
      },
    };
  },
});
