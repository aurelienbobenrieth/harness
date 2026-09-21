import { defineRule, type StateRule } from "@aurelienbbn/agentlint";
import { matchesPattern } from "../jsx-support.js";

const cookieAccessPattern = /^(?:window\.)?document\.cookie$/;
const webStorageCallPattern = /^(?:window\.)?(?:localStorage|sessionStorage)\.(?:getItem|setItem)\s*\(/;
const defaultIdentityKeyPattern = /token|session|auth|jwt|credential|api[-_]?key/i;

export type SessionTokenAuthOptions = {
  /**
   * Pattern that marks a storage key as identity-carrying. Defaults to
   * token/session/auth/jwt/credential/api-key; extend it with project-specific
   * key names (for example your own auth namespace).
   */
  readonly identityKeyPattern?: RegExp;
};

/**
 * @attribution https://shopify.dev/docs/apps/build/authentication-authorization/id-tokens (inspiration; independently implemented)
 * @attribution https://github.com/Shopify/shopify-app-js (expiringOfflineAccessTokens future flag concept; independently implemented)
 */
export function defineSessionTokenAuth(options: SessionTokenAuthOptions = {}): StateRule {
  options = structuredClone(options);
  const identityKeyPattern = options.identityKeyPattern ?? defaultIdentityKeyPattern;

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "shopify-app/session-token-auth",
      revision: 2,
      title: "Session Token Auth",
      summary: "Flags cookie or Web Storage identity state in embedded Shopify app code.",
      guidance: {
        standard:
          "Embedded authentication must work without third-party cookies or local storage. Use App Bridge ID tokens (previously session tokens) and verify them on the backend.",
        checks: [
          "Requests to the app backend authenticate with a session token fetched through App Bridge, not a cookie or stored token.",
          "Cookie or Web Storage use is acceptable for non-identity UI state such as dismissed banners or draft form values.",
          "The flow keeps working in a browser that blocks third-party cookies (Chrome incognito is the review benchmark).",
          "Offline access tokens are read through the app library's session storage adapter on each use. A copy kept in an app-owned table, cache, or job payload goes stale once the `expiringOfflineAccessTokens` future flag is enabled, because token refresh happens inside the library's session storage path.",
        ],
        refs: [
          {
            type: "url",
            href: "https://shopify.dev/docs/apps/build/authentication-authorization/id-tokens",
          },
          {
            type: "url",
            href: "https://raw.githubusercontent.com/Shopify/shopify-app-js/main/packages/apps/shopify-app-react-router/src/server/future/flags.ts",
          },
        ],
      },
    },
    binding: {
      id: "shopify-app/session-token-auth",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx}", "**/locales/**/*.json"],
      exclude: ["**/*.d.ts"],
      options: {
        identityKeyPattern: options.identityKeyPattern
          ? { source: options.identityKeyPattern.source, flags: options.identityKeyPattern.flags }
          : null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [{ file: "src/view.tsx", source: "const cookies=document.cookie;" }],
        mustStaySilent: [{ file: "src/view.tsx", source: 'localStorage.getItem("draft");' }],
      },
      id: "shopify-app/session-token-auth",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        return {
          member_expression(node) {
            if (!cookieAccessPattern.test(node.text)) return;
            context.report({
              node,
              message: "document.cookie in embedded app code: confirm identity flows use App Bridge session tokens.",
            });
          },
          call_expression(node) {
            if (!webStorageCallPattern.test(node.text)) return;
            if (!matchesPattern(identityKeyPattern, node.text)) return;
            context.report({
              node,
              message:
                "Web Storage call touches identity-looking state: confirm auth uses App Bridge session tokens instead.",
            });
          },
        };
      },
    },
  });
}

export const sessionTokenAuth = defineSessionTokenAuth();
