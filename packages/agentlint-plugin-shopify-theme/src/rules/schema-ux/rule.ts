import { defineRule, type AgentlintRule } from "@aurelienbbn/agentlint";

export type SchemaUxOptions = {
  /** Files containing merchant-facing settings schemas. */
  readonly filePattern?: RegExp;
  /** Settings per group before header grouping is required. */
  readonly groupingThreshold?: number;
};

const defaultFilePattern = /config\/settings_schema\.json$/;

type SettingsGroup = {
  readonly name?: string;
  readonly settings?: readonly { readonly type?: string; readonly label?: string; readonly id?: string }[];
};

export function defineSchemaUx(options: SchemaUxOptions = {}): AgentlintRule {
  const filePattern = options.filePattern ?? defaultFilePattern;
  const groupingThreshold = options.groupingThreshold ?? 8;

  return defineRule({
    id: "shopify-theme/schema-ux",
    description: "Reviews merchant-facing settings schemas for translated labels and digestible grouping.",
    guidance: {
      standard:
        "Settings are the merchant's API. Labels come from schema locale files (t: keys) so every market gets translated settings; long flat lists get header groupings so the editor sidebar stays scannable.",
      checks: [
        "Every label, info, and group name is a t: key, not hardcoded English.",
        "Groups with many settings use header settings to chunk related options.",
        "Setting counts stay lean: prefer presets over ever more knobs.",
      ],
    },
    createOnce(context) {
      return {
        before(filename) {
          if (!filePattern.test(filename.replaceAll("\\", "/"))) return false;
          return undefined;
        },
        document(node) {
          let groups: readonly SettingsGroup[];
          try {
            groups = JSON.parse(context.getSourceCode()) as readonly SettingsGroup[];
          } catch {
            return;
          }
          if (!Array.isArray(groups)) return;

          for (const group of groups) {
            const settings = group.settings ?? [];
            const labelled = settings.filter((setting) => typeof setting.label === "string");
            const hardcoded = labelled.filter((setting) => !setting.label?.startsWith("t:"));
            if (hardcoded.length > 0) {
              context.report({
                node,
                message: `settings group "${group.name ?? "?"}" has ${hardcoded.length} hardcoded label(s): use t: schema locale keys.`,
              });
            }
            const identified = settings.filter((setting) => setting.id !== undefined).length;
            const hasHeaders = settings.some((setting) => setting.type === "header");
            if (identified > groupingThreshold && !hasHeaders) {
              context.report({
                node,
                message: `settings group "${group.name ?? "?"}" exposes ${identified} settings without header grouping.`,
              });
            }
          }
        },
      };
    },
  });
}

export const schemaUx = defineSchemaUx();
