import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-app/no-router-redirect-in-embedded-route";

it("reports the router redirect in a module that authenticates admin requests", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `import { redirect } from "react-router";
import { authenticate } from "../shopify.server";
export const loader = async ({ request }) => {
  await authenticate.admin(request);
  throw redirect("/app/settings");
};
`,
    ),
  ).resolves.toBeUndefined();
});

it("reports an aliased Remix redirect", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `import { redirect as go } from "@remix-run/node";
export const loader = async ({ request }) => {
  await shopify.authenticate.admin(request);
  return go("/app");
};
`,
    ),
  ).resolves.toBeUndefined();
});

it("reports absolute and shopify:// destinations even without authenticate.admin", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { redirect } from "react-router";\nexport const loader = () => redirect(`https://admin.shopify.com/store/${shop}/charges`);\n',
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      'import { redirect } from "react-router";\nexport const loader = () => redirect("shopify://admin/products");\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts the embedded helper, public routes, other modules and shadowed names", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { authenticate } from "../shopify.server";
export const loader = async ({ request }) => {
  const { redirect } = await authenticate.admin(request);
  return redirect("https://example.com/billing", { target: "_top" });
};
`,
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { redirect } from "react-router";\nexport const loader = () => redirect("/auth/login");\n',
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { redirect } from "./navigation.js";
import { redirect as routerRedirect } from "react-router";
export const loader = async ({ request }) => {
  await authenticate.admin(request);
  void routerRedirect;
  return redirect("/app");
};
export const action = async ({ request }) => {
  const { redirect } = await authenticate.admin(request);
  return redirect("/app");
};
`,
    ),
  ).resolves.toBeUndefined();
});
