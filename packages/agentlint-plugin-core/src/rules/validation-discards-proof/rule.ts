/**
 * Flags validate/check/ensure functions that establish a fact about a value and return nothing the type system can carry.
 *
 * @attribution "Parse, don't validate" by Alexis King (concept)
 */
import { type AgentlintNode, defineRule, type StateRule } from "@aurelienbbn/agentlint";
import {
  functionName,
  matches,
  namedChildren,
  nonTestExcludes,
  ownReturns,
  parameterPattern,
  parametersOf,
  serializePattern,
  sourceGlobs,
  unwrapExpression,
} from "../judgment-support-b.js";

const defaultNamePattern = /^(?:validate|check|verify|ensure|assert)[A-Z_]|^is[A-Z]\w*Valid$/;
const discardingReturnTypePattern = /^(?:void|boolean|Promise<\s*(?:void|boolean)\s*>)$/;
const booleanOperators = new Set(["===", "!==", "==", "!=", "<", ">", "<=", ">=", "&&", "||", "in", "instanceof"]);

export type ValidationDiscardsProofOptions = {
  /** Pattern matching the names of functions that act as validation gates. */
  readonly namePattern?: RegExp;
};

function isBooleanExpression(expression: AgentlintNode): boolean {
  const node = unwrapExpression(expression);
  if (node.type === "true" || node.type === "false") return true;
  if (node.type === "unary_expression") return node.childByFieldName("operator")?.text === "!";
  if (node.type === "binary_expression") return booleanOperators.has(node.childByFieldName("operator")?.text ?? "");
  if (node.type !== "ternary_expression") return false;
  const consequence = node.childByFieldName("consequence");
  const alternative = node.childByFieldName("alternative");
  return !!consequence && !!alternative && isBooleanExpression(consequence) && isBooleanExpression(alternative);
}

/** Expressions the function returns: the arrow expression body, or the operand of each own `return`. */
function returnedExpressions(fn: AgentlintNode): readonly (AgentlintNode | undefined)[] {
  const body = fn.childByFieldName("body");
  if (!body) return [];
  if (body.type !== "statement_block") return [body];
  return ownReturns(fn).map((statement) => namedChildren(statement)[0]);
}

function parameterNames(parameters: readonly AgentlintNode[]): ReadonlySet<string> {
  const names = new Set<string>();
  for (const parameter of parameters) {
    const pattern = parameterPattern(parameter);
    if (pattern?.type === "identifier") names.add(pattern.text);
    for (const bound of pattern?.descendantsOfType("shorthand_property_identifier_pattern") ?? [])
      names.add(bound.text);
  }
  return names;
}

export function defineValidationDiscardsProof(options: ValidationDiscardsProofOptions = {}): StateRule {
  options = structuredClone(options);
  const namePattern = options.namePattern ?? defaultNamePattern;

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "core/validation-discards-proof",
      revision: 1,
      title: "Validation Discards Proof",
      summary:
        "Flags validate/check/ensure functions that return void or boolean without a type predicate, so what they proved is lost to the type system.",
      guidance: {
        standard:
          "A check that returns nothing leaves the value typed exactly as before, so every later reader must trust that the check ran, or re-check, cast, or assert. A check that returns the refined value, or narrows through an assertion signature, makes the proof travel with the data and makes the unchecked path a compile error.",
        checks: [
          "Find what runs after each call of this function. FAIL when later code casts, uses `!`, re-checks the same condition, or carries a comment saying the value was validated; cite the line. The proof was needed and lost.",
          "PASS when the check is about the world, not the value (permission, quota, stock, uniqueness): no type can carry it past the next await.",
          "PASS when the function reports a list of user-facing issues rather than acting as a gate, or when no caller relies on the established fact.",
          "Fix direction: return the refined value (`parseX(input): X`), use an `asserts input is X` signature, or decode with a schema at the boundary; then delete the downstream casts and re-checks.",
        ],
        examples: [
          {
            label: "FAIL",
            code: 'function validateOrder(order: OrderInput): void {\n  if (order.lines.length === 0) throw new Error("Order has no lines");\n}\n\nvalidateOrder(input);\nconst first = input.lines[0]!;',
            description: "The caller needs the non-empty fact and restores it with `!`.",
          },
          {
            label: "PASS",
            code: 'function parseOrder(order: OrderInput): Order {\n  const [first, ...rest] = order.lines;\n  if (first === undefined) throw new Error("Order has no lines");\n  return { ...order, lines: [first, ...rest] };\n}',
            description: "The non-empty tuple type carries the proof to every reader.",
          },
        ],
        refs: [
          {
            type: "url",
            href: "https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/",
          },
          {
            type: "url",
            href: "https://fsharpforfunandprofit.com/posts/designing-with-types-single-case-dus/",
          },
          {
            type: "url",
            href: "https://fsharpforfunandprofit.com/posts/designing-with-types-making-illegal-states-unrepresentable/",
          },
        ],
      },
    },
    binding: {
      id: "core/validation-discards-proof",
      authority: "agent",
      include: [...sourceGlobs],
      exclude: [...nonTestExcludes],
      options: { namePattern: serializePattern(options.namePattern) },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            file: "src/module.ts",
            source:
              'function validateOrder(order: OrderInput): void { if (order.lines.length === 0) throw new Error("Order has no lines"); }',
          },
        ],
        mustStaySilent: [
          {
            file: "src/module.ts",
            source:
              'function assertOrder(order: OrderInput): asserts order is Order { if (order.lines.length === 0) throw new Error("Order has no lines"); }',
          },
        ],
      },
      id: "core/validation-discards-proof",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        function inspect(fn: AgentlintNode): void {
          const name = functionName(fn);
          if (name === undefined || !matches(namePattern, name)) return;

          const parameters = parametersOf(fn);
          const refinable = parameters.some((parameter) => {
            const type = namedChildren(parameter.childByFieldName("type"))[0];
            return type !== undefined && type.type !== "predefined_type";
          });
          if (!refinable) return;

          const returned = returnedExpressions(fn);
          const returnType = fn.childByFieldName("return_type");
          if (returnType) {
            if (returnType.type !== "type_annotation") return;
            const declared = namedChildren(returnType)[0]?.text.replaceAll(/\s+/g, "") ?? "";
            if (!discardingReturnTypePattern.test(declared)) return;
          } else if (!returned.every((value) => value === undefined || isBooleanExpression(value))) return;

          const names = parameterNames(parameters);
          const body = fn.childByFieldName("body");
          const throws = (body?.descendantsOfType("throw_statement").length ?? 0) > 0;
          const reads = returned.some(
            (value) =>
              value !== undefined &&
              [value, ...value.descendantsOfType("identifier")].some(
                (node) => node.type === "identifier" && names.has(node.text),
              ),
          );
          if (!throws && !reads) return;

          context.report({
            node: fn.childByFieldName("name") ?? fn,
            message: `\`${name}\` checks its argument and returns nothing the type system can carry; return the refined value, or declare an \`asserts\`/\`is\` signature so callers stop re-checking.`,
            evidence: { function: name },
          });
        }

        return {
          function_declaration: inspect,
          arrow_function: inspect,
          function_expression: inspect,
          method_definition: inspect,
        };
      },
    },
  });
}

export const validationDiscardsProof = defineValidationDiscardsProof();
