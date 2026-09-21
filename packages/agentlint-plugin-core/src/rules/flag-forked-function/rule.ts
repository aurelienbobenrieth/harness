/**
 * Flags functions whose boolean or literal-union parameters only select a code path.
 *
 * @attribution "The Wrong Abstraction" by Sandi Metz (concept)
 * @attribution "FlagArgument" by Martin Fowler (concept)
 */
import { type AgentlintNode, defineRule, type StateRule } from "@aurelienbbn/agentlint";
import {
  functionName,
  isSameNode,
  namedChildren,
  nonTestExcludes,
  parameterPattern,
  parametersOf,
  sourceGlobs,
  unwrapExpression,
} from "../judgment-support-b.js";

const defaultMinFlags = 2;
const defaultMinSitesForSingleFlag = 3;
const jsxFilePattern = /\.[cm]?[jt]sx$/;
const jsxGlob = "**/*.{tsx,jsx}";

const literalTypes = new Set(["true", "false", "string", "number", "null", "undefined"]);
const callerLiteralTypes = new Set(["true", "false", "string"]);
const equalityOperators = new Set(["===", "!==", "==", "!="]);
const logicalOperators = new Set(["&&", "||"]);

export type FlagForkedFunctionOptions = {
  /** Number of path-selecting parameters that triggers a finding on its own. Default: 2 */
  readonly minFlags?: number;
  /** Number of separate conditionals one lone flag must drive to trigger a finding. Default: 3 */
  readonly minSitesForSingleFlag?: number;
  /** Inspect `.tsx`/`.jsx` files too, where boolean props are usually presentational data. Default: false */
  readonly includeJsx?: boolean;
};

type Flag = {
  readonly name: string;
  /** Position of the owning parameter in the signature. */
  readonly index: number;
  /** True when the flag is a property of a destructured options parameter. */
  readonly destructured: boolean;
};

function isFlagType(type: AgentlintNode | undefined): boolean {
  if (!type) return false;
  if (type.type === "predefined_type") return type.text === "boolean";
  if (type.type !== "union_type") return false;
  const members = type.text.split("|").filter((member) => member.trim() !== "");
  return members.length >= 2 && type.descendantsOfType("literal_type").length === members.length;
}

function annotatedType(node: AgentlintNode): AgentlintNode | undefined {
  return namedChildren(node.childByFieldName("type") ?? node.childrenByType("type_annotation")[0])[0];
}

function isBooleanLiteral(node: AgentlintNode | null | undefined): boolean {
  return node?.type === "true" || node?.type === "false";
}

function flagCandidates(fn: AgentlintNode): readonly Flag[] {
  const flags: Flag[] = [];
  parametersOf(fn).forEach((parameter, index) => {
    const pattern = parameterPattern(parameter);
    if (!pattern) return;
    const type = parameter.type === "identifier" ? undefined : annotatedType(parameter);
    if (pattern.type === "identifier") {
      if (isFlagType(type) || isBooleanLiteral(parameter.childByFieldName("value")))
        flags.push({ name: pattern.text, index, destructured: false });
      return;
    }
    const declared = new Map<string, AgentlintNode | undefined>();
    if (type?.type === "object_type")
      for (const signature of type.childrenByType("property_signature")) {
        const name = signature.childByFieldName("name")?.text;
        if (name) declared.set(name, annotatedType(signature));
      }
    for (const property of namedChildren(pattern)) {
      if (property.type === "shorthand_property_identifier_pattern") {
        if (isFlagType(declared.get(property.text))) flags.push({ name: property.text, index, destructured: true });
        continue;
      }
      if (property.type !== "object_assignment_pattern") continue;
      const left = property.childByFieldName("left");
      if (left?.type !== "shorthand_property_identifier_pattern") continue;
      if (isBooleanLiteral(property.childByFieldName("right")) || isFlagType(declared.get(left.text)))
        flags.push({ name: left.text, index, destructured: true });
    }
  });
  return flags;
}

/** The `if`/ternary/`switch` whose test this reference helps decide, or undefined when the value is used as data. */
function decidedConditional(reference: AgentlintNode): AgentlintNode | undefined {
  let current = reference;
  for (let parent = current.parent; parent !== null; parent = current.parent) {
    if (parent.type === "parenthesized_expression") {
      const owner = parent.parent;
      if (owner?.type === "if_statement" || owner?.type === "switch_statement") {
        const field = owner.type === "if_statement" ? "condition" : "value";
        const test = owner.childByFieldName(field);
        return test && isSameNode(test, parent) ? owner : undefined;
      }
    } else if (parent.type === "ternary_expression") {
      const test = parent.childByFieldName("condition");
      return test && isSameNode(test, current) ? parent : undefined;
    } else if (parent.type === "unary_expression") {
      if (parent.childByFieldName("operator")?.text !== "!") return undefined;
    } else if (parent.type === "binary_expression") {
      const operator = parent.childByFieldName("operator")?.text ?? "";
      if (equalityOperators.has(operator)) {
        const left = parent.childByFieldName("left");
        const other = left && isSameNode(left, current) ? parent.childByFieldName("right") : left;
        if (!other || !literalTypes.has(unwrapExpression(other).type)) return undefined;
      } else if (!logicalOperators.has(operator)) return undefined;
    } else return undefined;
    current = parent;
  }
  return undefined;
}

/** Number of conditionals a flag drives, or 0 when any reference uses it as data. */
function conditionalSites(body: AgentlintNode, name: string): number {
  if (body.descendantsOfType("shorthand_property_identifier").some((node) => node.text === name)) return 0;
  const references = body.descendantsOfType("identifier").filter((node) => node.text === name);
  const sites: AgentlintNode[] = [];
  for (const reference of references) {
    const conditional = decidedConditional(reference);
    if (!conditional) return 0;
    if (!sites.some((site) => isSameNode(site, conditional))) sites.push(conditional);
  }
  return sites.length;
}

function passesLiteral(call: AgentlintNode, flag: Flag): boolean {
  const argument = namedChildren(call.childByFieldName("arguments"))[flag.index];
  if (!argument) return false;
  if (!flag.destructured) return callerLiteralTypes.has(argument.type);
  if (argument.type !== "object") return false;
  return argument.childrenByType("pair").some((pair) => {
    const value = pair.childByFieldName("value");
    return pair.childByFieldName("key")?.text === flag.name && !!value && callerLiteralTypes.has(value.type);
  });
}

function rootOf(node: AgentlintNode): AgentlintNode {
  let current = node;
  while (current.parent !== null) current = current.parent;
  return current;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error(`flag-forked-function: ${label} must be a positive integer.`);
  return value;
}

export function defineFlagForkedFunction(options: FlagForkedFunctionOptions = {}): StateRule {
  options = structuredClone(options);
  const minFlags = positiveInteger(options.minFlags ?? defaultMinFlags, "minFlags");
  const minSites = positiveInteger(
    options.minSitesForSingleFlag ?? defaultMinSitesForSingleFlag,
    "minSitesForSingleFlag",
  );
  const includeJsx = options.includeJsx ?? false;

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "core/flag-forked-function",
      revision: 1,
      title: "Flag-Forked Function",
      summary:
        "Flags functions whose boolean or literal-union parameters are used only to choose between code paths, to check whether they are two functions sharing a name.",
      guidance: {
        standard:
          "A parameter that only picks a branch makes the caller select an implementation through a value. When every caller knows the answer at write time, the function is several functions behind one name: each new variant adds a branch, and no caller can be understood without reading the body. Flags derived from runtime data, guards, and small variations inside shared logic are ordinary code.",
        checks: [
          "Enumerate the call sites across the repository. FAIL when every call site passes a literal for the flag and the branches share less than roughly half the body; cite the shared lines. Split by intent, or inline into the callers and re-extract what is truly common.",
          "PASS when call sites derive the flag from runtime data (a record field, user input, configuration).",
          "PASS when the flagged function is private and the public entry points are intent-named wrappers around it.",
          "PASS when the branches are small variations inside substantially shared logic, or the condition is a guard or early return rather than an alternative body.",
          "PASS for presentational booleans of UI components (disabled, compact): they are data, not workflow selectors.",
        ],
        examples: [
          {
            label: "FAIL",
            code: "function exportReport(report: Report, asPdf: boolean, archive: boolean) {\n  if (asPdf) return archive ? storePdf(render(report)) : streamPdf(render(report));\n  if (archive) return storeCsv(toRows(report));\n  return streamCsv(toRows(report));\n}\n\nexportReport(report, true, false);",
            description: "Callers pick the path with literals; the branches share nothing.",
          },
          {
            label: "PASS",
            code: "function shippingCost(order: Order, express: boolean) {\n  const base = rateFor(order.weight, order.destination);\n  return express ? base * expressMultiplier : base;\n}\n\nshippingCost(order, order.options.express);",
            description: "The flag is order data and varies one step of shared logic.",
          },
        ],
        refs: [
          { type: "url", href: "https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction" },
          { type: "url", href: "https://martinfowler.com/bliki/FlagArgument.html" },
          { type: "url", href: "https://overreacted.io/goodbye-clean-code/" },
          { type: "url", href: "https://arxiv.org/html/2603.24755v1" },
        ],
      },
    },
    binding: {
      id: "core/flag-forked-function",
      authority: "agent",
      include: [...sourceGlobs],
      exclude: includeJsx ? [...nonTestExcludes] : [...nonTestExcludes, jsxGlob],
      options: {
        minFlags: options.minFlags ?? null,
        minSitesForSingleFlag: options.minSitesForSingleFlag ?? null,
        includeJsx: options.includeJsx ?? null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            file: "src/module.ts",
            source:
              "export function renderInvoice({ invoice, forCreditNote = false, draft = false }) { if (forCreditNote) return credit(invoice); if (draft) return preview(invoice); return final(invoice); }",
          },
        ],
        mustStaySilent: [
          {
            file: "src/module.ts",
            source:
              "export function renderInvoice({ invoice, forCreditNote = false, draft = false }) { return build(invoice, { forCreditNote, draft }); }",
          },
        ],
      },
      id: "core/flag-forked-function",
      version: 1,
      scan: "file",
      createOnce(context) {
        function inspect(fn: AgentlintNode): void {
          if (!includeJsx && jsxFilePattern.test(context.path)) return;
          const body = fn.childByFieldName("body");
          if (!body) return;

          const driven = flagCandidates(fn)
            .map((flag) => ({ flag, sites: conditionalSites(body, flag.name) }))
            .filter((entry) => entry.sites > 0);
          const reported =
            driven.length >= minFlags ? driven : driven.filter((entry) => entry.sites >= minSites).slice(0, 1);
          if (reported.length === 0) return;

          const name = functionName(fn);
          const callSites =
            name === undefined || fn.type === "method_definition"
              ? []
              : rootOf(fn)
                  .descendantsOfType("call_expression")
                  .filter((call) => {
                    const callee = call.childByFieldName("function");
                    return callee?.type === "identifier" && callee.text === name;
                  });
          const literalCallSites = callSites.filter((call) =>
            reported.some((entry) => passesLiteral(call, entry.flag)),
          ).length;
          if (callSites.length > 0 && literalCallSites === 0) return;

          const flags = reported.map((entry) => entry.flag.name).toSorted();
          context.report({
            node: fn.childByFieldName("name") ?? fn,
            message: `Parameter${flags.length > 1 ? "s" : ""} ${flags.map((flag) => `\`${flag}\``).join(", ")} only select${flags.length > 1 ? "" : "s"} a code path; split the function by intent, or show that callers derive the flag from runtime data.`,
            evidence: { flags, literalCallSites },
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

export const flagForkedFunction = defineFlagForkedFunction();
