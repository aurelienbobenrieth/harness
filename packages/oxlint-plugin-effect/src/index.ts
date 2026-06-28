import { eslintCompatPlugin } from "@oxlint/plugins";
import { dependenciesFirst } from "./rules/dependencies-first/rule.js";
import { noCatchAllCause } from "./rules/no-catch-all-cause/rule.js";
import { noEffectOrDie } from "./rules/no-effect-ordie/rule.js";
import { noRawJsonParse } from "./rules/no-raw-json-parse/rule.js";
import { noRunPromiseInRuntime } from "./rules/no-run-promise-in-runtime/rule.js";
import { noServiceDependencyParameters } from "./rules/no-service-dependency-parameters/rule.js";
import { noSchemaAny } from "./rules/no-schema-any/rule.js";
import { noRawJsonStringify } from "./rules/no-raw-json-stringify/rule.js";
import { noUnsafeErrorChannel } from "./rules/no-unsafe-error-channel/rule.js";
import { noUnsafeEffectBody } from "./rules/no-unsafe-effect-body/rule.js";
import { noUnsafeErrorMapper } from "./rules/no-unsafe-error-mapper/rule.js";
import { preferEffectArrayHelpers } from "./rules/prefer-effect-array-helpers/rule.js";
import { requireForEachConcurrency } from "./rules/require-for-each-concurrency/rule.js";
import { requireNamedEffectFn } from "./rules/require-named-effect-fn/rule.js";
import { requireTaggedEffectFail } from "./rules/require-tagged-effect-fail/rule.js";
import { schemaTypeAdjacent } from "./rules/schema-type-adjacent/rule.js";
import { useRootImports } from "./rules/use-root-imports/rule.js";

export default eslintCompatPlugin({
  meta: {
    name: "effect",
  },
  rules: {
    "dependencies-first": dependenciesFirst,
    "no-catch-all-cause": noCatchAllCause,
    "no-effect-ordie": noEffectOrDie,
    "no-raw-json-parse": noRawJsonParse,
    "no-run-promise-in-runtime": noRunPromiseInRuntime,
    "no-service-dependency-parameters": noServiceDependencyParameters,
    "no-schema-any": noSchemaAny,
    "no-raw-json-stringify": noRawJsonStringify,
    "no-unsafe-error-channel": noUnsafeErrorChannel,
    "no-unsafe-effect-body": noUnsafeEffectBody,
    "no-unsafe-error-mapper": noUnsafeErrorMapper,
    "prefer-effect-array-helpers": preferEffectArrayHelpers,
    "require-for-each-concurrency": requireForEachConcurrency,
    "require-named-effect-fn": requireNamedEffectFn,
    "require-tagged-effect-fail": requireTaggedEffectFail,
    "schema-type-adjacent": schemaTypeAdjacent,
    "use-root-imports": useRootImports,
  },
});
