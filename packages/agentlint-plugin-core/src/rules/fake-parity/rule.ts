/**
 * Flags hand-written stateful fakes of a port, so their behaviour is proven against the real implementation.
 *
 * @attribution "ContractTest" by Martin Fowler (concept)
 * @attribution "Getting Started with Contract Tests" by J. B. Rainsberger (concept)
 */
import { type AgentlintNode, defineRule, type StateRule } from "@aurelienbbn/agentlint";
import { isFunctionNode } from "../ast.js";
import { isSameNode, matches, namedChildren, serializePattern, sourceGlobs } from "../judgment-support-b.js";

const defaultFakeNamePattern = /^(?:Fake|InMemory|Stub)[A-Z]/;
const defaultPortTypePattern = /(?:Gateway|Client|Repository|Port|Service|Store)$/;

const mutatorNames = new Set(["set", "push", "add", "delete", "clear", "unshift", "splice", "pop", "shift"]);
const collectionConstructors = new Set(["Map", "Set", "WeakMap", "WeakSet", "Array"]);
const assignmentTypes = new Set(["assignment_expression", "augmented_assignment_expression"]);

export type FakeParityOptions = {
  /** Pattern matching class names of hand-written fakes. */
  readonly fakeNamePattern?: RegExp;
  /** Pattern matching the port type an object-literal fake is typed as. */
  readonly portTypePattern?: RegExp;
};

function isCollectionInitialiser(value: AgentlintNode | null | undefined): boolean {
  if (!value) return false;
  if (value.type === "array" || value.type === "object") return true;
  return (
    value.type === "new_expression" && collectionConstructors.has(value.childByFieldName("constructor")?.text ?? "")
  );
}

function isWrite(reference: AgentlintNode): boolean {
  const parent = reference.parent;
  if (!parent) return false;
  if (assignmentTypes.has(parent.type)) {
    const left = parent.childByFieldName("left");
    return left !== null && isSameNode(left, reference);
  }
  if (parent.type === "subscript_expression") return isWrite(parent);
  if (parent.type !== "member_expression") return false;
  const object = parent.childByFieldName("object");
  if (!object || !isSameNode(object, reference)) return false;
  if (isWrite(parent)) return true;
  const call = parent.parent;
  const callee = call?.type === "call_expression" ? call.childByFieldName("function") : null;
  return !!callee && isSameNode(callee, parent) && mutatorNames.has(parent.childByFieldName("property")?.text ?? "");
}

function fieldReferences(method: AgentlintNode, field: string): readonly AgentlintNode[] {
  return method
    .descendantsOfType("member_expression")
    .filter(
      (member) =>
        member.childByFieldName("object")?.type === "this" && member.childByFieldName("property")?.text === field,
    );
}

function closureReferences(method: AgentlintNode, name: string): readonly AgentlintNode[] {
  return method.descendantsOfType("identifier").filter((identifier) => identifier.text === name);
}

/** True when one method mutates the store and a different method reads it. */
function sharesState(
  methods: readonly AgentlintNode[],
  references: (method: AgentlintNode) => readonly AgentlintNode[],
): boolean {
  const usage = methods.map((method) => {
    const found = references(method);
    return { writes: found.some(isWrite), reads: found.some((reference) => !isWrite(reference)) };
  });
  return usage.some((writer, index) => writer.writes && usage.some((reader, other) => other !== index && reader.reads));
}

function methodsOf(container: AgentlintNode): readonly AgentlintNode[] {
  return namedChildren(container).flatMap((member) => {
    if (member.type === "method_definition")
      return member.childByFieldName("name")?.text === "constructor" ? [] : [member];
    const value =
      member.type === "pair" || member.type === "public_field_definition" ? member.childByFieldName("value") : null;
    return value && isFunctionNode(value) ? [value] : [];
  });
}

function storeNames(container: AgentlintNode, memberType: string, nameField: string): readonly string[] {
  return container
    .childrenByType(memberType)
    .filter((member) => isCollectionInitialiser(member.childByFieldName("value")))
    .flatMap((member) => member.childByFieldName(nameField)?.text ?? []);
}

function enclosingBlock(node: AgentlintNode): AgentlintNode | undefined {
  let current = node.parent;
  while (current !== null) {
    if (current.type === "statement_block" || current.type === "program") return current;
    current = current.parent;
  }
  return undefined;
}

function closedOverStores(object: AgentlintNode): readonly string[] {
  const names: string[] = [];
  for (let block = enclosingBlock(object); block; block = enclosingBlock(block))
    for (const declaration of [
      ...block.childrenByType("lexical_declaration"),
      ...block.childrenByType("variable_declaration"),
    ])
      for (const declarator of declaration.childrenByType("variable_declarator")) {
        const name = declarator.childByFieldName("name");
        if (name?.type === "identifier" && isCollectionInitialiser(declarator.childByFieldName("value")))
          names.push(name.text);
      }
  return names;
}

function typeName(type: AgentlintNode | null | undefined): string {
  return (type?.text ?? "").replace(/<[\s\S]*$/, "").trim();
}

function message(fake: string, port: string): string {
  return `Stateful fake \`${fake}\` encodes behaviour of \`${port}\` that nothing checks against the real implementation; run one shared suite or contract test against both, or cite the one that exists.`;
}

export function defineFakeParity(options: FakeParityOptions = {}): StateRule {
  options = structuredClone(options);
  const fakeNamePattern = options.fakeNamePattern ?? defaultFakeNamePattern;
  const portTypePattern = options.portTypePattern ?? defaultPortTypePattern;

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "core/fake-parity",
      revision: 1,
      title: "Fake Parity",
      summary:
        "Flags hand-written stateful fakes of a port so a shared behaviour suite or contract test proves they still behave like the real implementation.",
      guidance: {
        standard:
          "A fake with state is a second implementation of the port: it decides what a duplicate key, a missing record or an ordering means. Every test built on it inherits those decisions, so they are only worth something while the real implementation makes the same ones. Shape is proven by the compiler; behaviour is proven by running the same expectations against both.",
        checks: [
          "PASS when a test file runs the same expectations against this fake and the real implementation (shared behaviour table or parameterised suite); cite the path.",
          "PASS when a contract test against the real boundary, a sandbox, or an authoritative recorded fixture covers the behaviours the fake encodes (uniqueness, ordering, not-found semantics, pagination); cite the path.",
          "FAIL otherwise. Types generated from a schema do not pass: they prove shape, not behaviour.",
          "Legitimate exception: the fake replaces a collaborator the project owns end to end and whose real implementation is exercised by the same suite elsewhere, so it is a convenience rather than a boundary double; cite that suite.",
        ],
        examples: [
          {
            label: "FAIL",
            code: "class InMemoryOrderRepository implements OrderRepository {\n  private readonly orders = new Map<string, Order>();\n  async save(order: Order) {\n    this.orders.set(order.id, order);\n  }\n  async byId(id: string) {\n    return this.orders.get(id) ?? null;\n  }\n}",
            description: "Nothing shows that the SQL repository also overwrites on save and returns null when missing.",
          },
          {
            label: "PASS",
            code: 'describe.each([\n  ["in-memory", () => new InMemoryOrderRepository()],\n  ["postgres", () => new PostgresOrderRepository(testDatabase())],\n])("%s order repository", (_, create) => {\n  it("returns null for an unknown id", async () => {\n    expect(await create().byId("missing")).toBeNull();\n  });\n});',
            description: "One behaviour table runs against the fake and the real adapter.",
          },
        ],
        refs: [
          { type: "skill", id: "test-strategy" },
          { type: "url", href: "https://martinfowler.com/bliki/ContractTest.html" },
          { type: "url", href: "https://martinfowler.com/bliki/IntegrationTest.html" },
          {
            type: "url",
            href: "https://blog.thecodewhisperer.com/permalink/getting-started-with-contract-tests",
          },
          {
            type: "url",
            href: "https://blog.cleancoder.com/uncle-bob/2014/05/08/TheLittleMocker.html",
          },
        ],
      },
    },
    binding: {
      id: "core/fake-parity",
      authority: "agent",
      include: [...sourceGlobs],
      exclude: ["**/*.d.ts"],
      options: {
        fakeNamePattern: serializePattern(options.fakeNamePattern),
        portTypePattern: serializePattern(options.portTypePattern),
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            file: "src/testing/orders.ts",
            source:
              "class InMemoryOrderRepository implements OrderRepository { private orders = new Map(); save(o) { this.orders.set(o.id, o); } byId(id) { return this.orders.get(id); } }",
          },
        ],
        mustStaySilent: [
          {
            file: "src/testing/clock.ts",
            source: "class FakeClock implements Clock { now() { return fixed; } }",
          },
        ],
      },
      id: "core/fake-parity",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        function inspectObject(object: AgentlintNode, type: AgentlintNode | null | undefined, anchor: AgentlintNode) {
          const port = typeName(type);
          if (!matches(portTypePattern, port)) return;
          const methods = methodsOf(object);
          const stateful =
            storeNames(object, "pair", "key").some((field) =>
              sharesState(methods, (method) => fieldReferences(method, field)),
            ) ||
            closedOverStores(object).some((name) => sharesState(methods, (method) => closureReferences(method, name)));
          if (!stateful) return;
          const name = anchor.type === "identifier" ? anchor.text : "object literal";
          context.report({
            node: anchor,
            message: message(name, port),
            evidence: { fake: name, port },
          });
        }

        return {
          class_declaration(node) {
            const name = node.childByFieldName("name");
            const implemented = node.descendantsOfType("implements_clause")[0];
            const body = node.childByFieldName("body");
            if (!name || !implemented || !body || !matches(fakeNamePattern, name.text)) return;
            const methods = methodsOf(body);
            const stateful = storeNames(body, "public_field_definition", "name").some((field) =>
              sharesState(methods, (method) => fieldReferences(method, field)),
            );
            if (!stateful) return;
            const port = namedChildren(implemented)
              .map((type) => typeName(type))
              .join(", ");
            context.report({
              node: name,
              message: message(name.text, port),
              evidence: { fake: name.text, port },
            });
          },
          satisfies_expression(node) {
            const [value, type] = namedChildren(node);
            if (value?.type !== "object") return;
            const declared = node.parent?.type === "variable_declarator" ? node.parent.childByFieldName("name") : null;
            inspectObject(value, type, declared?.type === "identifier" ? declared : value);
          },
          variable_declarator(node) {
            const value = node.childByFieldName("value");
            const name = node.childByFieldName("name");
            const annotation = node.childByFieldName("type");
            if (value?.type !== "object" || !name || !annotation) return;
            inspectObject(value, namedChildren(annotation)[0], name);
          },
        };
      },
    },
  });
}

export const fakeParity = defineFakeParity();
