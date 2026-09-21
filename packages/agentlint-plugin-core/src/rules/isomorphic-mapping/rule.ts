/**
 * Flags single-parameter functions that rebuild their argument field by field into a same-shaped object.
 */
import { type AgentlintNode, defineRule, type StateRule } from "@aurelienbbn/agentlint";
import {
  namedChildren,
  nonTestExcludes,
  ownReturns,
  parameterPattern,
  parametersOf,
  sourceGlobs,
  unwrapExpression,
} from "../judgment-support-b.js";

const defaultMinProperties = 5;
const defaultIdentityRatio = 0.9;

function message(identity: number, properties: number): string {
  return `Function copies ${identity} of ${properties} members straight from its argument into a same-shaped object; name the boundary that separates the two types, or use one type and delete the mapper.`;
}

export type IsomorphicMappingOptions = {
  /** Smallest returned object, in members, that is inspected. Default: 5 */
  readonly minProperties?: number;
  /** Share of members that must be identity copies, above 0 and at most 1. Default: 0.9 */
  readonly identityRatio?: number;
};

function returnedObject(fn: AgentlintNode): AgentlintNode | undefined {
  const body = fn.childByFieldName("body");
  if (!body) return undefined;
  if (body.type !== "statement_block") {
    const value = unwrapExpression(body);
    return value.type === "object" ? value : undefined;
  }
  const last = ownReturns(fn).at(-1);
  const returned = last ? namedChildren(last)[0] : undefined;
  const value = returned ? unwrapExpression(returned) : undefined;
  return value?.type === "object" ? value : undefined;
}

function destructuredNames(pattern: AgentlintNode): readonly string[] {
  return pattern.childrenByType("shorthand_property_identifier_pattern").map((name) => name.text);
}

function isNullish(node: AgentlintNode): boolean {
  return node.type === "null" || node.type === "undefined" || node.text === "undefined";
}

function isPropertyRead(value: AgentlintNode, parameter: string, key: string): boolean {
  if (value.type !== "member_expression") return false;
  const object = value.childByFieldName("object");
  return object?.type === "identifier" && object.text === parameter && value.childByFieldName("property")?.text === key;
}

function isIdentityPair(pair: AgentlintNode, parameter: string): boolean {
  const key = pair.childByFieldName("key");
  const rawValue = pair.childByFieldName("value");
  if (key?.type !== "property_identifier" || !rawValue) return false;
  const value = unwrapExpression(rawValue);
  if (isPropertyRead(value, parameter, key.text)) return true;
  if (value.type !== "binary_expression" || value.childByFieldName("operator")?.text !== "??") return false;
  const left = value.childByFieldName("left");
  const right = value.childByFieldName("right");
  return !!left && !!right && isPropertyRead(unwrapExpression(left), parameter, key.text) && isNullish(right);
}

export function defineIsomorphicMapping(options: IsomorphicMappingOptions = {}): StateRule {
  options = structuredClone(options);
  const minProperties = options.minProperties ?? defaultMinProperties;
  const identityRatio = options.identityRatio ?? defaultIdentityRatio;
  if (!Number.isSafeInteger(minProperties) || minProperties < 1)
    throw new Error("isomorphic-mapping: minProperties must be a positive integer.");
  if (!(identityRatio > 0 && identityRatio <= 1))
    throw new Error("isomorphic-mapping: identityRatio must be greater than 0 and at most 1.");

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "core/isomorphic-mapping",
      revision: 1,
      title: "Isomorphic Mapping",
      summary:
        "Flags functions that copy an object field by field into a same-shaped object, to check that a real boundary separates the two types.",
      guidance: {
        standard:
          "Two types with the same fields are worth a mapper only when a boundary lets them change independently: a wire format, a persisted row, a foreign SDK model, another bounded context. Inside one module with one owner, the second type and its mapper are a copy that every new field must be threaded through.",
        checks: [
          "Name the boundary between source and target type: wire format, persisted row, third-party SDK model, another bounded context, published API. Same module and same owner is no boundary: FAIL.",
          "Name a change one side could make without the other. None: FAIL. Use one type and delete the mapper.",
          "PASS when the target is a published or persisted contract, when the source is a foreign model and this function is the translation layer, or when different packages or layers own the two types.",
          "PASS with a fix when the mapper exists to drop fields on purpose (secrets, internal flags): it says so with an explicit pick or omit, not with a copy list.",
        ],
        examples: [
          {
            label: "FAIL",
            code: "const toInvoiceView = (invoice: Invoice): InvoiceView => ({\n  id: invoice.id,\n  number: invoice.number,\n  issuedAt: invoice.issuedAt,\n  currency: invoice.currency,\n  total: invoice.total,\n});",
            description: "Both types live in the same module and always change together.",
          },
          {
            label: "PASS",
            code: "const toInvoiceResponse = (invoice: Invoice): InvoiceResponseV1 => ({\n  id: invoice.id,\n  number: invoice.number,\n  issued_at: invoice.issuedAt.toISOString(),\n  currency: invoice.currency,\n  total_cents: invoice.total.cents,\n});",
            description: "The target is a versioned public payload with its own naming and encoding.",
          },
        ],
        refs: [
          {
            type: "url",
            href: "https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html",
          },
          {
            type: "url",
            href: "https://martinfowler.com/bliki/PresentationDomainDataLayering.html",
          },
          { type: "url", href: "https://martinfowler.com/bliki/BoundedContext.html" },
          { type: "url", href: "https://udidahan.com/2009/06/07/the-fallacy-of-reuse/" },
          { type: "url", href: "https://www.hyrumslaw.com/" },
        ],
      },
    },
    binding: {
      id: "core/isomorphic-mapping",
      authority: "agent",
      include: [...sourceGlobs],
      exclude: [...nonTestExcludes],
      options: {
        minProperties: options.minProperties ?? null,
        identityRatio: options.identityRatio ?? null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            file: "src/module.ts",
            source:
              "function toUserModel(entity) { return { id: entity.id, name: entity.name, email: entity.email, role: entity.role, createdAt: entity.createdAt }; }",
          },
        ],
        mustStaySilent: [
          {
            file: "src/module.ts",
            source:
              "function toUserModel(entity) { return { id: entity.id, name: entity.name, email: entity.email, role: entity.role }; }",
          },
        ],
      },
      id: "core/isomorphic-mapping",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        function inspect(fn: AgentlintNode): void {
          const parameters = parametersOf(fn);
          const pattern = parameters.length === 1 && parameters[0] ? parameterPattern(parameters[0]) : undefined;
          if (!pattern) return;
          const target = returnedObject(fn);
          if (!target) return;
          const members = namedChildren(target);
          if (members.length < minProperties) return;

          const parameter = pattern.type === "identifier" ? pattern.text : undefined;
          const bound = new Set(pattern.type === "object_pattern" ? destructuredNames(pattern) : []);
          if (parameter !== undefined) {
            for (const declarator of fn.childByFieldName("body")?.descendantsOfType("variable_declarator") ?? []) {
              const name = declarator.childByFieldName("name");
              const value = declarator.childByFieldName("value");
              if (name?.type !== "object_pattern" || value?.type !== "identifier" || value.text !== parameter) continue;
              for (const local of destructuredNames(name)) bound.add(local);
            }
          }

          const identity = members.filter((member) => {
            if (member.type === "shorthand_property_identifier") return bound.has(member.text);
            if (parameter === undefined) return false;
            if (member.type === "pair") return isIdentityPair(member, parameter);
            if (member.type !== "spread_element") return false;
            const spread = namedChildren(member)[0];
            return spread?.type === "identifier" && spread.text === parameter;
          }).length;
          if (identity / members.length < identityRatio) return;

          context.report({
            node: target,
            message: message(identity, members.length),
            evidence: { properties: members.length, identity },
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

export const isomorphicMapping = defineIsomorphicMapping();
