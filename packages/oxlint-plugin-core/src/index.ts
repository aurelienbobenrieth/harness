import { eslintCompatPlugin } from "@oxlint/plugins";
import { noAmbientNondeterminismInTests } from "./rules/no-ambient-nondeterminism-in-tests/rule.js";
import { noDeadComments } from "./rules/no-dead-comments/rule.js";
import { noDiscardedCaughtError } from "./rules/no-discarded-caught-error/rule.js";
import { noErrorMessageMatching } from "./rules/no-error-message-matching/rule.js";
import { noExportedAnonymousObjectReturn } from "./rules/no-exported-anonymous-object-return/rule.js";
import { noLet } from "./rules/no-let/rule.js";
import { noMultiPositionalParameters } from "./rules/no-multi-positional-parameters/rule.js";
import { noMutableExportedState } from "./rules/no-mutable-exported-state/rule.js";
import { noReexportOnlyModules } from "./rules/no-reexport-only-modules/rule.js";
import { noStubbedSubject } from "./rules/no-stubbed-subject/rule.js";
import { noTestLogicInProduction } from "./rules/no-test-logic-in-production/rule.js";
import { noTestSleeps } from "./rules/no-test-sleeps/rule.js";
import { noVitestInSource } from "./rules/no-vitest-in-source/rule.js";
import { noVitestMocking } from "./rules/no-vitest-mocking/rule.js";
import { noWeakTestAssertions } from "./rules/no-weak-test-assertions/rule.js";
import { paddingBeforeExit } from "./rules/padding-before-exit/rule.js";

export default eslintCompatPlugin({
  meta: {
    name: "core",
  },
  rules: {
    "no-ambient-nondeterminism-in-tests": noAmbientNondeterminismInTests,
    "no-dead-comments": noDeadComments,
    "no-discarded-caught-error": noDiscardedCaughtError,
    "no-error-message-matching": noErrorMessageMatching,
    "no-exported-anonymous-object-return": noExportedAnonymousObjectReturn,
    "no-let": noLet,
    "no-multi-positional-parameters": noMultiPositionalParameters,
    "no-mutable-exported-state": noMutableExportedState,
    "no-reexport-only-modules": noReexportOnlyModules,
    "no-stubbed-subject": noStubbedSubject,
    "no-test-logic-in-production": noTestLogicInProduction,
    "no-test-sleeps": noTestSleeps,
    "no-vitest-in-source": noVitestInSource,
    "no-vitest-mocking": noVitestMocking,
    "no-weak-test-assertions": noWeakTestAssertions,
    "padding-before-exit": paddingBeforeExit,
  },
});
