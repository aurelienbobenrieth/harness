import { eslintCompatPlugin } from "@oxlint/plugins";
import { machineNaming } from "./rules/machine-naming/rule.js";
import { namedActorSrc } from "./rules/named-actor-src/rule.js";
import { noContextMutation } from "./rules/no-context-mutation/rule.js";
import { noImperativeActionCreator } from "./rules/no-imperative-action-creator/rule.js";
import { noMachineInRender } from "./rules/no-machine-in-render/rule.js";
import { noUnreachableTransition } from "./rules/no-unreachable-transition/rule.js";
import { preferSendTo } from "./rules/prefer-send-to/rule.js";
import { promiseActorAbortSignal } from "./rules/promise-actor-abort-signal/rule.js";
import { requireEventSatisfies } from "./rules/require-event-satisfies/rule.js";
import { requireSetupCreateMachine } from "./rules/require-setup-create-machine/rule.js";
import { stableSelectorResult } from "./rules/stable-selector-result/rule.js";

export default eslintCompatPlugin({
  meta: {
    name: "xstate",
  },
  rules: {
    "machine-naming": machineNaming,
    "named-actor-src": namedActorSrc,
    "no-context-mutation": noContextMutation,
    "no-imperative-action-creator": noImperativeActionCreator,
    "no-machine-in-render": noMachineInRender,
    "no-unreachable-transition": noUnreachableTransition,
    "prefer-send-to": preferSendTo,
    "promise-actor-abort-signal": promiseActorAbortSignal,
    "require-event-satisfies": requireEventSatisfies,
    "require-setup-create-machine": requireSetupCreateMachine,
    "stable-selector-result": stableSelectorResult,
  },
});
