import { parseSync, Visitor, type Expression, type Program } from "oxc-parser";

/**
 * How a stack's `state:` option persists state.
 * - `ephemeral`: `localState()` or `inMemoryState()`; nothing survives the machine or process that ran it.
 * - `remote`: `Cloudflare.state()`, `AWS.state()`, `postgresState()`.
 * - `mixed`: a conditional that picks an ephemeral store on one branch and another store on the other.
 * - `unknown`: anything this static reading cannot attribute to an Alchemy store.
 */
type StateStoreKind = "ephemeral" | "remote" | "mixed" | "unknown";

export type StackStateAnalysis =
  | { readonly parsed: false; readonly reason: string }
  | { readonly parsed: true; readonly kind: StateStoreKind; readonly reason: string };

/** Exported store constructors, keyed by module then export name. */
const stores: Readonly<Record<string, Readonly<Record<string, "ephemeral" | "remote">>>> = {
  alchemy: { localState: "ephemeral", inMemoryState: "ephemeral" },
  "alchemy/State": { localState: "ephemeral", inMemoryState: "ephemeral" },
  "alchemy/State/LocalState": { localState: "ephemeral" },
  "alchemy/State/InMemoryState": { inMemoryState: "ephemeral" },
  "alchemy/State/PostgresState": { postgresState: "remote" },
  "alchemy/Cloudflare": { state: "remote" },
  "alchemy/AWS": { state: "remote" },
};

type Binding = { readonly module: string; readonly name: string | "*" };

function importBindings(program: Program): Map<string, Binding> {
  const bindings = new Map<string, Binding>();
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration" || stores[statement.source.value] === undefined) continue;
    for (const specifier of statement.specifiers) {
      const module = statement.source.value;
      if (specifier.type !== "ImportSpecifier") bindings.set(specifier.local.name, { module, name: "*" });
      else
        bindings.set(specifier.local.name, {
          module,
          name: specifier.imported.type === "Literal" ? specifier.imported.value : specifier.imported.name,
        });
    }
  }
  return bindings;
}

function topLevelConstants(program: Program): Map<string, Expression> {
  const constants = new Map<string, Expression>();
  for (const statement of program.body) {
    const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (declaration?.type !== "VariableDeclaration") continue;
    for (const declarator of declaration.declarations)
      if (declarator.id.type === "Identifier" && declarator.init !== null)
        constants.set(declarator.id.name, declarator.init);
  }
  return constants;
}

class StateReader {
  constructor(
    private readonly bindings: ReadonlyMap<string, Binding>,
    private readonly constants: ReadonlyMap<string, Expression>,
  ) {}

  private store(callee: Expression): "ephemeral" | "remote" | undefined {
    if (callee.type === "Identifier") {
      const binding = this.bindings.get(callee.name);
      return binding === undefined ? undefined : stores[binding.module]?.[binding.name];
    }
    if (callee.type !== "MemberExpression" || callee.computed || callee.object.type !== "Identifier") return undefined;
    const binding = this.bindings.get(callee.object.name);
    if (binding?.name !== "*" || callee.property.type !== "Identifier") return undefined;
    return stores[binding.module]?.[callee.property.name];
  }

  /** Every store an expression can evaluate to; `unknown` for leaves that are not Alchemy stores. */
  leaves(expression: Expression, depth = 0): Array<"ephemeral" | "remote" | "unknown"> {
    switch (expression.type) {
      case "ParenthesizedExpression":
      case "TSAsExpression":
      case "TSSatisfiesExpression":
      case "TSNonNullExpression":
        return this.leaves(expression.expression, depth);
      case "ConditionalExpression":
        return [...this.leaves(expression.consequent, depth), ...this.leaves(expression.alternate, depth)];
      case "LogicalExpression":
        return expression.operator === "&&"
          ? this.leaves(expression.right, depth)
          : [...this.leaves(expression.left, depth), ...this.leaves(expression.right, depth)];
      case "CallExpression":
        return [this.store(expression.callee) ?? "unknown"];
      case "Identifier": {
        const init = this.constants.get(expression.name);
        return init === undefined || depth > 2 ? ["unknown"] : this.leaves(init, depth + 1);
      }
      default:
        return ["unknown"];
    }
  }
}

function isStackCall(callee: Expression): boolean {
  if (callee.type === "Identifier") return callee.name === "Stack";
  if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return false;
  if (callee.property.name === "Stack") return true;
  return callee.property.name === "make" && callee.object.type === "Identifier" && callee.object.name === "Stack";
}

function stateOptions(program: Program): { readonly calls: number; readonly values: Expression[] } {
  let calls = 0;
  const values: Expression[] = [];
  new Visitor({
    CallExpression(node) {
      if (!isStackCall(node.callee)) return;
      calls += 1;
      for (const argument of node.arguments) {
        if (argument.type !== "ObjectExpression") continue;
        for (const property of argument.properties) {
          if (property.type !== "Property" || property.computed) continue;
          const key = property.key;
          const name = key.type === "Identifier" ? key.name : key.type === "Literal" ? key.value : undefined;
          if (name === "state") values.push(property.value);
        }
      }
    },
  }).visit(program);
  return { calls, values };
}

/**
 * Reads the `state:` option of every `Stack(...)` / `Alchemy.Stack(...)` / `Stack.make(...)` call in a
 * stack file. Store constructors are recognized only through their Alchemy imports, and a top-level
 * `const` is followed a few levels; anything else is `unknown`, never assumed remote.
 */
export function analyzeStackState(filename: string, source: string): StackStateAnalysis {
  const result = parseSync(filename, source, { preserveParens: false });
  if (result.errors.length > 0)
    return { parsed: false, reason: result.errors[0]?.message ?? "the file does not parse as TypeScript" };
  const { calls, values } = stateOptions(result.program);
  if (calls === 0) return { parsed: true, kind: "unknown", reason: "no Stack(...) call was found" };
  if (values.length === 0) return { parsed: true, kind: "unknown", reason: "no literal `state:` option was found" };
  const reader = new StateReader(importBindings(result.program), topLevelConstants(result.program));
  const leaves = new Set(values.flatMap((value) => reader.leaves(value)));
  if (leaves.has("ephemeral"))
    return leaves.size === 1
      ? { parsed: true, kind: "ephemeral", reason: "state is localState() or inMemoryState()" }
      : { parsed: true, kind: "mixed", reason: "state picks between an ephemeral store and another one" };
  if (leaves.has("unknown"))
    return { parsed: true, kind: "unknown", reason: "state is not a recognized Alchemy state store" };
  return { parsed: true, kind: "remote", reason: "state is a remote Alchemy state store" };
}
