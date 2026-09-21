import { isHttpsUrl, isRecord, readAppConfigurations } from "../config-support.js";
import type { ConformanceCheck } from "../finding.js";

const docs =
  "https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements#secure-data-with-valid-tlsssl-certificates";

/**
 * @attribution https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration (inspiration; independently implemented)
 */
export const appUrlSecurity: ConformanceCheck = {
  id: "app-url-security",
  description: "App and configured OAuth callback URLs must declare HTTPS transport without embedded credentials.",
  docs,
  async run(options) {
    const { configurations, findings } = await readAppConfigurations(options, "app-url-security", docs);
    for (const { path, config } of configurations) {
      const report = (field: string, message: string): void => {
        findings.push({
          check: "app-url-security",
          docs,
          path,
          severity: "error",
          message: `${path} ${field}: ${message}`,
        });
      };
      if (!isHttpsUrl(config.application_url))
        report(
          "application_url",
          "Set an absolute HTTPS URL without embedded credentials. Verify the served TLS certificate separately.",
        );
      if (config.auth !== undefined) {
        if (
          !isRecord(config.auth) ||
          !Array.isArray(config.auth.redirect_urls) ||
          config.auth.redirect_urls.length === 0
        ) {
          report("auth.redirect_urls", "Configure a nonempty array of HTTPS OAuth callback URLs.");
        } else {
          for (const [index, url] of config.auth.redirect_urls.entries()) {
            if (!isHttpsUrl(url))
              report(
                `auth.redirect_urls[${index}]`,
                "Use an absolute HTTPS callback URL without embedded credentials.",
              );
          }
        }
      }
      if (config.customer_authentication !== undefined) {
        if (!isRecord(config.customer_authentication)) {
          report("customer_authentication", "Use a TOML table for customer authentication settings.");
          continue;
        }
        for (const field of ["redirect_uris", "logout_urls", "javascript_origins"] as const) {
          const values = config.customer_authentication[field];
          if (values === undefined && field !== "redirect_uris") continue;
          if (!Array.isArray(values) || values.length === 0) {
            report(`customer_authentication.${field}`, "Configure a nonempty array of HTTPS URLs.");
            continue;
          }
          for (const [index, value] of values.entries()) {
            if (!isHttpsUrl(value))
              report(
                `customer_authentication.${field}[${index}]`,
                "Use an absolute HTTPS URL without embedded credentials.",
              );
            else if (field === "javascript_origins") {
              const url = new URL(value as string);
              if (url.pathname !== "/" || url.search !== "" || url.hash !== "")
                report(
                  `customer_authentication.${field}[${index}]`,
                  "Use an origin without a path, query, or fragment.",
                );
            }
          }
        }
      }
    }
    return findings;
  },
};
