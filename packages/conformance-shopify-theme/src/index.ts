import { assetBudget } from "./checks/asset-budget.js";
import { contrastGuard } from "./checks/contrast-guard.js";
import { eventContract } from "./checks/event-contract.js";
import { headingOrder } from "./checks/heading-order.js";
import { imageDimensions } from "./checks/image-dimensions.js";
import { imagePolicy } from "./checks/image-policy.js";
import { landmarks } from "./checks/landmarks.js";
import { lcpPriority } from "./checks/lcp-priority.js";
import { liquiddocParams } from "./checks/liquiddoc-params.js";
import { liquiddocRequired } from "./checks/liquiddoc-required.js";
import { localesDefault } from "./checks/locales-default.js";
import { metaCompleteness } from "./checks/meta-completeness.js";
import { noParserBlockingScripts } from "./checks/no-parser-blocking-scripts.js";
import { orphanLocaleKeys } from "./checks/orphan-locale-keys.js";
import { presetCompleteness } from "./checks/preset-completeness.js";
import { presetValidity } from "./checks/preset-validity.js";
import { registrySync } from "./checks/registry-sync.js";
import { requiredStructure } from "./checks/required-structure.js";
import { routeCoverage } from "./checks/route-coverage.js";
import { schemaLocaleKeys } from "./checks/schema-locale-keys.js";
import { sectionSchemaValid } from "./checks/section-schema-valid.js";
import { seoContract } from "./checks/seo-contract.js";
import { settingsSchema } from "./checks/settings-schema.js";
import { stylesheetScope } from "./checks/stylesheet-scope.js";
import { surfaceClasses } from "./checks/surface-classes.js";
import { templatesValid } from "./checks/templates-valid.js";
import { themeLiquidContract } from "./checks/theme-liquid-contract.js";
import { tokenContract } from "./checks/token-contract.js";
import { utilityGrammar } from "./checks/utility-grammar.js";
import { visibleIfReferences } from "./checks/visible-if-references.js";
import type { ConformanceCheck, ConformanceFinding, ConformanceRunOptions } from "./finding.js";

export type {
  AssetBudget,
  ConformanceCheck,
  ConformanceFinding,
  ConformanceRunOptions,
  ConformanceSeverity,
} from "./finding.js";
export type { Registry, RegistryDelivery, RegistryEntry, RegistrySurface } from "./registry-support.js";
export { loadRegistry } from "./registry-support.js";
export { assetBudget } from "./checks/asset-budget.js";
export { contrastGuard } from "./checks/contrast-guard.js";
export { eventContract } from "./checks/event-contract.js";
export { headingOrder } from "./checks/heading-order.js";
export { imageDimensions } from "./checks/image-dimensions.js";
export { imagePolicy } from "./checks/image-policy.js";
export { landmarks } from "./checks/landmarks.js";
export { lcpPriority } from "./checks/lcp-priority.js";
export { liquiddocParams } from "./checks/liquiddoc-params.js";
export { liquiddocRequired } from "./checks/liquiddoc-required.js";
export { localesDefault } from "./checks/locales-default.js";
export { metaCompleteness } from "./checks/meta-completeness.js";
export { noParserBlockingScripts } from "./checks/no-parser-blocking-scripts.js";
export { orphanLocaleKeys } from "./checks/orphan-locale-keys.js";
export { presetCompleteness } from "./checks/preset-completeness.js";
export { presetValidity } from "./checks/preset-validity.js";
export { registrySync } from "./checks/registry-sync.js";
export { requiredStructure } from "./checks/required-structure.js";
export { routeCoverage } from "./checks/route-coverage.js";
export { schemaLocaleKeys } from "./checks/schema-locale-keys.js";
export { sectionSchemaValid } from "./checks/section-schema-valid.js";
export { seoContract } from "./checks/seo-contract.js";
export { settingsSchema } from "./checks/settings-schema.js";
export { stylesheetScope } from "./checks/stylesheet-scope.js";
export { surfaceClasses } from "./checks/surface-classes.js";
export { templatesValid } from "./checks/templates-valid.js";
export { themeLiquidContract } from "./checks/theme-liquid-contract.js";
export { tokenContract } from "./checks/token-contract.js";
export { utilityGrammar } from "./checks/utility-grammar.js";
export { visibleIfReferences } from "./checks/visible-if-references.js";

export const shopifyThemeChecks: readonly ConformanceCheck[] = [
  requiredStructure,
  themeLiquidContract,
  localesDefault,
  templatesValid,
  settingsSchema,
  noParserBlockingScripts,
  seoContract,
  sectionSchemaValid,
  visibleIfReferences,
  presetValidity,
  presetCompleteness,
  liquiddocRequired,
  liquiddocParams,
  imageDimensions,
  imagePolicy,
  lcpPriority,
  headingOrder,
  landmarks,
  stylesheetScope,
  registrySync,
  surfaceClasses,
  eventContract,
  tokenContract,
  routeCoverage,
  schemaLocaleKeys,
  orphanLocaleKeys,
  assetBudget,
  contrastGuard,
  metaCompleteness,
  utilityGrammar,
];

export function activeChecks(options: ConformanceRunOptions): readonly ConformanceCheck[] {
  const skipped = new Set(options.skipChecks ?? []);
  return shopifyThemeChecks.filter((check) => !skipped.has(check.id));
}

export async function runShopifyThemeConformance(
  options: ConformanceRunOptions,
): Promise<readonly ConformanceFinding[]> {
  const findings: ConformanceFinding[] = [];
  for (const check of activeChecks(options)) {
    findings.push(...(await check.run(options)));
  }
  return findings;
}
