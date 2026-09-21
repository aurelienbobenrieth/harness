import { defineConfig } from "@aurelienbbn/agentlint";
import { abstractionEarnsKeep } from "./rules/abstraction-earns-keep/rule.js";
import { boundaryResilience } from "./rules/boundary-resilience/rule.js";
import { boundedDataAccess } from "./rules/bounded-data-access/rule.js";
import { boundedWork } from "./rules/bounded-work/rule.js";
import { commentSignal } from "./rules/comment-signal/rule.js";
import { correlatedOptionalState } from "./rules/correlated-optional-state/rule.js";
import { expectedValueRecomputed } from "./rules/expected-value-recomputed/rule.js";
import { integrationTestOwnsItsBoundary } from "./rules/integration-test-owns-its-boundary/rule.js";
import { temporalCoupling } from "./rules/temporal-coupling/rule.js";
import { testBehaviorCoverage } from "./rules/test-behavior-coverage/rule.js";
import { testExercisesProjectCode } from "./rules/test-exercises-project-code/rule.js";
import { testExpectationDrift } from "./rules/test-expectation-drift/rule.js";

export {
  abstractionEarnsKeep,
  defineAbstractionEarnsKeep,
  type AbstractionEarnsKeepOptions,
} from "./rules/abstraction-earns-keep/rule.js";
export {
  boundaryResilience,
  defineBoundaryResilience,
  type BoundaryResilienceOptions,
} from "./rules/boundary-resilience/rule.js";
export { boundedDataAccess } from "./rules/bounded-data-access/rule.js";
export { boundedWork } from "./rules/bounded-work/rule.js";
export { commentSignal, defineCommentSignal, type CommentSignalOptions } from "./rules/comment-signal/rule.js";
export {
  defineFallbackMasksFailure,
  fallbackMasksFailure,
  type FallbackMasksFailureOptions,
} from "./rules/fallback-masks-failure/rule.js";
export {
  defineTestBehaviorCoverage,
  testBehaviorCoverage,
  type TestBehaviorCoverageOptions,
} from "./rules/test-behavior-coverage/rule.js";

export {
  correlatedOptionalState,
  defineCorrelatedOptionalState,
  type CorrelatedOptionalStateOptions,
} from "./rules/correlated-optional-state/rule.js";
export {
  expectedValueRecomputed,
  defineExpectedValueRecomputed,
  type ExpectedValueRecomputedOptions,
} from "./rules/expected-value-recomputed/rule.js";
export {
  integrationTestOwnsItsBoundary,
  defineIntegrationTestOwnsItsBoundary,
  type IntegrationTestOwnsItsBoundaryOptions,
} from "./rules/integration-test-owns-its-boundary/rule.js";
export {
  temporalCoupling,
  defineTemporalCoupling,
  type TemporalCouplingOptions,
} from "./rules/temporal-coupling/rule.js";
export {
  testExercisesProjectCode,
  defineTestExercisesProjectCode,
  type TestExercisesProjectCodeOptions,
} from "./rules/test-exercises-project-code/rule.js";
export {
  testExpectationDrift,
  defineTestExpectationDrift,
  type TestExpectationDriftOptions,
} from "./rules/test-expectation-drift/rule.js";

export { fakeParity, defineFakeParity, type FakeParityOptions } from "./rules/fake-parity/rule.js";
export {
  flagForkedFunction,
  defineFlagForkedFunction,
  type FlagForkedFunctionOptions,
} from "./rules/flag-forked-function/rule.js";
export {
  isomorphicMapping,
  defineIsomorphicMapping,
  type IsomorphicMappingOptions,
} from "./rules/isomorphic-mapping/rule.js";
export {
  pinnedSuspectOutput,
  definePinnedSuspectOutput,
  type PinnedSuspectOutputOptions,
} from "./rules/pinned-suspect-output/rule.js";
export {
  propertyTestOpportunity,
  definePropertyTestOpportunity,
  type InversePairPattern,
  type PropertyTestOpportunityOptions,
} from "./rules/property-test-opportunity/rule.js";
export {
  validationDiscardsProof,
  defineValidationDiscardsProof,
  type ValidationDiscardsProofOptions,
} from "./rules/validation-discards-proof/rule.js";

/**
 * Every settled core rule. Opt-in rules (`fallbackMasksFailure`, `fakeParity`, `flagForkedFunction`,
 * `isomorphicMapping`, `pinnedSuspectOutput`, `propertyTestOpportunity`, `validationDiscardsProof`) are exported
 * but stay out until calibrated.
 */
export const strictPreset = defineConfig({
  rules: [
    abstractionEarnsKeep,
    boundaryResilience,
    boundedDataAccess,
    boundedWork,
    commentSignal,
    correlatedOptionalState,
    expectedValueRecomputed,
    integrationTestOwnsItsBoundary,
    temporalCoupling,
    testBehaviorCoverage,
    testExercisesProjectCode,
    testExpectationDrift,
  ],

  ignores: ["**/*.d.ts"],
});

/** Small, explicitly selected starting point. Calibrate its scope before enforcing it.
 * @attribution desloppify by Peter O'Malley (workflow inspiration only; independently implemented)
 */
export const starterPreset = defineConfig({
  rules: [boundaryResilience, boundedWork],
  ignores: ["**/*.d.ts"],
});
