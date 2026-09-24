import { eslintCompatPlugin } from "@oxlint/plugins";
import { noAssetApiThemeWrites } from "./rules/no-asset-api-theme-writes/rule.js";
import { noAdminRestApi } from "./rules/no-admin-rest-api/rule.js";
import { noDraftOrderCustomDiscounts } from "./rules/no-draft-order-custom-discounts/rule.js";
import { noNavEmoji } from "./rules/no-nav-emoji/rule.js";
import { noScriptTagApi } from "./rules/no-script-tag-api/rule.js";
import { noViewportZoomDisable } from "./rules/no-viewport-zoom-disable/rule.js";
import { requireFetchAbortSignal } from "./rules/require-fetch-abort-signal/rule.js";
import { sModalActionsUseSlots } from "./rules/s-modal-actions-use-slots/rule.js";
import { sModalHeadingRequired } from "./rules/s-modal-heading-required/rule.js";
import { sActionSlotContract } from "./rules/s-action-slot-contract/rule.js";
import { sButtonAccessibleName } from "./rules/s-button-accessible-name/rule.js";
import { sButtonSubmitNoNavigation } from "./rules/s-button-submit-no-navigation/rule.js";
import { sFormControlLabelRequired } from "./rules/s-form-control-label-required/rule.js";
import { sPageAsideVisible } from "./rules/s-page-aside-visible/rule.js";
import { sSpinnerAccessibleLabel } from "./rules/s-spinner-accessible-label/rule.js";
import { sKnownComponents } from "./rules/s-known-components/rule.js";
import { sClickableAccessibleName } from "./rules/s-clickable-accessible-name/rule.js";
import { sMoneyFieldNoCurrencySymbol } from "./rules/s-money-field-no-currency-symbol/rule.js";
import { sTooltipNoInteractiveContent } from "./rules/s-tooltip-no-interactive-content/rule.js";
import { functionsNoUnavailableRuntimeApis } from "./rules/functions-no-unavailable-runtime-apis/rule.js";
import { noHardcodedBillingTestMode } from "./rules/no-hardcoded-billing-test-mode/rule.js";
import { noRouterRedirectInEmbeddedRoute } from "./rules/no-router-redirect-in-embedded-route/rule.js";
import { noSessionOrTokenLogging } from "./rules/no-session-or-token-logging/rule.js";
import { noSwallowedAuthResponse } from "./rules/no-swallowed-auth-response/rule.js";
import { requireIdempotentMutations } from "./rules/require-idempotent-mutations/rule.js";
import { requireMutationUserErrors } from "./rules/require-mutation-user-errors/rule.js";
import { webhookHmacVerificationShape } from "./rules/webhook-hmac-verification-shape/rule.js";

export default eslintCompatPlugin({
  meta: {
    name: "shopify-app",
  },
  rules: {
    "functions-no-unavailable-runtime-apis": functionsNoUnavailableRuntimeApis,
    "no-admin-rest-api": noAdminRestApi,
    "no-asset-api-theme-writes": noAssetApiThemeWrites,
    "no-draft-order-custom-discounts": noDraftOrderCustomDiscounts,
    "no-hardcoded-billing-test-mode": noHardcodedBillingTestMode,
    "no-nav-emoji": noNavEmoji,
    "no-router-redirect-in-embedded-route": noRouterRedirectInEmbeddedRoute,
    "no-script-tag-api": noScriptTagApi,
    "no-session-or-token-logging": noSessionOrTokenLogging,
    "no-swallowed-auth-response": noSwallowedAuthResponse,
    "no-viewport-zoom-disable": noViewportZoomDisable,
    "require-fetch-abort-signal": requireFetchAbortSignal,
    "require-idempotent-mutations": requireIdempotentMutations,
    "require-mutation-user-errors": requireMutationUserErrors,
    "s-action-slot-contract": sActionSlotContract,
    "s-button-accessible-name": sButtonAccessibleName,
    "s-button-submit-no-navigation": sButtonSubmitNoNavigation,
    "s-clickable-accessible-name": sClickableAccessibleName,
    "s-form-control-label-required": sFormControlLabelRequired,
    "s-known-components": sKnownComponents,
    "s-modal-actions-use-slots": sModalActionsUseSlots,
    "s-modal-heading-required": sModalHeadingRequired,
    "s-money-field-no-currency-symbol": sMoneyFieldNoCurrencySymbol,
    "s-page-aside-visible": sPageAsideVisible,
    "s-spinner-accessible-label": sSpinnerAccessibleLabel,
    "s-tooltip-no-interactive-content": sTooltipNoInteractiveContent,
    "webhook-hmac-verification-shape": webhookHmacVerificationShape,
  },
});
