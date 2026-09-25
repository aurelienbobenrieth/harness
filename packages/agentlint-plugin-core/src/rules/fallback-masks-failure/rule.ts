/**
 * Flags empty-literal fallbacks (`?? ""`, `|| []`, `?? 0`, `catch { return []; }`) that let execution continue
 * with made-up data where absence or failure should have surfaced.
 *
 * Type-provably useless fallbacks belong to `typescript/no-unnecessary-condition`; this rule reviews the
 * residue, where the value is legitimately nullable and the default is a judgment call.
 *
 * @attribution "Parse, don't validate" by Alexis King (concept: absence is rejected once, at the boundary)
 */
import { type AgentlintNode, defineRule, type StateRule } from "@aurelienbbn/agentlint";
import { discardsCaughtError, enclosingScope, isFunctionNode, nodeKey } from "../ast.js";

const defaultSensitiveNames = [
  "id",
  "ids",
  "key",
  "token",
  "secret",
  "price",
  "amount",
  "total",
  "subtotal",
  "cost",
  "fee",
  "tax",
  "balance",
  "quantity",
  "qty",
  "count",
  "currency",
  "url",
  "uri",
  "email",
  "sku",
];
const defaultMinFallbacksPerScope = 2;

const placeholderStringPattern = /^(?:unknown|n\/a)$/i;
const wrapperNodeTypes = new Set([
  "parenthesized_expression",
  "non_null_expression",
  "await_expression",
  "as_expression",
  "satisfies_expression",
]);
const displayContextTypes = new Set(["jsx_expression", "jsx_attribute"]);

const fallbackMessage =
  "Empty-literal fallback lets execution continue without the real value; reject absence at the boundary, or show that the default is the documented domain value.";
const catchMessage =
  "Error handler returns an empty literal, so callers cannot tell failure from an empty result; propagate the failure or return a typed error.";

export type FallbackMasksFailureOptions = {
  /**
   * Lower-case name segments that mark a value as required data (identifiers, money, addresses). One fallback
   * on such a value is reported on its own. Providing this REPLACES the built-in list.
   */
  readonly sensitiveNames?: readonly string[];
  /** Fallbacks on other values are reported once per function when at least this many occur. Default: 2 */
  readonly minFallbacksPerScope?: number;
};

type Candidate = {
  readonly node: AgentlintNode;
  readonly sensitive: boolean;
  readonly message: string;
};

function unwrap(node: AgentlintNode): AgentlintNode {
  let current = node;
  while (wrapperNodeTypes.has(current.type)) {
    const inner = current.children.find((child) => child.isNamed && child.type !== "comment");
    if (!inner) break;
    current = inner;
  }
  return current;
}

function stringContent(node: AgentlintNode): string | undefined {
  if (node.type !== "string" && node.type !== "template_string") return undefined;
  if (node.type === "template_string" && node.descendantsOfType("template_substitution").length > 0) return undefined;
  return node.text.slice(1, -1);
}

function isEmptyLiteral(candidate: AgentlintNode, allowNullish: boolean): boolean {
  const node = unwrap(candidate);
  const content = stringContent(node);
  if (content !== undefined) return content === "" || placeholderStringPattern.test(content.trim());
  if (node.type === "number") return Number(node.text.replaceAll("_", "")) === 0;
  if (node.type === "array" || node.type === "object") return node.children.every((child) => !child.isNamed);
  if (!allowNullish) return false;
  return node.type === "null" || node.type === "undefined" || (node.type === "identifier" && node.text === "undefined");
}

/** Name that best identifies the defaulted value: trailing property, string key, or callee. */
function valueName(candidate: AgentlintNode): string | undefined {
  const node = unwrap(candidate);
  if (node.type === "member_expression") return node.childByFieldName("property")?.text;
  if (node.type === "subscript_expression") {
    const index = node.childByFieldName("index");
    const key = index ? stringContent(index) : undefined;
    const object = node.childByFieldName("object");
    return key ?? (object ? valueName(object) : undefined);
  }
  if (node.type === "call_expression") {
    const named = (node.childByFieldName("arguments")?.children ?? []).filter((child) => child.isNamed);
    const key = named.length === 1 && named[0] ? stringContent(named[0]) : undefined;
    const callee = node.childByFieldName("function");
    return key ?? (callee ? valueName(callee) : undefined);
  }
  return node.type === "identifier" || node.type === "shorthand_property_identifier_pattern" ? node.text : undefined;
}

function nameSegments(name: string): readonly string[] {
  return name
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function isDisplayContext(node: AgentlintNode, scope: AgentlintNode): boolean {
  const scopeKey = nodeKey(scope);
  let current = node.parent;
  while (current !== null && nodeKey(current) !== scopeKey) {
    if (displayContextTypes.has(current.type)) return true;
    current = current.parent;
  }
  return false;
}

function returnedLiterals(body: AgentlintNode): readonly AgentlintNode[] {
  if (body.type !== "statement_block") return [body];
  const bodyKey = nodeKey(body);
  return body
    .descendantsOfType("return_statement")
    .filter((statement) => {
      let current = statement.parent;
      while (current !== null && nodeKey(current) !== bodyKey) {
        if (isFunctionNode(current)) return false;
        current = current.parent;
      }
      return true;
    })
    .flatMap((statement) => statement.children.filter((child) => child.isNamed && child.type !== "comment"));
}

function handlerMasksFailure(body: AgentlintNode, bindingName: string | undefined): boolean {
  const returned = returnedLiterals(body);
  if (returned.length === 0 || !returned.every((value) => isEmptyLiteral(value, true))) return false;
  return discardsCaughtError(body, bindingName);
}

export function defineFallbackMasksFailure(options: FallbackMasksFailureOptions = {}): StateRule {
  options = structuredClone(options);
  const sensitiveNames = new Set((options.sensitiveNames ?? defaultSensitiveNames).map((name) => name.toLowerCase()));
  const minFallbacksPerScope = options.minFallbacksPerScope ?? defaultMinFallbacksPerScope;
  if (!Number.isSafeInteger(minFallbacksPerScope) || minFallbacksPerScope < 1)
    throw new Error("fallback-masks-failure: minFallbacksPerScope must be a positive integer.");
  const isSensitive = (name: string | undefined): boolean =>
    name !== undefined && nameSegments(name).some((segment) => sensitiveNames.has(segment));

  function collect(root: AgentlintNode): readonly Candidate[] {
    const candidates: Candidate[] = [];
    for (const node of root.descendantsOfType("binary_expression")) {
      const operator = node.childByFieldName("operator")?.text;
      const left = node.childByFieldName("left");
      const right = node.childByFieldName("right");
      if ((operator !== "??" && operator !== "||") || !left || !right) continue;
      if (!isEmptyLiteral(right, false) || isEmptyLiteral(left, true)) continue;
      if (isDisplayContext(node, enclosingScope(node))) continue;
      candidates.push({ node, sensitive: isSensitive(valueName(left)), message: fallbackMessage });
    }
    for (const type of ["required_parameter", "optional_parameter"]) {
      for (const node of root.descendantsOfType(type)) {
        const pattern = node.childByFieldName("pattern");
        const value = node.childByFieldName("value");
        if (!pattern || !value || !isEmptyLiteral(value, false) || !isSensitive(valueName(pattern))) continue;
        candidates.push({ node, sensitive: true, message: fallbackMessage });
      }
    }
    for (const type of ["object_assignment_pattern", "assignment_pattern"]) {
      for (const node of root.descendantsOfType(type)) {
        const left = node.childByFieldName("left");
        const right = node.childByFieldName("right");
        if (!left || !right || !isEmptyLiteral(right, false) || !isSensitive(valueName(left))) continue;
        candidates.push({ node, sensitive: true, message: fallbackMessage });
      }
    }
    for (const node of root.descendantsOfType("catch_clause")) {
      const parameter = node.childByFieldName("parameter");
      const body = node.childByFieldName("body");
      if (!body || (parameter !== null && parameter.type !== "identifier")) continue;
      if (handlerMasksFailure(body, parameter?.text)) candidates.push({ node, sensitive: true, message: catchMessage });
    }
    for (const node of root.descendantsOfType("call_expression")) {
      if (node.childByFieldName("function")?.childByFieldName("property")?.text !== "catch") continue;
      const handler = node.childByFieldName("arguments")?.children.find(isFunctionNode);
      const body = handler?.childByFieldName("body");
      if (!handler || !body) continue;
      const parameters = handler.childByFieldName("parameters") ?? handler.childByFieldName("parameter");
      const binding = parameters?.type === "identifier" ? parameters : parameters?.descendantsOfType("identifier")[0];
      if (handlerMasksFailure(body, binding?.text)) candidates.push({ node, sensitive: true, message: catchMessage });
    }
    return candidates;
  }

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "core/fallback-masks-failure",
      revision: 1,
      title: "Fallback Masks Failure",
      summary:
        "Flags empty-literal fallbacks on required-looking values, fallback-dense functions, and error handlers that return an empty literal.",
      guidance: {
        standard:
          'A default is a domain decision, not a way to keep going. Absent required data and failed boundary calls surface as errors where they happen; `?? ""`, `|| []`, `?? 0` and `catch { return []; }` are legitimate only when the empty value is what the domain means by absence.',
        checks: [
          "Passes when the input is documented as optional and the literal is its documented default, or the value is a display label rendered as an empty state.",
          "Passes when absence is handled downstream before the value reaches a lookup, arithmetic, persistence, or an outbound call.",
          "Fails when the defaulted value is an identifier, key, token, URL, money amount, or quantity that later code treats as real.",
          "Fails when a boundary result (parse, fetch, query, decode) is replaced by an empty value so the caller cannot tell failure from an empty result.",
          "Fails when the fallback only exists to satisfy the type checker; reject the absence at the boundary and narrow the type instead.",
        ],
      },
    },
    binding: {
      id: "core/fallback-masks-failure",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"],
      exclude: ["**/*.d.ts", "**/*.{test,spec}.*", "**/__tests__/**"],
      options: {
        sensitiveNames: options.sensitiveNames ? [...options.sensitiveNames] : null,
        minFallbacksPerScope: options.minFallbacksPerScope ?? null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          { file: "src/module.ts", source: 'const id = params.id ?? "";' },
          {
            file: "src/module.ts",
            source: "function load() { try { return read(); } catch { return []; } }",
          },
          {
            file: "src/module.ts",
            source: 'const a = input.label ?? ""; const b = input.tags || [];',
          },
        ],
        mustStaySilent: [
          { file: "src/module.ts", source: 'const label = input.label ?? "";' },
          { file: "src/module.ts", source: "const id = params.id ?? fail();" },
        ],
      },
      id: "core/fallback-masks-failure",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        return {
          program(root) {
            const scopes = new Map<string, Candidate[]>();
            for (const candidate of collect(root)) {
              const key = nodeKey(enclosingScope(candidate.node));
              scopes.set(key, [...(scopes.get(key) ?? []), candidate]);
            }
            for (const candidates of scopes.values()) {
              const anchor = candidates.find((candidate) => candidate.sensitive);
              if (!anchor && candidates.length < minFallbacksPerScope) continue;
              const reported = anchor ?? candidates[0];
              if (!reported) continue;
              context.report({
                node: reported.node,
                message: reported.message,
                evidence: {
                  fallbacks: candidates.map((candidate) => candidate.node.text.slice(0, 160)),
                },
              });
            }
          },
        };
      },
    },
  });
}

export const fallbackMasksFailure = defineFallbackMasksFailure();
