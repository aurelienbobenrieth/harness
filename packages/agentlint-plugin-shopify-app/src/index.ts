import { defineConfig } from "@aurelienbbn/agentlint";
import { actionLabelClarity } from "./rules/action-label-clarity/rule.js";
import { adminApiLoopReview } from "./rules/admin-api-loop-review/rule.js";
import { bannerUsage } from "./rules/banner-usage/rule.js";
import { checkoutNetworkDiscipline } from "./rules/checkout-network-discipline/rule.js";
import { destructiveActionReview } from "./rules/destructive-action-review/rule.js";
import { formErrorRecovery } from "./rules/form-error-recovery/rule.js";
import { modalWorkflowReview } from "./rules/modal-workflow-review/rule.js";
import { noPressureCopy } from "./rules/no-pressure-copy/rule.js";
import { reviewSolicitation } from "./rules/review-solicitation/rule.js";
import { sessionTokenAuth } from "./rules/session-token-auth/rule.js";
import { settingsSaveBar } from "./rules/settings-save-bar/rule.js";
import { webhookHandlerReview } from "./rules/webhook-handler-review/rule.js";

export {
  actionLabelClarity,
  defineActionLabelClarity,
  type ActionLabelClarityOptions,
} from "./rules/action-label-clarity/rule.js";
export {
  adminApiLoopReview,
  defineAdminApiLoopReview,
  type AdminApiLoopReviewOptions,
} from "./rules/admin-api-loop-review/rule.js";
export {
  appUxReview,
  defineAppUxReview,
  type AppUxReviewOptions,
  type AppUxReviewTarget,
  type AppUxReviewArea,
} from "./rules/app-ux-review/rule.js";
export { bannerUsage, defineBannerUsage, type BannerUsageOptions } from "./rules/banner-usage/rule.js";
export {
  destructiveActionReview,
  defineDestructiveActionReview,
  type DestructiveActionReviewOptions,
} from "./rules/destructive-action-review/rule.js";
export {
  defineFlowActionHandlerReview,
  flowActionHandlerReview,
  type FlowActionHandlerReviewOptions,
} from "./rules/flow-action-handler-review/rule.js";
export {
  formErrorRecovery,
  defineFormErrorRecovery,
  type FormErrorRecoveryOptions,
} from "./rules/form-error-recovery/rule.js";
export {
  modalWorkflowReview,
  defineModalWorkflowReview,
  type ModalWorkflowReviewOptions,
} from "./rules/modal-workflow-review/rule.js";
export {
  reviewSolicitation,
  defineReviewSolicitation,
  type ReviewSolicitationOptions,
} from "./rules/review-solicitation/rule.js";

export {
  checkoutNetworkDiscipline,
  defineCheckoutNetworkDiscipline,
  type CheckoutNetworkDisciplineOptions,
} from "./rules/checkout-network-discipline/rule.js";
export {
  defineNoPressureCopy,
  noPressureCopy,
  type NoPressureCopyOptions,
  type PressureCopyLanguage,
} from "./rules/no-pressure-copy/rule.js";
export {
  defineSessionTokenAuth,
  sessionTokenAuth,
  type SessionTokenAuthOptions,
} from "./rules/session-token-auth/rule.js";
export { defineSettingsSaveBar, settingsSaveBar, type SettingsSaveBarOptions } from "./rules/settings-save-bar/rule.js";
export {
  defineScopeChangeReview,
  scopeChangeReview,
  type ScopeChangeReviewOptions,
} from "./rules/scope-change-review/rule.js";
export {
  defineWebhookHandlerReview,
  webhookHandlerReview,
  type WebhookHandlerReviewOptions,
} from "./rules/webhook-handler-review/rule.js";

export const shopifyAppPreset = defineConfig({
  rules: [
    actionLabelClarity,
    bannerUsage,
    destructiveActionReview,
    formErrorRecovery,
    modalWorkflowReview,
    noPressureCopy,
    reviewSolicitation,
    sessionTokenAuth,
    settingsSaveBar,
  ],

  ignores: ["**/*.d.ts"],
});

/**
 * Server-side reviews for Admin API usage and webhook handlers. `scopeChangeReview` and
 * `flowActionHandlerReview` are opt-in and deliberately absent from every preset.
 */
export const appServerPreset = defineConfig({
  rules: [adminApiLoopReview, webhookHandlerReview],

  ignores: ["**/*.d.ts"],
});

export const checkoutExtensionPreset = defineConfig({
  rules: [checkoutNetworkDiscipline],

  ignores: ["**/*.d.ts"],
});

/** Small, explicitly selected starting point. Calibrate its scope before enforcing it.
 * @attribution desloppify by Peter O'Malley (workflow inspiration only; independently implemented)
 */
export const starterPreset = defineConfig({
  rules: [sessionTokenAuth, formErrorRecovery],
  ignores: ["**/*.d.ts"],
});
