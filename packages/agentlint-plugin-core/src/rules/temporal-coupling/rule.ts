/**
 * Flags classes that can be held in an unusable state until some method has been called.
 *
 * Three signals, one finding per class: a guard that throws "not initialized", a definite-assignment field
 * (`name!: T`) filled outside the constructor, and a nullable field filled by an init-style method and
 * null-checked elsewhere. Factory closures are not inspected.
 *
 * @attribution "Design Smell: Temporal Coupling" by Mark Seemann (concept)
 */
import { type AgentlintNode, defineRule, type StateRule } from "@aurelienbbn/agentlint";
import { nodeKey } from "../ast.js";
import { matches, serializePattern, sourceFileGlobs, testFileExcludeGlobs } from "../judgment-support.js";

const defaultGuardMessagePattern =
  /not (?:been |yet )?(?:initiali[sz]ed|connected|started|configured|ready|loaded|opened)|call \w+\(\) (?:first|before)|must (?:first )?(?:call|be initiali[sz]ed)/i;
const defaultInitMethodPattern = /^(?:init|initialize|setup|connect|open|start|load|configure|bootstrap)$/;

const definiteFieldPattern = /^(?:(?:private|protected|public|readonly|declare|static|override)\s+)*#?[\w$]+!\s*:/;
const nullablePattern = /\|\s*(?:null|undefined)\b/;
const classNodeTypes = new Set(["class_declaration", "class", "abstract_class_declaration"]);
const emptyValueTypes = new Set(["null", "undefined"]);

export type TemporalCouplingOptions = {
  /** Pattern matching the text of a thrown message that confesses an initialization order. */
  readonly guardMessagePattern?: RegExp;
  /** Pattern matching names of methods that complete construction after the constructor ran. */
  readonly initMethodPattern?: RegExp;
};

type Assignment = { readonly method: string; readonly empty: boolean };

function owningClassBody(node: AgentlintNode): AgentlintNode | undefined {
  for (let current = node.parent; current !== null; current = current.parent)
    if (current.type === "class_body") return current;
  return undefined;
}

function escapePattern(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isEmptyValue(node: AgentlintNode | null): boolean {
  return node !== null && (emptyValueTypes.has(node.type) || (node.type === "identifier" && node.text === "undefined"));
}

export function defineTemporalCoupling(options: TemporalCouplingOptions = {}): StateRule {
  options = structuredClone(options);
  const guardMessagePattern = options.guardMessagePattern ?? defaultGuardMessagePattern;
  const initMethodPattern = options.initMethodPattern ?? defaultInitMethodPattern;

  function inspect(node: AgentlintNode): { readonly signals: readonly string[]; readonly fields: readonly string[] } {
    const body = node.childByFieldName("body");
    if (!body) return { signals: [], fields: [] };
    const bodyKey = nodeKey(body);
    const owned = (candidate: AgentlintNode): boolean => {
      const owner = owningClassBody(candidate);
      return owner !== undefined && nodeKey(owner) === bodyKey;
    };
    const signals = new Set<string>();
    const fields = new Set<string>();

    const guarded = body
      .descendantsOfType("throw_statement")
      .filter(owned)
      .some((statement) =>
        [...statement.descendantsOfType("string"), ...statement.descendantsOfType("template_string")].some((text) =>
          matches(guardMessagePattern, text.text),
        ),
      );
    if (guarded) signals.add("guard-throw");

    const methods = body.children.filter((child) => child.type === "method_definition");
    const assignments = new Map<string, Assignment[]>();
    for (const method of methods) {
      const methodName = method.childByFieldName("name")?.text ?? "";
      for (const assignment of method.descendantsOfType("assignment_expression").filter(owned)) {
        const target = assignment.childByFieldName("left")?.text ?? "";
        if (!target.startsWith("this.")) continue;
        const entry = { method: methodName, empty: isEmptyValue(assignment.childByFieldName("right")) };
        assignments.set(target, [...(assignments.get(target) ?? []), entry]);
      }
    }

    for (const field of body.children.filter((child) => child.type === "public_field_definition")) {
      const name = field.childByFieldName("name")?.text;
      if (name === undefined || field.children.some((child) => child.type === "decorator")) continue;
      const filled = (assignments.get(`this.${name}`) ?? []).filter((assignment) => !assignment.empty);
      const fillers = new Set(filled.map((assignment) => assignment.method));
      if (fillers.size === 0 || fillers.has("constructor")) continue;

      if (definiteFieldPattern.test(field.text)) {
        signals.add("definite-assignment");
        fields.add(name);
        continue;
      }

      const nullable =
        nullablePattern.test(field.childByFieldName("type")?.text ?? "") ||
        isEmptyValue(field.childByFieldName("value"));
      const [initializer] = [...fillers];
      if (!nullable || fillers.size !== 1 || initializer === undefined || !matches(initMethodPattern, initializer))
        continue;
      const reference = escapePattern(`this.${name}`);
      const nullCheck = new RegExp(
        `!${reference}(?![\\w$])|${reference}\\s*[!=]==?\\s*(?:null|undefined)\\b|${reference}\\?\\.|\\b(?:if|while)\\s*\\(\\s*${reference}\\s*[)&|]`,
      );
      const checkers = methods.filter((method) => {
        const methodName = method.childByFieldName("name")?.text ?? "";
        return methodName !== initializer && methodName !== "constructor" && nullCheck.test(method.text);
      });
      if (checkers.length < 2) continue;
      signals.add("nullable-init");
      fields.add(name);
    }

    return { signals: [...signals].toSorted(), fields: [...fields].toSorted() };
  }

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "core/temporal-coupling",
      revision: 1,
      title: "Temporal Coupling",
      summary:
        "Flags classes that can exist in an unusable state: 'not initialized' guards, definite-assignment fields set outside the constructor, and nullable fields filled by an init method.",
      guidance: {
        standard:
          "An object a caller can hold is an object a caller can use. When methods only work after `init()`, `connect()` or `open()`, the call order is a rule the compiler cannot see and every method pays for it with a guard. Construction finishes the object: a factory returns it ready, or distinct types model the distinct states.",
        checks: [
          "Can a caller obtain this object and call a guarded method without having called the initializer? If yes it fails: the compiler must stop them, not a runtime throw.",
          "Passes when a framework owns the lifecycle and constructs before it initialises: custom elements, DI containers with lifecycle hooks, decorated framework fields.",
          "Passes when the object is a real state machine that legitimately returns to the unready state (a reconnecting client) and those states are modelled explicitly.",
          "On fail, use a private constructor with an async static factory that returns a ready instance, or two types where `open()` on the closed one returns the open one; fields become `readonly` and non-null, and the guards are deleted.",
        ],
        examples: [
          {
            label: "FAIL",
            description: "Every caller must know to call init() first; search() compiles without it.",
            code: "class Indexer {\n  private db!: Database;\n  async init() { this.db = await openDatabase(); }\n  search(term: string) { return this.db.query(term); }\n}",
          },
          {
            label: "PASS",
            description: "The only way to get an Indexer is ready-made.",
            code: "class Indexer {\n  private constructor(private readonly db: Database) {}\n  static async open() { return new Indexer(await openDatabase()); }\n  search(term: string) { return this.db.query(term); }\n}",
          },
        ],
        refs: [
          { type: "url", href: "https://blog.ploeh.dk/2011/05/24/DesignSmellTemporalCoupling/" },
          {
            type: "url",
            href: "https://fsharpforfunandprofit.com/posts/designing-with-types-making-illegal-states-unrepresentable/",
          },
          { type: "url", href: "https://github.com/johnousterhout/aposd-vs-clean-code" },
        ],
      },
    },
    binding: {
      id: "core/temporal-coupling",
      authority: "agent",
      include: [...sourceFileGlobs],
      exclude: ["**/*.d.ts", ...testFileExcludeGlobs],
      options: {
        guardMessagePattern: serializePattern(options.guardMessagePattern),
        initMethodPattern: serializePattern(options.initMethodPattern),
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            file: "src/indexer.ts",
            source:
              "class Indexer { private db!: Database; async init() { this.db = await openDatabase(); } search(term: string) { return this.db.query(term); } }",
          },
        ],
        mustStaySilent: [
          {
            file: "src/indexer.ts",
            source:
              "class Indexer { private db!: Database; constructor(db: Database) { this.db = db; } search(term: string) { return this.db.query(term); } }",
          },
          {
            file: "src/users.ts",
            source: 'class Users { find(id: string) { throw new Error("User not found"); } }',
          },
        ],
      },
      id: "core/temporal-coupling",
      version: 1,
      scan: "file",
      createOnce(context) {
        function visit(node: AgentlintNode): void {
          if (!node.isNamed || !classNodeTypes.has(node.type)) return;
          const { signals, fields } = inspect(node);
          if (signals.length === 0) return;
          const name = node.childByFieldName("name");
          context.report({
            node: name ?? node,
            message: `Class ${name ? `\`${name.text}\` ` : ""}can be held before it is usable (${signals.join(", ")}); finish construction in a factory that returns a ready instance, or model the unready state as its own type.`,
            evidence: { signals, fields },
          });
        }

        return { class_declaration: visit, abstract_class_declaration: visit, class: visit };
      },
    },
  });
}

export const temporalCoupling = defineTemporalCoupling();
