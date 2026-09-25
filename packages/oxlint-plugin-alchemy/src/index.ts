import { eslintCompatPlugin } from "@oxlint/plugins";
import { configInInit } from "./rules/config-in-init/rule.js";
import { noDisposableInInstanceScope } from "./rules/no-disposable-in-instance-scope/rule.js";
import { workerEnvSecretLiteral } from "./rules/worker-env-secret-literal/rule.js";
import { workflowIoOutsideTask } from "./rules/workflow-io-outside-task/rule.js";

export default eslintCompatPlugin({
  meta: {
    name: "alchemy",
  },
  rules: {
    "config-in-init": configInInit,
    "no-disposable-in-instance-scope": noDisposableInInstanceScope,
    "worker-env-secret-literal": workerEnvSecretLiteral,
    "workflow-io-outside-task": workflowIoOutsideTask,
  },
});
