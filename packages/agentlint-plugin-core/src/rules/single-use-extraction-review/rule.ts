/**
 * Schedules review for substantial file-local helpers that have one caller and receive several caller values.
 *
 * @attribution https://alexn.org/blog/2026/09/22/ai-has-no-wisdom-and-neither-will-you/ (inspiration; independently implemented)
 */
import { type AgentlintNode, defineRule, type StateRule } from "@aurelienbbn/agentlint";
import { functionName, namedChildren, nonTestExcludes, parametersOf, sourceGlobs } from "../judgment-support-b.js";

const defaultMinParameters = 2;
const defaultMinStatements = 3;

export type SingleUseExtractionReviewOptions = {
  /** Smallest parameter count considered evidence that the caller is forwarding its local context. Default: 2. */
  readonly minParameters?: number;
  /** Smallest statement count considered a substantial hidden step. Default: 3. */
  readonly minStatements?: number;
};

function positiveInteger(value: number, option: string): void {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error(`single-use-extraction-review: ${option} must be a positive integer.`);
}

function isExported(node: AgentlintNode): boolean {
  let current: AgentlintNode | null = node.parent;
  while (current !== null && current.type !== "program") {
    if (current.type === "export_statement") return true;
    current = current.parent;
  }
  return false;
}

function declaredFunctions(root: AgentlintNode): readonly AgentlintNode[] {
  const declarations = [...root.descendantsOfType("function_declaration")];
  for (const declarator of root.descendantsOfType("variable_declarator")) {
    const value = declarator.childByFieldName("value");
    if (value?.type === "arrow_function" || value?.type === "function_expression") declarations.push(value);
  }
  return declarations;
}

function directCalls(root: AgentlintNode, name: string): readonly AgentlintNode[] {
  return root
    .descendantsOfType("call_expression")
    .filter((call) => call.childByFieldName("function")?.type === "identifier")
    .filter((call) => call.childByFieldName("function")?.text === name);
}

export function defineSingleUseExtractionReview(options: SingleUseExtractionReviewOptions = {}): StateRule {
  options = structuredClone(options);
  const minParameters = options.minParameters ?? defaultMinParameters;
  const minStatements = options.minStatements ?? defaultMinStatements;
  positiveInteger(minParameters, "minParameters");
  positiveInteger(minStatements, "minStatements");

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "core/single-use-extraction-review",
      revision: 1,
      title: "Single-use extraction preserves the reading flow",
      summary:
        "Flags substantial file-local helpers with one caller and several forwarded values so a reader decides whether the extraction names a real concept or fragments one operation.",
      guidance: {
        standard:
          "A single-use helper earns the extra navigation by naming a domain concept, isolating a policy or boundary, or making its contract independently testable. A helper that merely relocates steps and receives the caller's local state stays inline.",
        checks: [
          "Read the caller and helper together. State the concept or contract the helper owns.",
          "PASS when the helper isolates a domain operation, policy, boundary, or independently useful proof seam.",
          "FAIL when understanding the caller requires opening the helper and the helper only continues the caller's procedure.",
          "Do not use call count alone as a reason to inline; one well-named decomposition step can be valuable.",
        ],
        examples: [
          {
            label: "REVIEW",
            code: "function continueProcessing(order, customer) {\n  validate(order);\n  reserve(order);\n  notify(customer);\n}\n\ncontinueProcessing(order, customer);",
            description: "One caller forwards its local context into a multi-step helper.",
          },
          {
            label: "PASS",
            code: "function authorizePayment(command) {\n  // Owns the payment authorization boundary.\n  return gateway.authorize(command);\n}",
            description: "The extraction names and owns a boundary even if it currently has one caller.",
          },
        ],
        refs: [{ type: "url", href: "https://alexn.org/blog/2026/09/22/ai-has-no-wisdom-and-neither-will-you/" }],
      },
    },
    binding: {
      id: "core/single-use-extraction-review",
      authority: "human",
      include: sourceGlobs,
      exclude: nonTestExcludes,
      options: {
        minParameters: options.minParameters ?? null,
        minStatements: options.minStatements ?? null,
      },
    },
    detector: {
      id: "core/single-use-extraction-review",
      version: 1,
      scan: "file",
      fixtures: {
        mustReport: [
          "function continueProcessing(order, customer) { validate(order); reserve(order); notify(customer); }\nexport function run(order, customer) { continueProcessing(order, customer); }",
        ],
        mustStaySilent: [
          "function normalize(value) { return value.trim(); }\nexport const run = (value) => normalize(value);",
          "function renderOrder(order, customer) { validate(order); reserve(order); notify(customer); }\nexport function first(order, customer) { renderOrder(order, customer); }\nexport function second(order, customer) { renderOrder(order, customer); }",
        ],
      },
      createOnce({ context }) {
        return {
          program(root) {
            for (const fn of declaredFunctions(root)) {
              if (isExported(fn)) continue;
              const name = functionName(fn);
              const body = fn.childByFieldName("body");
              if (!name || !body || parametersOf(fn).length < minParameters) continue;
              const statements = body.type === "statement_block" ? namedChildren(body).length : 1;
              if (statements < minStatements) continue;
              const calls = directCalls(root, name).filter(
                (call) => !fn.descendantsOfType("call_expression").includes(call),
              );
              if (calls.length !== 1) continue;
              context.report({
                node: fn.childByFieldName("name") ?? fn,
                message: `File-local helper \`${name}\` has one caller, ${parametersOf(fn).length} parameters and ${statements} statements; keep it only when it names a concept or owns a contract that repays the extra navigation.`,
                evidence: { name, parameters: parametersOf(fn).length, statements },
                key: name,
              });
            }
          },
        };
      },
    },
  });
}

export const singleUseExtractionReview = defineSingleUseExtractionReview();
