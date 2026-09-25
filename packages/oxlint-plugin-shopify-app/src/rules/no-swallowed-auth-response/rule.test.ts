import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-app/no-swallowed-auth-response";

it("reports authenticate.admin inside a try whose catch returns an error result", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    return admin;
  } catch (error) {
    return data({ error: "Something went wrong" }, { status: 500 });
  }
};
`,
    ),
  ).resolves.toBeUndefined();
});

it.each([
  "await billing.request({ plan: PRO })",
  "await scopes.request(['read_orders'])",
  "await shopify.authenticate.public.appProxy(request)",
])("reports %s inside a swallowing try", async (call) => {
  await expect(
    assertRuleReports(
      ruleName,
      `async function run() { try { ${call}; } catch (error) { console.error(error); } }
`,
    ),
  ).resolves.toBeUndefined();
});

it("reports the embedded redirect helper inside a swallowing try", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `export async function loader({ request }) {
  const { redirect } = await authenticate.admin(request);
  try {
    return redirect("/app/plans");
  } catch {
    return null;
  }
}
`,
    ),
  ).resolves.toBeUndefined();
});

it("does not count a throw inside a nested callback of the catch block", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `async function run(request) {
  try {
    await authenticate.admin(request);
  } catch (error) {
    queue(() => { throw error; });
    return null;
  }
}
`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts rethrowing catches, Response checks, try/finally and calls outside the try", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `export async function a(request) {
  try {
    await authenticate.admin(request);
  } catch (error) {
    if (error instanceof Response) throw error;
    return null;
  }
}
export async function b(request) {
  try {
    await authenticate.admin(request);
  } catch (error) {
    return error instanceof Response ? error : null;
  }
}
export async function c(request) {
  try {
    await authenticate.webhook(request);
  } finally {
    done();
  }
}
export async function d(request) {
  const { admin } = await authenticate.admin(request);
  try {
    await admin.graphql("query { shop { name } }");
  } catch (error) {
    return null;
  }
}
`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores calls in a nested function, the router redirect and unrelated owners", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { redirect } from "react-router";
export async function run(request) {
  try {
    const later = async () => authenticate.admin(request);
    plans.request({ plan: PRO });
    return redirect("/app");
  } catch (error) {
    return null;
  }
}
`,
    ),
  ).resolves.toBeUndefined();
});
