/**
 * Flags test files that call themselves integration tests and also construct test doubles.
 *
 * @attribution "IntegrationTest" by Martin Fowler (concept: narrow integration tests double the remote, not the adapter)
 */
import { type AgentlintNode, defineRule, type StateRule } from "@aurelienbbn/agentlint";
import { codeText } from "../ast.js";
import {
  callArguments,
  matches,
  serializePattern,
  sourceFileGlobs,
  stringValue,
  testFilePattern,
} from "../judgment-support.js";

const defaultIntegrationPattern = /(?:^|[./_-])(?:integration|e2e)(?:[./_-]|$)/i;
const defaultDoublePattern = /\b(?:vi\.fn|createMock|mock[A-Z]\w*|fake[A-Z]\w*)\s*\(|\b(?:InMemory|Fake|Stub)[A-Z]\w*/;
const describeCalleePattern = /^describe(?:\.\w+)*$/;
const integrationTitlePattern = /integration/i;

const message =
  "File claims to be an integration test but constructs test doubles; show that the claimed boundary runs for real, or rename and move it as a unit test.";

export type IntegrationTestOwnsItsBoundaryOptions = {
  /** Pattern tested against every path segment, basename included, to recognise an integration test. */
  readonly integrationPattern?: RegExp;
  /** Pattern matching test-double construction sites and names. */
  readonly doublePattern?: RegExp;
};

function firstDescribeTitle(root: AgentlintNode): string | undefined {
  const describe = root
    .descendantsOfType("call_expression")
    .find((call) => describeCalleePattern.test(call.childByFieldName("function")?.text ?? ""));
  return describe ? stringValue(callArguments(describe)[0]) : undefined;
}

export function defineIntegrationTestOwnsItsBoundary(options: IntegrationTestOwnsItsBoundaryOptions = {}): StateRule {
  options = structuredClone(options);
  const integrationPattern = options.integrationPattern ?? defaultIntegrationPattern;
  const doublePattern = options.doublePattern ?? defaultDoublePattern;
  const globalDoublePattern = new RegExp(
    doublePattern.source,
    doublePattern.flags.includes("g") ? doublePattern.flags : `${doublePattern.flags}g`,
  );

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "core/integration-test-owns-its-boundary",
      revision: 1,
      title: "Integration Test Owns Its Boundary",
      summary:
        "Flags test files named or titled as integration tests that also construct test doubles, so the claimed boundary is checked to be real.",
      guidance: {
        standard:
          "An integration test earns its name by running the project's own code against the boundary it names. Doubles are welcome for everything else, and for the remote end at the wire; a double in place of the adapter or the managed resource leaves the claimed integration untested.",
        checks: [
          "Name the boundary the file claims to integrate (database, provider HTTP API, queue, filesystem, the app's own HTTP layer) from its path, title and imports.",
          "For each double in the evidence, state what it replaces.",
          "Fails when a double replaces the module of our code that talks to the claimed boundary (repository, gateway, client, route handler), or stands in for the claimed managed resource itself, such as an in-memory store in a database integration test.",
          "Passes when doubles replace only other, unmanaged dependencies, or replace the remote at the wire (stub server, request interception, recorded authoritative fixture) while our adapter code runs for real.",
          "A unit test living under an integration name is still a finding: rename or move it.",
        ],
        examples: [
          {
            label: "FAIL",
            description: "orders.integration.test.ts: the repository that owns the database boundary is a stub.",
            code: "const repository = { save: vi.fn() };\nawait placeOrder(repository, cart);\nexpect(repository.save).toHaveBeenCalled();",
          },
          {
            label: "PASS",
            description: "The real repository runs against a real database; only the unrelated mailer is doubled.",
            code: 'const repository = new SqlOrderRepository(await startDatabase());\nawait placeOrder(repository, cart, { mailer: new FakeMailer() });\nexpect(await repository.byId("o1")).toEqual(expectedOrder);',
          },
        ],
        refs: [
          { type: "skill", id: "testing" },
          { type: "url", href: "https://martinfowler.com/bliki/IntegrationTest.html" },
          { type: "url", href: "https://enterprisecraftsmanship.com/posts/when-to-mock/" },
          { type: "url", href: "https://kentcdodds.com/blog/write-tests" },
          { type: "url", href: "https://martinfowler.com/bliki/ContractTest.html" },
        ],
      },
    },
    binding: {
      id: "core/integration-test-owns-its-boundary",
      authority: "agent",
      include: [...sourceFileGlobs],
      exclude: ["**/*.d.ts"],
      options: {
        integrationPattern: serializePattern(options.integrationPattern),
        doublePattern: serializePattern(options.doublePattern),
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            file: "src/orders.integration.test.ts",
            source: 'it("saves", async () => { const repository = { save: vi.fn() }; await place(repository); });',
          },
        ],
        mustStaySilent: [
          { file: "src/orders.test.ts", source: 'it("saves", () => { const save = vi.fn(); place({ save }); });' },
          {
            file: "src/interaction.test.ts",
            source: 'it("clicks", () => { const onClick = vi.fn(); click(onClick); });',
          },
        ],
      },
      id: "core/integration-test-owns-its-boundary",
      version: 1,
      scan: "file",
      createOnce(context) {
        return {
          program(root) {
            if (!testFilePattern.test(context.path)) return;
            const namedIntegration = context.path.split("/").some((segment) => matches(integrationPattern, segment));
            if (!namedIntegration && !integrationTitlePattern.test(firstDescribeTitle(root) ?? "")) return;

            const doubles = [
              ...new Set(
                [...codeText(root).matchAll(globalDoublePattern)].map((match) => match[0].replace(/\s*\($/, "")),
              ),
            ].toSorted();
            const anchor = root.descendantsOfType("call_expression")[0];
            if (doubles.length === 0 || !anchor) return;
            context.report({ node: anchor, message, evidence: { doubles } });
          },
        };
      },
    },
  });
}

export const integrationTestOwnsItsBoundary = defineIntegrationTestOwnsItsBoundary();
