/**
 * Flags header interfaces with a single implementer, forwarding classes and modules, and pass-through wrapper exports.
 *
 * @attribution code-slop by asyrafhussin (MIT) + thermos by Cursor (MIT), concepts re-implemented
 * @attribution "Interfaces are not abstractions" by Mark Seemann (concept: header interfaces, Reused Abstractions Principle)
 */
import { type AgentlintNode, defineRule, type StateRule } from "@aurelienbbn/agentlint";
import { isFunctionNode } from "../ast.js";
import {
  isSameNode,
  literalText,
  matches,
  namedChildren,
  parameterPattern,
  parametersOf,
  serializePattern,
  unwrapExpression,
} from "../judgment-support-b.js";

const exportedInterfacePattern = /^export\s+(?:declare\s+)?interface\s+([A-Za-z_$][\w$]*)/;
const functionExportPattern =
  /^export\s+(?:default\s+)?(?:async\s+)?function\s+[\w$]*\s*(?:<[^>]*>)?\s*\([^)]*\)(?:\s*:[^{]+)?\s*(\{[\s\S]*\})\s*$/;
const arrowExportPattern =
  /^export\s+const\s+[\w$]+(?:\s*:[^=]+)?\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w$]+)(?:\s*:[^=>]+)?\s*=>\s*(\{[\s\S]*\})\s*;?\s*$/;
const delegationBodyPattern = /^\{?\s*return\s+\w+(?:\.\w+)*\(.*\);?\s*\}?$/s;
const maxDelegationBodyLength = 160;

const implementationAffixes = ["Impl", "Default", "Base", "Concrete", "Standard", "Real"];
const relativeSpecifierPattern = /^\.\.?\//;
const defaultMinForwardingMembers = 3;
const defaultForwardingRatio = 0.8;

const namedInterfaceMessage =
  "Exported interface uses premature-abstraction naming; it earns its keep with a second implementation or a real seam.";
const delegationMessage =
  "Exported function only delegates to a single call; inline the wrapper or give it real logic.";

export type AbstractionEarnsKeepOptions = {
  /**
   * Pattern matching premature-interface naming on exported interfaces. Off by default: implementers are counted
   * instead. `/^I[A-Z][a-z]|Interface$/` restores the naming trigger without matching `IPAddress` or `IOResult`.
   */
  readonly interfacePattern?: RegExp;
  /** Smallest class or module, in methods or exported functions, inspected for verbatim forwarding. Default: 3 */
  readonly minForwardingMembers?: number;
  /** Share of members that must forward verbatim to one collaborator, above 0 and at most 1. Default: 0.8 */
  readonly forwardingRatio?: number;
};

type Implementer = { readonly name: string; readonly members: readonly string[] };

function extractFunctionBody(text: string): string | null {
  const fn = functionExportPattern.exec(text);
  if (fn) return fn[1] ?? null;

  const arrow = arrowExportPattern.exec(text);
  if (arrow) return arrow[1] ?? null;

  return null;
}

function typeName(type: AgentlintNode | undefined): string {
  return (type?.text ?? "").replace(/<[\s\S]*$/, "").trim();
}

/** Member names of a type made only of methods, or undefined when the type also carries data. */
function behaviourMembers(body: AgentlintNode | null): readonly string[] | undefined {
  const members = namedChildren(body);
  const names: string[] = [];
  for (const member of members) {
    const name = member.childByFieldName("name")?.text;
    const isMethod =
      member.type === "method_signature" ||
      (member.type === "property_signature" &&
        namedChildren(member.childByFieldName("type"))[0]?.type === "function_type");
    if (!isMethod || name === undefined) return undefined;
    names.push(name);
  }
  return names.length > 0 ? names : undefined;
}

function isHidden(member: AgentlintNode): boolean {
  const modifier = member.childrenByType("accessibility_modifier")[0]?.text;
  return (
    modifier === "private" ||
    modifier === "protected" ||
    member.children.some((child) => child.type === "static") ||
    member.childByFieldName("name")?.type === "private_property_identifier"
  );
}

function classMethods(body: AgentlintNode | null): readonly AgentlintNode[] {
  return namedChildren(body).filter((member) => {
    if (member.childByFieldName("name")?.text === "constructor") return false;
    if (member.type === "method_definition") return true;
    const value = member.type === "public_field_definition" ? member.childByFieldName("value") : null;
    return !!value && isFunctionNode(value);
  });
}

function objectMembers(object: AgentlintNode): readonly string[] {
  return namedChildren(object).map((member) =>
    member.type === "pair"
      ? (member.childByFieldName("key")?.text ?? "")
      : (member.childByFieldName("name") ?? member).text,
  );
}

function implementersOf(root: AgentlintNode, target: string): readonly Implementer[] {
  const found: Implementer[] = [];
  for (const type of ["class_declaration", "class", "abstract_class_declaration"])
    for (const declaration of root.descendantsOfType(type)) {
      const clause = declaration.descendantsOfType("implements_clause")[0];
      if (!clause || !namedChildren(clause).some((implemented) => typeName(implemented) === target)) continue;
      found.push({
        name: declaration.childByFieldName("name")?.text ?? "anonymous class",
        members: classMethods(declaration.childByFieldName("body"))
          .filter((member) => !isHidden(member))
          .map((member) => member.childByFieldName("name")?.text ?? ""),
      });
    }
  for (const expression of root.descendantsOfType("satisfies_expression")) {
    const [value, type] = namedChildren(expression);
    if (value?.type !== "object" || typeName(type) !== target) continue;
    const declared =
      expression.parent?.type === "variable_declarator" ? expression.parent.childByFieldName("name") : null;
    found.push({ name: declared?.text ?? "object literal", members: objectMembers(value) });
  }
  for (const declarator of root.descendantsOfType("variable_declarator")) {
    const value = declarator.childByFieldName("value");
    const annotation = namedChildren(declarator.childByFieldName("type"))[0];
    if (value?.type !== "object" || typeName(annotation) !== target) continue;
    found.push({
      name: declarator.childByFieldName("name")?.text ?? "object literal",
      members: objectMembers(value),
    });
  }
  return found;
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const expected = new Set(left);
  const actual = new Set(right);
  return expected.size === actual.size && [...expected].every((name) => actual.has(name));
}

/** Local names bound by imports, mapped to their module specifier. */
function importedBindings(root: AgentlintNode): ReadonlyMap<string, string> {
  const bindings = new Map<string, string>();
  for (const statement of root.childrenByType("import_statement")) {
    const source = statement.childByFieldName("source");
    const specifier = source ? literalText(source) : undefined;
    const clause = statement.childrenByType("import_clause")[0];
    if (specifier === undefined || !clause) continue;
    for (const child of namedChildren(clause)) {
      if (child.type === "identifier") bindings.set(child.text, specifier);
      if (child.type === "namespace_import") bindings.set(namedChildren(child)[0]?.text ?? "", specifier);
      for (const imported of child.childrenByType("import_specifier")) {
        const local = imported.childByFieldName("alias") ?? imported.childByFieldName("name");
        if (local) bindings.set(local.text, specifier);
      }
    }
  }
  return bindings;
}

function isAffixedNameOf(className: string, interfaceName: string): boolean {
  if (/^I[A-Z]/.test(interfaceName) && className === interfaceName.slice(1)) return true;
  return implementationAffixes.some(
    (affix) =>
      className === `${interfaceName}${affix}` ||
      className === `${affix}${interfaceName}` ||
      interfaceName === `${className}${affix}` ||
      interfaceName === `${affix}${className}`,
  );
}

/** The call a function-like node forwards to when its whole body is that call with its own parameters, in order. */
function verbatimForward(fn: AgentlintNode): AgentlintNode | undefined {
  const body = fn.childByFieldName("body");
  if (!body) return undefined;
  let expression: AgentlintNode | undefined = body;
  if (body.type === "statement_block") {
    const statements = namedChildren(body);
    const only = statements.length === 1 ? statements[0] : undefined;
    if (only?.type !== "return_statement" && only?.type !== "expression_statement") return undefined;
    expression = namedChildren(only)[0];
  }
  const call = expression ? unwrapExpression(expression) : undefined;
  if (call?.type !== "call_expression") return undefined;

  const parameters = parametersOf(fn);
  if (parameters.some((parameter) => parameter.childByFieldName("value") !== null)) return undefined;
  const passed = namedChildren(call.childByFieldName("arguments")).map((argument) => argument.text);
  const declared = parameters.map((parameter) => parameterPattern(parameter)?.text);
  if (passed.length !== declared.length || passed.some((text, index) => text !== declared[index])) return undefined;
  return call;
}

/** Collaborator a forwarding call targets: `this.<field>` for methods, an identifier for module functions. */
function forwardTarget(call: AgentlintNode, kind: "field" | "binding"): string | undefined {
  const callee = call.childByFieldName("function");
  const receiver = callee?.type === "member_expression" ? callee.childByFieldName("object") : null;
  if (!receiver) return undefined;
  if (kind === "binding") return receiver.type === "identifier" ? receiver.text : undefined;
  if (receiver.type !== "member_expression" || receiver.childByFieldName("object")?.type !== "this") return undefined;
  return receiver.childByFieldName("property")?.text;
}

function dominantTarget(targets: readonly (string | undefined)[]): readonly [string, number] | undefined {
  const counts = new Map<string, number>();
  for (const target of targets) if (target !== undefined) counts.set(target, (counts.get(target) ?? 0) + 1);
  return [...counts.entries()].toSorted((left, right) => right[1] - left[1])[0];
}

function exportedFunction(statement: AgentlintNode): AgentlintNode | undefined {
  const declaration = statement.childByFieldName("declaration") ?? namedChildren(statement)[0];
  if (declaration?.type === "function_declaration") return declaration;
  if (declaration?.type !== "lexical_declaration") return undefined;
  const declarators = declaration.childrenByType("variable_declarator");
  const value = declarators.length === 1 ? declarators[0]?.childByFieldName("value") : null;
  return value && isFunctionNode(value) ? value : undefined;
}

export function defineAbstractionEarnsKeep(options: AbstractionEarnsKeepOptions = {}): StateRule {
  options = structuredClone(options);
  const interfacePattern = options.interfacePattern;
  const minForwardingMembers = options.minForwardingMembers ?? defaultMinForwardingMembers;
  const forwardingRatio = options.forwardingRatio ?? defaultForwardingRatio;
  if (!Number.isSafeInteger(minForwardingMembers) || minForwardingMembers < 1)
    throw new Error("abstraction-earns-keep: minForwardingMembers must be a positive integer.");
  if (!(forwardingRatio > 0 && forwardingRatio <= 1))
    throw new Error("abstraction-earns-keep: forwardingRatio must be greater than 0 and at most 1.");

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "core/abstraction-earns-keep",
      revision: 2,
      title: "Abstraction Earns Keep",
      summary:
        "Flags interfaces that mirror their only implementer, classes and modules that forward verbatim to one collaborator, and exports that only delegate to a single call.",
      guidance: {
        standard:
          "An abstraction earns its keep. An interface that lists the members of its only implementer, a layer that forwards every call unchanged, or a single-delegation export adds indirection without buying clarity — inline it or delete it. A seam that a second implementer or a test double already uses is not speculative: effort that makes code easier to modify or to test is outside YAGNI. Well-named decomposition steps are NOT wrappers: a private helper that isolates a real sub-problem stays.",
        checks: [
          "Name the second implementer that exists today, production or test double; search the repository, because the detector only sees this file. One exists: PASS. None is an answer: FAIL — use the concrete type and extract the interface when the second implementer arrives.",
          "An interface that lists every public member of its only class is a header, not an abstraction. It PASSES only as a role interface owned by the consumer's module and narrower than the implementer, as a documented plugin or extension point, or when it crosses a package or process boundary.",
          "Forwarding layer: state what this layer decides. Nothing yet: FAIL — callers take the collaborator directly; never keep the layer for future logic.",
          "A forwarding layer PASSES when it exposes strictly fewer operations than the collaborator, renames a foreign vocabulary, owns a public contract, or adds validation, instrumentation, authorization, caching or transactions in at least one member. Framework-mandated layers (DI providers, routers) PASS.",
          "Named decomposition helpers with real logic are kept — do not inline readable steps.",
          "On FAIL do not replace the interface with a type alias of the class.",
        ],
        examples: [
          {
            label: "FAIL",
            code: "export interface InvoiceService {\n  issue(draft: Draft): Promise<Invoice>;\n  cancel(id: string): Promise<void>;\n}\n\nexport class InvoiceServiceImpl implements InvoiceService {\n  async issue(draft: Draft) {\n    return this.ledger.post(toEntries(draft));\n  }\n  async cancel(id: string) {\n    await this.ledger.reverse(id);\n  }\n}",
            description: "One implementer, no double anywhere, and the interface repeats its public surface.",
          },
          {
            label: "PASS",
            code: "// checkout/ports.ts, owned by the consumer\nexport interface PaymentAuthorizer {\n  authorize(amount: Money, card: CardToken): Promise<Authorization>;\n}\n\n// adapters/stripe.ts exposes twenty operations; tests pass an in-memory authorizer.",
            description: "A narrow role interface with a second implementer in use.",
          },
        ],
        refs: [
          { type: "url", href: "https://blog.ploeh.dk/2010/12/02/Interfacesarenotabstractions/" },
          { type: "url", href: "https://github.com/johnousterhout/aposd-vs-clean-code" },
          { type: "url", href: "https://martinfowler.com/bliki/Yagni.html" },
          { type: "url", href: "https://martinfowler.com/articles/gateway-pattern.html" },
          {
            type: "url",
            href: "https://blog.cleancoder.com/uncle-bob/2016/01/04/ALittleArchitecture.html",
          },
          { type: "skill", id: "code-review" },
        ],
      },
    },
    binding: {
      id: "core/abstraction-earns-keep",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"],
      exclude: ["**/*.d.ts"],
      options: {
        interfacePattern: serializePattern(options.interfacePattern),
        minForwardingMembers: options.minForwardingMembers ?? null,
        forwardingRatio: options.forwardingRatio ?? null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            file: "src/module.ts",
            source:
              "export interface InvoiceService { issue(id: string): void }\nexport class InvoiceServiceImpl implements InvoiceService { issue(id: string) { post(id); } }",
          },
          {
            file: "src/module.ts",
            source: "export function getUser(id: string) {\n  return repo.getUser(id);\n}",
          },
        ],
        mustStaySilent: [
          { file: "src/module.ts", source: "export const count = 1;" },
          { file: "src/module.ts", source: "export interface IUser {id:string}" },
          { file: "src/module.ts", source: "export interface IPAddress { toString(): string }" },
        ],
      },
      id: "core/abstraction-earns-keep",
      version: 2,
      scan: "file",
      createOnce({ context }) {
        function reportInterfaces(root: AgentlintNode): void {
          const declarations = [
            ...root.descendantsOfType("interface_declaration"),
            ...root.descendantsOfType("type_alias_declaration"),
          ];
          for (const declaration of declarations) {
            const name = declaration.childByFieldName("name");
            if (!name) continue;
            const implementers = implementersOf(root, name.text);
            const exportStatement = declaration.parent?.type === "export_statement" ? declaration.parent : undefined;

            const value = declaration.childByFieldName("value");
            const shape =
              declaration.type === "interface_declaration"
                ? declaration.childByFieldName("body")
                : value?.type === "object_type"
                  ? value
                  : null;
            const members = behaviourMembers(shape);
            const only = implementers.length === 1 ? implementers[0] : undefined;
            if (members && only && sameSet(members, only.members)) {
              context.report({
                node: name,
                message: `Interface \`${name.text}\` lists exactly the members of its only implementer \`${only.name}\` in this file; it earns its keep with a second implementer, a test double, or a consumer-owned seam.`,
                evidence: {
                  interface: name.text,
                  implementer: only.name,
                  members: members.toSorted(),
                },
              });
              continue;
            }

            if (!interfacePattern || !exportStatement || implementers.length >= 2) continue;
            if (!exportedInterfacePattern.test(exportStatement.text) || !matches(interfacePattern, name.text)) continue;
            context.report({ node: exportStatement, message: namedInterfaceMessage });
          }
        }

        function reportAffixedImplementations(root: AgentlintNode): void {
          const imports = importedBindings(root);
          for (const declaration of root.descendantsOfType("class_declaration")) {
            const className = declaration.childByFieldName("name")?.text;
            const clause = declaration.descendantsOfType("implements_clause")[0];
            if (className === undefined || !clause) continue;
            const mirrored = namedChildren(clause)
              .map((implemented) => typeName(implemented))
              .find(
                (implemented) =>
                  relativeSpecifierPattern.test(imports.get(implemented) ?? "") &&
                  isAffixedNameOf(className, implemented),
              );
            if (mirrored === undefined) continue;
            context.report({
              node: clause,
              message: `Class \`${className}\` is named as the implementation of \`${mirrored}\` from a sibling module; the interface earns its keep with a second implementer, a test double, or a consumer-owned seam.`,
              evidence: { interface: mirrored, implementer: className },
            });
          }
        }

        function reportForwardingClasses(root: AgentlintNode): void {
          for (const declaration of root.descendantsOfType("class_declaration")) {
            const name = declaration.childByFieldName("name");
            const methods = classMethods(declaration.childByFieldName("body"));
            if (!name || methods.length < minForwardingMembers) continue;
            const dominant = dominantTarget(
              methods.map((method) => {
                const fn = method.type === "method_definition" ? method : method.childByFieldName("value");
                const call = fn ? verbatimForward(fn) : undefined;
                return call ? forwardTarget(call, "field") : undefined;
              }),
            );
            if (!dominant || dominant[1] / methods.length < forwardingRatio) continue;
            context.report({
              node: name,
              message: `Class \`${name.text}\` forwards ${dominant[1]} of ${methods.length} methods unchanged to \`this.${dominant[0]}\`; state what this layer decides, or let callers take the collaborator directly.`,
              evidence: {
                forwarder: name.text,
                collaborator: dominant[0],
                forwarding: dominant[1],
                members: methods.length,
              },
            });
          }
        }

        /** Reports a forwarding module once and returns the exports that finding covers. */
        function reportForwardingModule(root: AgentlintNode): readonly AgentlintNode[] {
          const imports = importedBindings(root);
          const exported = root.childrenByType("export_statement").flatMap((statement) => {
            const fn = exportedFunction(statement);
            if (!fn) return [];
            const call = verbatimForward(fn);
            const target = call ? forwardTarget(call, "binding") : undefined;
            return [
              {
                statement,
                target: target !== undefined && imports.has(target) ? target : undefined,
              },
            ];
          });
          if (exported.length < minForwardingMembers) return [];
          const dominant = dominantTarget(exported.map((entry) => entry.target));
          if (!dominant || dominant[1] / exported.length < forwardingRatio) return [];

          const covered = exported.filter((entry) => entry.target === dominant[0]).map((entry) => entry.statement);
          const first = covered[0];
          if (!first) return [];
          context.report({
            node: first,
            message: `Module forwards ${dominant[1]} of ${exported.length} exported functions unchanged to \`${dominant[0]}\`; state what this layer decides, or let callers import the collaborator directly.`,
            evidence: {
              collaborator: dominant[0],
              forwarding: dominant[1],
              members: exported.length,
            },
          });
          return covered;
        }

        return {
          program(root) {
            reportInterfaces(root);
            reportAffixedImplementations(root);
            reportForwardingClasses(root);
            const covered = reportForwardingModule(root);

            for (const statement of root.descendantsOfType("export_statement")) {
              if (covered.some((node) => isSameNode(node, statement))) continue;
              const body = extractFunctionBody(statement.text);
              if (body === null || body.length > maxDelegationBodyLength) continue;
              if (!delegationBodyPattern.test(body)) continue;
              context.report({ node: statement, message: delegationMessage });
            }
          },
        };
      },
    },
  });
}

export const abstractionEarnsKeep = defineAbstractionEarnsKeep();
