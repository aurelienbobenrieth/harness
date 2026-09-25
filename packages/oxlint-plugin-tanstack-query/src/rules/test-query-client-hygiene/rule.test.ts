import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "tanstack-query/test-query-client-hygiene";
const imports = 'import { QueryClient } from "@tanstack/react-query";\n';
const filename = "todos.test.ts";
const noRetry = "{ defaultOptions: { queries: { retry: false } } }";

it("reports a module-scope client shared by every test", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}const queryClient = new QueryClient(${noRetry});
it("renders", () => render(queryClient));\n`,
      { filename },
    ),
  ).resolves.toBeUndefined();
});

it("reports a client created directly in a describe callback", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}describe.each(cases)("todos", () => {
  const queryClient = new QueryClient(${noRetry});
  it("renders", () => render(queryClient));
});\n`,
      { filename },
    ),
  ).resolves.toBeUndefined();
});

it("reports a per-test client that keeps default retries", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}function createWrapper() {
  return new QueryClient();
}
it("renders", () => render(createWrapper()));\n`,
      { filename },
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      `import { QueryClient as Client } from "@tanstack/react-query";
beforeEach(() => {
  client = new Client({ defaultOptions: { queries: { gcTime: Infinity } } });
});\n`,
      { filename },
    ),
  ).resolves.toBeUndefined();
});

it("accepts a fresh retry-free client per test", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}const createClient = () => new QueryClient(${noRetry});
describe("todos", () => {
  let queryClient: QueryClient;
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 }, mutations: { retry: false } } });
  });
  it("renders", () => render(queryClient, createClient()));
});\n`,
      { filename },
    ),
  ).resolves.toBeUndefined();
});

it("accepts a shared client that is cleared between tests", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}const queryClient = new QueryClient(${noRetry});
afterEach(() => {
  queryClient.clear();
});\n`,
      { filename },
    ),
  ).resolves.toBeUndefined();
});

it("does not judge retries when the options are not a literal", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}it("renders", () => {
  render(new QueryClient(testClientConfig), new QueryClient({ ...testClientConfig }));
});\n`,
      { filename },
    ),
  ).resolves.toBeUndefined();
});

it("ignores application files and foreign QueryClient classes", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, `${imports}export const queryClient = new QueryClient();\n`, {
      filename: "query-client.ts",
    }),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { QueryClient } from "./sql-client";\nconst client = new QueryClient();\nconsole.log(client);\n',
      { filename },
    ),
  ).resolves.toBeUndefined();
});

it("honours a configured test file pattern", async () => {
  await expect(
    assertRuleReports(ruleName, `${imports}export const queryClient = new QueryClient();\n`, {
      filename: "test-utils.ts",
      ruleOptions: { testFilePattern: "test-utils\\.ts$" },
    }),
  ).resolves.toBeUndefined();
});
