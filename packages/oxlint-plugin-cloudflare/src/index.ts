import { eslintCompatPlugin } from "@oxlint/plugins";
import { durableObjectInitConcurrency } from "./rules/durable-object-init-concurrency/rule.js";
import { mysql2DisableEval } from "./rules/mysql2-disable-eval/rule.js";
import { noDetachedExecutionContextMethod } from "./rules/no-detached-execution-context-method/rule.js";
import { noInterpolatedSql } from "./rules/no-interpolated-sql/rule.js";
import { noModuleScopeRequestState } from "./rules/no-module-scope-request-state/rule.js";
import { timingSafeSecretCompare } from "./rules/timing-safe-secret-compare/rule.js";
import { workflowDeterministicSteps } from "./rules/workflow-deterministic-steps/rule.js";

export default eslintCompatPlugin({
  meta: {
    name: "cloudflare",
  },
  rules: {
    "durable-object-init-concurrency": durableObjectInitConcurrency,
    "mysql2-disable-eval": mysql2DisableEval,
    "no-detached-execution-context-method": noDetachedExecutionContextMethod,
    "no-interpolated-sql": noInterpolatedSql,
    "no-module-scope-request-state": noModuleScopeRequestState,
    "timing-safe-secret-compare": timingSafeSecretCompare,
    "workflow-deterministic-steps": workflowDeterministicSteps,
  },
});
