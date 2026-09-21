import { eslintCompatPlugin } from "@oxlint/plugins";
import { dependenciesFirst } from "./rules/dependencies-first/rule.js";
import { noAmbientNondeterminism } from "./rules/no-ambient-nondeterminism/rule.js";
import { noCascadingLayerProvide } from "./rules/no-cascading-layer-provide/rule.js";
import { noCatchAllCause } from "./rules/no-catch-all-cause/rule.js";
import { noEffectOrDie } from "./rules/no-effect-ordie/rule.js";
import { noFloatingEffect } from "./rules/no-floating-effect/rule.js";
import { noPlainYield } from "./rules/no-plain-yield/rule.js";
import { noNestedLayerProvide } from "./rules/no-nested-layer-provide/rule.js";
import { noRawJsonParse } from "./rules/no-raw-json-parse/rule.js";
import { noRunPromiseInRuntime } from "./rules/no-run-promise-in-runtime/rule.js";
import { noServiceConstructorImports } from "./rules/no-service-constructor-imports/rule.js";
import { noServiceDependencyParameters } from "./rules/no-service-dependency-parameters/rule.js";
import { noServiceOption } from "./rules/no-service-option/rule.js";
import { noSchemaAny } from "./rules/no-schema-any/rule.js";
import { noStaticServiceForwarders } from "./rules/no-static-service-forwarders/rule.js";
import { noSwitch } from "./rules/no-switch/rule.js";
import { noRawJsonStringify } from "./rules/no-raw-json-stringify/rule.js";
import { noUnsafeErrorChannel } from "./rules/no-unsafe-error-channel/rule.js";
import { noUnsafeEffectBody } from "./rules/no-unsafe-effect-body/rule.js";
import { noUnsafeErrorMapper } from "./rules/no-unsafe-error-mapper/rule.js";
import { noUntypedTryPromiseCatch } from "./rules/no-untyped-try-promise-catch/rule.js";
import { noUnscopedRuntimeLaunch } from "./rules/no-unscoped-runtime-launch/rule.js";
import { preferEffectArrayHelpers } from "./rules/prefer-effect-array-helpers/rule.js";
import { preferMatch } from "./rules/prefer-match/rule.js";
import { preferSchemaDecodeUnknown } from "./rules/prefer-schema-decode-unknown/rule.js";
import { requireAllConcurrency } from "./rules/require-all-concurrency/rule.js";
import { requireForEachConcurrency } from "./rules/require-for-each-concurrency/rule.js";
import { requireNamedEffectFn } from "./rules/require-named-effect-fn/rule.js";
import { requireTaggedEffectFail } from "./rules/require-tagged-effect-fail/rule.js";
import { schemaTypeAdjacent } from "./rules/schema-type-adjacent/rule.js";
import { useRootImports } from "./rules/use-root-imports/rule.js";
import { boundedRetry } from "./rules/bounded-retry/rule.js";
import { effectFnNameMatchesBinding } from "./rules/effect-fn-name-matches-binding/rule.js";
import { matchingIdentifier } from "./rules/matching-identifier/rule.js";
import { noEffectPromise } from "./rules/no-effect-promise/rule.js";
import { noEffectTypeAssertion } from "./rules/no-effect-type-assertion/rule.js";
import { noForkDetach } from "./rules/no-fork-detach/rule.js";
import { noSwallowedFailure } from "./rules/no-swallowed-failure/rule.js";
import { preferEffectFn } from "./rules/prefer-effect-fn/rule.js";
import { preferItEffect } from "./rules/prefer-it-effect/rule.js";
import { preferRunMain } from "./rules/prefer-run-main/rule.js";
import { preserveThrownCause } from "./rules/preserve-thrown-cause/rule.js";
import { requireAbortSignal } from "./rules/require-abort-signal/rule.js";
import { requireRedactedSecretConfig } from "./rules/require-redacted-secret-config/rule.js";
import { requireReturnOnFailureYield } from "./rules/require-return-on-failure-yield/rule.js";

export default eslintCompatPlugin({
  meta: {
    name: "effect",
  },
  rules: {
    "dependencies-first": dependenciesFirst,
    "no-ambient-nondeterminism": noAmbientNondeterminism,
    "no-cascading-layer-provide": noCascadingLayerProvide,
    "no-catch-all-cause": noCatchAllCause,
    "no-effect-ordie": noEffectOrDie,
    "no-floating-effect": noFloatingEffect,
    "no-nested-layer-provide": noNestedLayerProvide,
    "no-plain-yield": noPlainYield,
    "no-raw-json-parse": noRawJsonParse,
    "no-run-promise-in-runtime": noRunPromiseInRuntime,
    "no-service-constructor-imports": noServiceConstructorImports,
    "no-service-dependency-parameters": noServiceDependencyParameters,
    "no-service-option": noServiceOption,
    "no-schema-any": noSchemaAny,
    "no-static-service-forwarders": noStaticServiceForwarders,
    "no-switch": noSwitch,
    "no-raw-json-stringify": noRawJsonStringify,
    "no-unsafe-error-channel": noUnsafeErrorChannel,
    "no-unsafe-effect-body": noUnsafeEffectBody,
    "no-unsafe-error-mapper": noUnsafeErrorMapper,
    "no-untyped-try-promise-catch": noUntypedTryPromiseCatch,
    "no-unscoped-runtime-launch": noUnscopedRuntimeLaunch,
    "prefer-effect-array-helpers": preferEffectArrayHelpers,
    "prefer-match": preferMatch,
    "prefer-schema-decode-unknown": preferSchemaDecodeUnknown,
    "require-all-concurrency": requireAllConcurrency,
    "require-for-each-concurrency": requireForEachConcurrency,
    "require-named-effect-fn": requireNamedEffectFn,
    "require-tagged-effect-fail": requireTaggedEffectFail,
    "schema-type-adjacent": schemaTypeAdjacent,
    "use-root-imports": useRootImports,
    "bounded-retry": boundedRetry,
    "effect-fn-name-matches-binding": effectFnNameMatchesBinding,
    "matching-identifier": matchingIdentifier,
    "no-effect-promise": noEffectPromise,
    "no-effect-type-assertion": noEffectTypeAssertion,
    "no-fork-detach": noForkDetach,
    "no-swallowed-failure": noSwallowedFailure,
    "prefer-effect-fn": preferEffectFn,
    "prefer-it-effect": preferItEffect,
    "prefer-run-main": preferRunMain,
    "preserve-thrown-cause": preserveThrownCause,
    "require-abort-signal": requireAbortSignal,
    "require-redacted-secret-config": requireRedactedSecretConfig,
    "require-return-on-failure-yield": requireReturnOnFailureYield,
  },
});
